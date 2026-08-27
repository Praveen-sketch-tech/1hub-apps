const TelegramBot = require('node-telegram-bot-api');
const https = require('https');

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
                    console.log('✅ Metadata loaded from pinned message');
                    loadingMetadata = false;
                    return;
                }
            } catch (e) {}
        }
        console.log('⚠️ No pinned metadata found, creating defaults');
        await saveMetadata();
        metadataLoaded = true;
    } catch (error) {
        console.error('❌ Load metadata error:', error.message);
        metadataLoaded = true;
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
        const buffer = Buffer.from(jsonData, 'utf-8');
        const result = await bot.sendDocument(CHAT_ID, buffer, {
            filename: 'metadata.json',
            caption: jsonData.substring(0, 200)
        });
        const newId = result.message_id;
        await bot.pinChatMessage(CHAT_ID, newId);
        if (METADATA_MESSAGE_ID && METADATA_MESSAGE_ID !== newId) {
            try {
                await bot.deleteMessage(CHAT_ID, METADATA_MESSAGE_ID);
            } catch (e) { /* ignore */ }
        }
        METADATA_MESSAGE_ID = newId;
        console.log('✅ Metadata saved atomically');
    } catch (error) {
        console.error('❌ Save metadata error:', error.message);
        throw new Error('Failed to save metadata: ' + error.message);
    } finally {
        saveLock = false;
    }
}

async function ensureMetadata() {
    if (!metadataLoaded) {
        await loadMetadata();
        metadataLoaded = true;
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
            try {
                const buffer = Buffer.from(fileBase64, 'base64');
                const result = await bot.sendDocument(CHAT_ID, buffer, {
                    filename: filename,
                    caption: JSON.stringify({
                        id: metadata.id,
                        name: metadata.name,
                        type: 'document'
                    })
                });
                const doc = {
                    id: metadata.id || `doc_${Date.now()}`,
                    name: metadata.name,
                    name_hi: metadata.name_hi || metadata.name,
                    category: metadata.category,
                    description: metadata.description || '',
                    status: metadata.status || 'active',
                    file_id: result.document.file_id,
                    message_id: result.message_id,
                    filename: filename,
                    mimeType: metadata.mimeType || 'application/octet-stream',
                    size: metadata.size || 0,
                    fields: metadata.fields || [],
                    placeholders: metadata.placeholders || [],
                    createdAt: new Date().toISOString()
                };
                data.documents.push(doc);
                await saveMetadata();
                return res.status(200).json({ success: true, document: doc });
            } catch (error) {
                console.error('Upload error:', error);
                return res.status(500).json({ error: 'Upload failed: ' + error.message });
            }
        }

        // DOCUMENTS - UPDATE
        if (path.startsWith('/documents/') && req.method === 'PUT') {
            const docId = path.split('/')[2];
            const index = data.documents.findIndex(d => d.id === docId);
            if (index === -1) {
                return res.status(404).json({ error: 'Document not found' });
            }
            const updates = req.body;
            data.documents[index] = { ...data.documents[index], ...updates, updatedAt: new Date().toISOString() };
            await saveMetadata();
            return res.status(200).json({ success: true, document: data.documents[index] });
        }

        // DOCUMENTS - DELETE
        if (path.startsWith('/documents/') && req.method === 'DELETE') {
            const docId = path.split('/')[2];
            const index = data.documents.findIndex(d => d.id === docId);
            if (index === -1) {
                return res.status(404).json({ error: 'Document not found' });
            }
            const doc = data.documents[index];
            if (bot) {
                try {
                    await bot.deleteMessage(CHAT_ID, doc.message_id);
                } catch (e) { /* ignore */ }
            }
            data.documents.splice(index, 1);
            await saveMetadata();
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
            data.categories.push(cat);
            await saveMetadata();
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
            data.categories.splice(index, 1);
            await saveMetadata();
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
            data.keywords.push(kw);
            await saveMetadata();
            return res.status(200).json({ success: true, keyword: kw });
        }

        // KEYWORDS - DELETE
        if (path.startsWith('/keywords/') && req.method === 'DELETE') {
            const kwId = path.split('/')[2];
            const index = data.keywords.findIndex(k => k.id === kwId);
            if (index === -1) {
                return res.status(404).json({ error: 'Keyword not found' });
            }
            data.keywords.splice(index, 1);
            await saveMetadata();
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
