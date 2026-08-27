const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = process.env.TG_TOKEN;
const CHAT_ID = process.env.TG_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
    console.error('❌ Missing TG_TOKEN or TG_CHAT_ID');
}

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// ============================================================
// PERSISTENT STORAGE via Telegram
// ============================================================

// In-memory cache with Telegram backup
let cache = {
    documents: [],
    categories: [],
    keywords: []
};

// Last message ID for metadata storage
let METADATA_MESSAGE_ID = null;

// ============================================================
// Load metadata from Telegram
// ============================================================
async function loadMetadata() {
    try {
        // Try to get metadata from Telegram
        const updates = await bot.getUpdates({
            limit: 50,
            allowed_updates: ['message']
        });

        // Find metadata message
        for (const update of updates) {
            if (update.message && update.message.text) {
                try {
                    const data = JSON.parse(update.message.text);
                    if (data.type === 'metadata') {
                        cache.documents = data.documents || [];
                        cache.categories = data.categories || [];
                        cache.keywords = data.keywords || [];
                        METADATA_MESSAGE_ID = update.message.message_id;
                        console.log('✅ Metadata loaded from Telegram');
                        return;
                    }
                } catch (e) {
                    // Not metadata, skip
                }
            }
        }

        // If no metadata found, set defaults
        if (cache.categories.length === 0) {
            cache.categories = [
                { id: 'cat_1', name: 'Agreement', name_hi: 'समझौता', icon: '📄', color: '#667eea' },
                { id: 'cat_2', name: 'Affidavit', name_hi: 'शपथ पत्र', icon: '📜', color: '#48bb78' },
                { id: 'cat_3', name: 'Legal', name_hi: 'कानूनी', icon: '⚖️', color: '#ed8936' },
                { id: 'cat_4', name: 'Property', name_hi: 'संपत्ति', icon: '🏠', color: '#4299e1' }
            ];
        }
        if (cache.keywords.length === 0) {
            cache.keywords = [
                { id: 'kw_1', name: 'owner_name', type: 'text' },
                { id: 'kw_2', name: 'tenant_name', type: 'text' },
                { id: 'kw_3', name: 'rent_amount', type: 'number' },
                { id: 'kw_4', name: 'date', type: 'date' }
            ];
        }

        console.log('✅ Default metadata loaded');
    } catch (error) {
        console.error('Failed to load metadata:', error.message);
        // Use defaults
        if (cache.categories.length === 0) {
            cache.categories = [
                { id: 'cat_1', name: 'Agreement', name_hi: 'समझौता', icon: '📄', color: '#667eea' },
                { id: 'cat_2', name: 'Affidavit', name_hi: 'शपथ पत्र', icon: '📜', color: '#48bb78' },
                { id: 'cat_3', name: 'Legal', name_hi: 'कानूनी', icon: '⚖️', color: '#ed8936' },
                { id: 'cat_4', name: 'Property', name_hi: 'संपत्ति', icon: '🏠', color: '#4299e1' }
            ];
        }
        if (cache.keywords.length === 0) {
            cache.keywords = [
                { id: 'kw_1', name: 'owner_name', type: 'text' },
                { id: 'kw_2', name: 'tenant_name', type: 'text' },
                { id: 'kw_3', name: 'rent_amount', type: 'number' },
                { id: 'kw_4', name: 'date', type: 'date' }
            ];
        }
    }
}

// ============================================================
// Save metadata to Telegram
// ============================================================
async function saveMetadata() {
    try {
        const metadata = {
            type: 'metadata',
            documents: cache.documents,
            categories: cache.categories,
            keywords: cache.keywords,
            updatedAt: new Date().toISOString()
        };

        const jsonData = JSON.stringify(metadata);
        const buffer = Buffer.from(jsonData, 'utf-8');

        let result;
        if (METADATA_MESSAGE_ID) {
            try {
                // Try to edit existing message
                result = await bot.editMessageText(jsonData, {
                    chat_id: CHAT_ID,
                    message_id: METADATA_MESSAGE_ID
                });
            } catch (e) {
                // If edit fails, send new message
                result = await bot.sendDocument(CHAT_ID, buffer, {
                    filename: 'metadata.json',
                    caption: jsonData
                });
                METADATA_MESSAGE_ID = result.message_id;
            }
        } else {
            // Send new message
            result = await bot.sendDocument(CHAT_ID, buffer, {
                filename: 'metadata.json',
                caption: jsonData
            });
            METADATA_MESSAGE_ID = result.message_id;
        }

        console.log('✅ Metadata saved to Telegram');
    } catch (error) {
        console.error('Failed to save metadata:', error.message);
    }
}

// ============================================================
// Helper: Ensure metadata is loaded
// ============================================================
let metadataLoaded = false;

