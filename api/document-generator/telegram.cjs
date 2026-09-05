// ⚠️ ROOT CAUSE FIX (Admin upload/edit/pause/delete "EFATAL: Unsupported Buffer
// file-type" error): node-telegram-bot-api's legacy Buffer handling tries to
// sniff the mime type of any Buffer using the old `file-type@3.x` package and
// THROWS a fatal error if it can't recognize the bytes (this is a documented,
// deprecated safety check - see node-telegram-bot-api doc/usage.md). Setting
// NTBA_FIX_350 disables that unsafe throw and makes it fall back to
// 'application/octet-stream' instead, exactly like every other Telegram SDK.
// This MUST be set before any sendDocument/sendPhoto/etc. call is made.
process.env.NTBA_FIX_350 = process.env.NTBA_FIX_350 || '1';

const TelegramBot = require('node-telegram-bot-api');
const https = require('https');
const HTMLtoDOCX = require('@turbodocx/html-to-docx');

const BOT_TOKEN = process.env.TG_TOKEN;
const CHAT_ID = process.env.TG_CHAT_ID;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// ⚠️ CRITICAL: If ADMIN_TOKEN or ADMIN_PASSWORD missing, we must fail admin requests
let bot = null;
if (BOT_TOKEN && CHAT_ID) {
    try {
        bot = new TelegramBot(BOT_TOKEN, { polling: false });
        console.log('✅ Bot initialized');
    } catch (e) {
        console.error('❌ Bot init error:', e.message);
    }
} else {
    console.error('❌ Missing TG_TOKEN or TG_CHAT_ID');
}

// ============================================================
// PERSISTENT METADATA - PINNED MESSAGE
// ============================================================

let METADATA_MESSAGE_ID = null;
let metadataLoaded = false;
let loadingMetadata = false;
let saveLock = false;
// ⚠️ ROOT CAUSE FIX (documents/:id 404 right after upload): Vercel serverless
// functions are NOT guaranteed to route consecutive requests to the same warm
// container. `metadataLoaded` used to mean "loaded once, trust it forever for
// this process's lifetime" - so a container that loaded metadata BEFORE a
// document was uploaded (from another container) would keep serving its
// stale copy indefinitely and 404 a document that genuinely exists in
// Telegram (the real source of truth). We keep the in-memory copy only as a
// short-lived cache (bounded staleness), not as a persistent store, so every
// container re-syncs with Telegram's pinned metadata within a few seconds -
// this is NOT a return to getUpdates()/full in-memory persistence, it's a
// small TTL on an otherwise stateless read.
let lastMetadataLoadAt = 0;
const METADATA_CACHE_TTL_MS = 5000;

let data = {
    documents: [],
    categories: [
        { id: 'cat_1', name: 'Agreement', name_hi: 'समझौता', icon: '📄', color: '#667eea' },
        { id: 'cat_2', name: 'Affidavit', name_hi: 'शपथ पत्र', icon: '📜', color: '#48bb78' },
        { id: 'cat_3', name: 'Legal', name_hi: 'कानूनी', icon: '⚖️', color: '#ed8936' },
        { id: 'cat_4', name: 'Property', name_hi: 'संपत्ति', icon: '🏠', color: '#4299e1' }
    ],
    keywords: [
        { id: 'kw_1', name: 'owner_name', type: 'text' },
        { id: 'kw_2', name: 'tenant_name', type: 'text' },
        { id: 'kw_3', name: 'rent_amount', type: 'number' },
        { id: 'kw_4', name: 'date', type: 'date' }
    ]
};