async function ensureMetadata() {
    if (!metadataLoaded) {
        await loadMetadata();
        metadataLoaded = true;
    }
}

// ============================================================
// API HANDLER
// ============================================================
module.exports = async (req, res) => {
    // CORS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Ensure metadata is loaded
    await ensureMetadata();

    const path = req.url.replace(/^\/api\/document-generator/, '').split('?')[0];

    // ============================================================
    // DOCUMENTS
    // ============================================================
    if (path === '/documents' && req.method === 'GET') {
        return res.status(200).json({ documents: cache.documents });
    }

    if (path === '/documents/upload' && req.method === 'POST') {
        try {
            const { content, filename, metadata } = req.body;

            if (!content || !filename || !metadata) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Upload to Telegram
            const buffer = Buffer.from(content, 'utf-8');
            const result = await bot.sendDocument(CHAT_ID, buffer, {
                filename: filename,
                caption: JSON.stringify({
                    id: metadata.id,
                    name: metadata.name,
                    category: metadata.category
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
                fields: metadata.fields || [],
                placeholders: metadata.placeholders || [],
                createdAt: new Date().toISOString()
            };

            cache.documents.push(doc);
            await saveMetadata();

            return res.status(200).json({ success: true, document: doc });
        } catch (error) {
            console.error('Upload error:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    if (path.startsWith('/documents/') && req.method === 'GET') {
        const docId = path.split('/')[2];
        const doc = cache.documents.find(d => d.id === docId);
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        try {
            const fileLink = await bot.getFileLink(doc.file_id);
            const response = await fetch(fileLink);
            const content = await response.text();
            return res.status(200).json({ document: { ...doc, content } });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to fetch document: ' + error.message });
        }
    }

    if (path.startsWith('/documents/') && req.method === 'PUT') {
        const docId = path.split('/')[2];
        const index = cache.documents.findIndex(d => d.id === docId);
        if (index === -1) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const updates = req.body;
        cache.documents[index] = { ...cache.documents[index], ...updates, updatedAt: new Date().toISOString() };
        await saveMetadata();

        return res.status(200).json({ success: true, document: cache.documents[index] });
    }

    if (path.startsWith('/documents/') && req.method === 'DELETE') {
        const docId = path.split('/')[2];
        const index = cache.documents.findIndex(d => d.id === docId);
        if (index === -1) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const doc = cache.documents[index];
        try {
            await bot.deleteMessage(CHAT_ID, doc.message_id);
        } catch (e) {
            console.warn('Could not delete from Telegram:', e.message);
        }

        cache.documents.splice(index, 1);
        await saveMetadata();

        return res.status(200).json({ success: true });
    }

    // ============================================================
    // CATEGORIES
    // ============================================================
    if (path === '/categories' && req.method === 'GET') {
        return res.status(200).json({ categories: cache.categories });
    }

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
        cache.categories.push(cat);
        await saveMetadata();

        return res.status(200).json({ success: true, category: cat });
    }

    if (path.startsWith('/categories/') && req.method === 'DELETE') {
        const catId = path.split('/')[2];
        const index = cache.categories.findIndex(c => c.id === catId);
        if (index === -1) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const docsInCategory = cache.documents.filter(d => d.category === catId);
        if (docsInCategory.length > 0) {
            return res.status(400).json({
                error: `Cannot delete: ${docsInCategory.length} documents use this category`
            });
        }

        cache.categories.splice(index, 1);
        await saveMetadata();

        return res.status(200).json({ success: true });
    }

    // ============================================================
    // KEYWORDS
    // ============================================================
    if (path === '/keywords' && req.method === 'GET') {
        return res.status(200).json({ keywords: cache.keywords });
    }

    if (path === '/keywords' && req.method === 'POST') {
        const { name, type } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Keyword name required' });
        }
        if (cache.keywords.some(k => k.name === name)) {
            return res.status(400).json({ error: 'Keyword already exists' });
        }
        const kw = {
            id: `kw_${Date.now()}`,
            name,
            type: type || 'text',
            createdAt: new Date().toISOString()
        };
        cache.keywords.push(kw);
        await saveMetadata();

        return res.status(200).json({ success: true, keyword: kw });
    }

    if (path.startsWith('/keywords/') && req.method === 'DELETE') {
        const kwId = path.split('/')[2];
        const index = cache.keywords.findIndex(k => k.id === kwId);
        if (index === -1) {
            return res.status(404).json({ error: 'Keyword not found' });
        }
        cache.keywords.splice(index, 1);
        await saveMetadata();

        return res.status(200).json({ success: true });
    }

    // ============================================================
    // HEALTH
    // ============================================================
    if (path === '/health') {
        return res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            documents: cache.documents.length,
            categories: cache.categories.length,
            keywords: cache.keywords.length
        });
    }

    return res.status(404).json({ error: 'Not found' });
};