// ============================================================
// LOAD METADATA - PINNED MESSAGE ONLY
// ============================================================
async function loadMetadata() {
    if (loadingMetadata) {
        return new Promise((resolve) => {
            const check = setInterval(() => {
                if (!loadingMetadata) {
                    clearInterval(check);
                    resolve();
                }
            }, 100);
        });
    }
    loadingMetadata = true;
    try {
        if (!bot) {
            console.log('⚠️ Bot not initialized, using defaults');
            metadataLoaded = true;
            lastMetadataLoadAt = Date.now();
            loadingMetadata = false;
            return;
        }
        const chat = await bot.getChat(CHAT_ID);
        if (chat.pinned_message && chat.pinned_message.document &&
            chat.pinned_message.document.file_name === 'metadata.json') {
            const fileLink = await bot.getFileLink(chat.pinned_message.document.file_id);
            const content = await fetchUrl(fileLink);
            try {
                const parsed = JSON.parse(content);
                if (parsed.type === 'metadata') {
                    data.documents = parsed.documents || [];
                    data.categories = parsed.categories || data.categories;
                    data.keywords = parsed.keywords || data.keywords;
                    METADATA_MESSAGE_ID = chat.pinned_message.message_id;
                    metadataLoaded = true;
                    lastMetadataLoadAt = Date.now();
                    console.log('✅ Metadata loaded from pinned message');
                    loadingMetadata = false;
                    return;
                }
            } catch (e) {}
        }
        console.log('⚠️ No pinned metadata found, creating defaults');
        await saveMetadata();
        metadataLoaded = true;
        lastMetadataLoadAt = Date.now();
    } catch (error) {
        console.error('❌ Load metadata error:', error.message);
        // Do not mark as loaded-and-fresh on failure - allow the very next
        // request to retry instead of freezing this container on defaults.
        metadataLoaded = true;
        lastMetadataLoadAt = 0;
    }
    loadingMetadata = false;
}

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = '';
            response.on('data', (chunk) => { data += chunk; });
            response.on('end', () => { resolve(data); });
            response.on('error', reject);
        }).on('error', reject);
    });
}

// ============================================================
// SAVE METADATA - WITH CONCURRENCY LOCK
// ============================================================
async function saveMetadata() {
    if (saveLock) {
        console.log('⚠️ Save already in progress, waiting...');
        return new Promise((resolve) => {
            const check = setInterval(() => {
                if (!saveLock) {
                    clearInterval(check);
                    resolve(saveMetadata());
                }
            }, 50);
        });
    }
    saveLock = true;
    try {
        if (!bot) {
            console.log('⚠️ Bot not initialized, metadata not saved');
            throw new Error('Bot not initialized');
        }
        const metadata = {
            type: 'metadata',
            documents: data.documents,
            categories: data.categories,
            keywords: data.keywords,
            updatedAt: new Date().toISOString()
        };
        const jsonData = JSON.stringify(metadata);
        const fs = require('fs');
        const path = require('path');
        const tempFile = path.join('/tmp', 'document-generator-metadata.json');

        fs.writeFileSync(tempFile, jsonData, 'utf-8');

        let result;
        try {
            result = await bot.sendDocument(CHAT_ID, tempFile, {
                caption: jsonData.substring(0, 200)
            }, {
                filename: 'metadata.json',
                contentType: 'application/json'
            });
        } finally {
            try {
                fs.unlinkSync(tempFile);
            } catch (e) {
                // Ignore temp-file cleanup errors
            }
        }
        const newId = result.message_id;
        await bot.pinChatMessage(CHAT_ID, newId);
        if (METADATA_MESSAGE_ID && METADATA_MESSAGE_ID !== newId) {
            try {
                await bot.deleteMessage(CHAT_ID, METADATA_MESSAGE_ID);
            } catch (e) { /* ignore */ }
        }
        METADATA_MESSAGE_ID = newId;
        lastMetadataLoadAt = Date.now();
        console.log('✅ Metadata saved atomically');
    } catch (error) {
        console.error('❌ Save metadata error:', error.message);
        throw new Error('Failed to save metadata: ' + error.message);
    } finally {
        saveLock = false;
    }
}

async function ensureMetadata() {
    const isStale = !metadataLoaded || (Date.now() - lastMetadataLoadAt) > METADATA_CACHE_TTL_MS;
    if (isStale) {
        await loadMetadata();
    }
}

// ============================================================
// ROOT CAUSE FIX (unreliable Telegram/metadata save flow):
// Every mutating route used to mutate `data` in-memory FIRST and only THEN
// call saveMetadata(). If saveMetadata() failed (e.g. transient Telegram
// error), the in-memory copy in THIS warm container was left mutated even
// though nothing was actually persisted - so this container would report
// success-looking state (a "phantom" doc/category/keyword) to any request
// that landed back on it, while Telegram (the real source of truth) never
// had it. That is a direct contributor to id-mismatch/404 style bugs.
// This helper snapshots state, applies the mutation, persists it, and rolls
// the in-memory copy back if persistence fails - so in-memory state can
// never drift from what's actually saved to Telegram.
async function mutateAndPersist(mutateFn) {
    const snapshot = {
        documents: JSON.parse(JSON.stringify(data.documents)),
        categories: JSON.parse(JSON.stringify(data.categories)),
        keywords: JSON.parse(JSON.stringify(data.keywords)),
    };
    mutateFn();
    try {
        await saveMetadata();
    } catch (error) {
        data.documents = snapshot.documents;
        data.categories = snapshot.categories;
        data.keywords = snapshot.keywords;
        throw error;
    }
}

// ============================================================
// ADMIN AUTH MIDDLEWARE
// ============================================================
function isAdmin(req) {
    if (!ADMIN_TOKEN) return false;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    return token === ADMIN_TOKEN;
}

// ============================================================
// API HANDLER
// ============================================================
module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        await ensureMetadata();
    } catch (error) {
        return res.status(500).json({ error: 'Failed to initialize: ' + error.message });
    }

    const path = req.url.replace(/^\/api\/document-generator/, '').split('?')[0];

    // ============================================================
    // PUBLIC ROUTES (no auth)
    // ============================================================
    if (path === '/admin-login' && req.method === 'POST') {
        if (!ADMIN_PASSWORD) {
            return res.status(500).json({ success: false, error: 'ADMIN_PASSWORD not configured' });
        }
        const { password } = req.body;
        if (password === ADMIN_PASSWORD) {
            if (!ADMIN_TOKEN) {
                return res.status(500).json({ success: false, error: 'ADMIN_TOKEN not configured' });
            }
            return res.status(200).json({
                success: true,
                token: ADMIN_TOKEN,
                message: 'Login successful'
            });
        } else {
            return res.status(401).json({ success: false, error: 'Invalid password' });
        }
    }

    if (path === '/documents' && req.method === 'GET') {
        return res.status(200).json({ documents: data.documents });
    }

    if (path === '/categories' && req.method === 'GET') {
        return res.status(200).json({ categories: data.categories });
    }

    if (path === '/keywords' && req.method === 'GET') {
        return res.status(200).json({ keywords: data.keywords });
    }

    if (path.startsWith('/documents/') && req.method === 'GET') {
        const docId = path.split('/')[2];
        const doc = data.documents.find(d => d.id === docId);
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }
        if (!bot) {
            return res.status(500).json({ error: 'Bot not initialized' });
        }
        try {
            const fileLink = await bot.getFileLink(doc.file_id);
            const binaryData = await fetchUrlBuffer(fileLink);
            const base64 = binaryData.toString('base64');
            let textContent = null;
            if (doc.mimeType === 'text/plain' ||
                (doc.filename && doc.filename.toLowerCase().endsWith('.txt'))) {
                textContent = binaryData.toString('utf-8');
            }
            return res.status(200).json({
                document: {
                    ...doc,
                    contentBase64: base64,
                    textContent: textContent
                }
            });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to fetch document: ' + error.message });
        }
    }

    if (path === '/health') {
        return res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            documents: data.documents.length,
            categories: data.categories.length,
            keywords: data.keywords.length,
            bot_initialized: !!bot,
            metadata_message_id: METADATA_MESSAGE_ID,
            admin_token_configured: !!ADMIN_TOKEN,
            admin_password_configured: !!ADMIN_PASSWORD
        });
    }

    // ============================================================
    // WORD EXPORT - REAL DOCX
    // ============================================================
    if (path === '/word-export' && req.method === 'POST') {
        try {
            const { html } = req.body || {};

            if (!html || typeof html !== 'string') {
                return res.status(400).json({ error: 'HTML content is required' });
            }

            // Prevent unexpectedly large export requests.
            if (Buffer.byteLength(html, 'utf8') > 2 * 1024 * 1024) {
                return res.status(413).json({ error: 'Document content is too large' });
            }

            const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@page {
    size: A4 portrait;
    margin: 20mm;
}

body {
    font-family: "Times New Roman", Times, serif;
    font-size: 14pt;
    line-height: 1.5;
    color: #000;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th, td {
    border: 1px solid #000;
    padding: 6px 7px;
    vertical-align: top;
}

th {
    text-align: center;
    font-weight: bold;
}

p {
    margin: 0 0 6pt 0;
}
</style>
</head>
<body>${html}</body>
</html>`;

            const docxBuffer = await HTMLtoDOCX(fullHtml, null, {
                orientation: 'portrait',
                title: 'Title Clearance Report',
                creator: '1 Hub Apps',
                table: {
                    row: {
                        cantSplit: true
                    },
                    borderOptions: {
                        size: 1,
                        color: '000000'
                    }
                }
            });

            res.statusCode = 200;
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            );
            res.setHeader(
                'Content-Disposition',
                'attachment; filename="Title-Clearance-Report.docx"'
            );
            res.setHeader('Content-Length', docxBuffer.length);

            return res.end(Buffer.from(docxBuffer));
        } catch (error) {
            console.error('❌ DOCX export error:', error);
            return res.status(500).json({
                error: 'Failed to generate Word document: ' + error.message
            });
        }
    }

    // ============================================================
    // ADMIN ROUTES (auth required)
    // ============================================================
    if (!ADMIN_TOKEN) {
        return res.status(500).json({ error: 'ADMIN_TOKEN not configured. Please set environment variable.' });
    }
    if (!isAdmin(req)) {
        return res.status(401).json({ error: 'Unauthorized. Provide valid admin token.' });
    }

    try {
        // DOCUMENTS - UPLOAD
        if (path === '/documents/upload' && req.method === 'POST') {
            if (!bot) {
                return res.status(500).json({ error: 'Bot not initialized' });
            }
            const { fileBase64, filename, metadata } = req.body;
            if (!fileBase64 || !filename || !metadata) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            let uploadedResult = null;
            try {
                const buffer = Buffer.from(fileBase64, 'base64');
                uploadedResult = await bot.sendDocument(CHAT_ID, buffer, {
                    caption: JSON.stringify({
                        id: metadata.id,
                        name: metadata.name,
                        type: 'document'
                    })
                }, {
                    filename: filename,
                    contentType: metadata.mimeType || 'application/octet-stream'
                });
                const doc = {
                    id: metadata.id || `doc_${Date.now()}`,
                    name: metadata.name,
                    name_hi: metadata.name_hi || metadata.name,
                    category: metadata.category,
                    description: metadata.description || '',
                    status: metadata.status || 'active',
                    file_id: uploadedResult.document.file_id,
                    message_id: uploadedResult.message_id,
                    filename: filename,
                    mimeType: metadata.mimeType || 'application/octet-stream',
                    size: metadata.size || 0,
                    fields: metadata.fields || [],
                    placeholders: metadata.placeholders || [],
                    createdAt: new Date().toISOString()
                };
                await mutateAndPersist(() => { data.documents.push(doc); });
                return res.status(200).json({ success: true, document: doc });
            } catch (error) {
                console.error('Upload error:', error);
                // If the file was already sent to Telegram but metadata
                // failed to persist, don't leave an orphan file behind -
                // best-effort cleanup so a retried upload doesn't duplicate it.
                if (uploadedResult && bot) {
                    try {
                        await bot.deleteMessage(CHAT_ID, uploadedResult.message_id);
                    } catch (cleanupError) { /* ignore */ }
                }
                // Return the underlying message as-is (don't stack another
                // "Upload failed:" prefix on top of it - the caller already
                // labels this as an upload failure).
                return res.status(500).json({ error: error.message });
            }
        }

        // DOCUMENTS - UPDATE (covers Edit/Pause: status toggles go through here too)
        if (path.startsWith('/documents/') && req.method === 'PUT') {
            const docId = path.split('/')[2];
            const index = data.documents.findIndex(d => d.id === docId);
            if (index === -1) {
                return res.status(404).json({ error: 'Document not found' });
            }
            const updates = req.body;
            let updatedDoc;
            try {
                await mutateAndPersist(() => {
                    data.documents[index] = { ...data.documents[index], ...updates, updatedAt: new Date().toISOString() };
                    updatedDoc = data.documents[index];
                });
            } catch (error) {
                console.error('Update error:', error);
                return res.status(500).json({ error: error.message });
            }
            return res.status(200).json({ success: true, document: updatedDoc });
        }

        // DOCUMENTS - DELETE
        if (path.startsWith('/documents/') && req.method === 'DELETE') {
            const docId = path.split('/')[2];
            const index = data.documents.findIndex(d => d.id === docId);
            if (index === -1) {
                return res.status(404).json({ error: 'Document not found' });
            }
            const doc = data.documents[index];
            try {
                // Persist the metadata removal FIRST, then delete the actual
                // Telegram file. If we deleted the file first and saveMetadata
                // failed, the persisted metadata would keep pointing at a
                // message that no longer exists (a broken file_id) - the
                // reverse order means a failed save always leaves Telegram
                // in a recoverable, consistent state.
                await mutateAndPersist(() => { data.documents.splice(index, 1); });
            } catch (error) {
                console.error('Delete error:', error);
                return res.status(500).json({ error: error.message });
            }
            if (bot) {
                try {
                    await bot.deleteMessage(CHAT_ID, doc.message_id);
                } catch (e) { /* ignore - metadata is already consistent without this doc */ }
            }
            return res.status(200).json({ success: true });
        }

        // CATEGORIES - CREATE
        if (path === '/categories' && req.method === 'POST') {
            const { name, name_hi, icon, color } = req.body;
            if (!name) {
                return res.status(400).json({ error: 'Category name required' });
            }
            const cat = {
                id: `cat_${Date.now()}`,
                name,
                name_hi: name_hi || name,
                icon: icon || '📂',
                color: color || '#667eea',
                createdAt: new Date().toISOString()
            };
            try {
                await mutateAndPersist(() => { data.categories.push(cat); });
            } catch (error) {
                console.error('Category create error:', error);
                return res.status(500).json({ error: error.message });
            }
            return res.status(200).json({ success: true, category: cat });
        }

        // CATEGORIES - DELETE
        if (path.startsWith('/categories/') && req.method === 'DELETE') {
            const catId = path.split('/')[2];
            const index = data.categories.findIndex(c => c.id === catId);
            if (index === -1) {
                return res.status(404).json({ error: 'Category not found' });
            }
            const docsInCategory = data.documents.filter(d => d.category === catId);
            if (docsInCategory.length > 0) {
                return res.status(400).json({
                    error: `Cannot delete: ${docsInCategory.length} documents use this category. Reassign them first.`
                });
            }
            try {
                await mutateAndPersist(() => { data.categories.splice(index, 1); });
            } catch (error) {
                console.error('Category delete error:', error);
                return res.status(500).json({ error: error.message });
            }
            return res.status(200).json({ success: true });
        }

        // KEYWORDS - CREATE
        if (path === '/keywords' && req.method === 'POST') {
            const { name, type } = req.body;
            if (!name) {
                return res.status(400).json({ error: 'Keyword name required' });
            }
            if (data.keywords.some(k => k.name === name)) {
                return res.status(400).json({ error: 'Keyword already exists' });
            }
            const kw = {
                id: `kw_${Date.now()}`,
                name,
                type: type || 'text',
                createdAt: new Date().toISOString()
            };
            try {
                await mutateAndPersist(() => { data.keywords.push(kw); });
            } catch (error) {
                console.error('Keyword create error:', error);
                return res.status(500).json({ error: error.message });
            }
            return res.status(200).json({ success: true, keyword: kw });
        }

        // KEYWORDS - DELETE
        if (path.startsWith('/keywords/') && req.method === 'DELETE') {
            const kwId = path.split('/')[2];
            const index = data.keywords.findIndex(k => k.id === kwId);
            if (index === -1) {
                return res.status(404).json({ error: 'Keyword not found' });
            }
            try {
                await mutateAndPersist(() => { data.keywords.splice(index, 1); });
            } catch (error) {
                console.error('Keyword delete error:', error);
                return res.status(500).json({ error: error.message });
            }
            return res.status(200).json({ success: true });
        }

        return res.status(404).json({ error: 'Not found' });
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message });
    }
};

function fetchUrlBuffer(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            const chunks = [];
            response.on('data', (chunk) => { chunks.push(chunk); });
            response.on('end', () => { resolve(Buffer.concat(chunks)); });
            response.on('error', reject);
        }).on('error', reject);
    });
}
