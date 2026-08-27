const TelegramBot = require('node-telegram-bot-api');

// Log environment variables status
console.log('TG_TOKEN:', process.env.TG_TOKEN ? '✅ Set' : '❌ Missing');
console.log('TG_CHAT_ID:', process.env.TG_CHAT_ID ? '✅ Set' : '❌ Missing');

const BOT_TOKEN = process.env.TG_TOKEN;
const CHAT_ID = process.env.TG_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
    console.error('❌ Missing TG_TOKEN or TG_CHAT_ID environment variables');
}

// Only initialize bot if we have credentials
let bot = null;
try {
    if (BOT_TOKEN) {
        bot = new TelegramBot(BOT_TOKEN, { polling: false });
        console.log('✅ Bot initialized successfully');
    }
} catch (error) {
    console.error('❌ Failed to initialize bot:', error.message);
}

// ============================================================
// PERSISTENT STORAGE via Telegram
// ============================================================

let cache = {
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

let METADATA_MESSAGE_ID = null;
let metadataLoaded = false;

// ============================================================
// Simple in-memory fallback (no Telegram dependency)
// ============================================================
// For now, we'll use in-memory cache. In production,
// this should be replaced with a proper database.

module.exports = async (req, res) => {
    // CORS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
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

                // Check if bot is initialized
                if (!bot) {
                    return res.status(500).json({ error: 'Telegram bot not initialized. Check TG_TOKEN environment variable.' });
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
                return res.status(200).json({ success: true, document: doc });
            } catch (error) {
                console.error('Upload error:', error);
                return res.status(500).json({ error: 'Upload failed: ' + error.message });
            }
        }

        if (path.startsWith('/documents/') && req.method === 'GET') {
            const docId = path.split('/')[2];
            const doc = cache.documents.find(d => d.id === docId);
            if (!doc) {
                return res.status(404).json({ error: 'Document not found' });
            }

            try {
                if (!bot) {
                    return res.status(500).json({ error: 'Telegram bot not initialized. Check TG_TOKEN environment variable.' });
                }

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
                if (bot) {
                    await bot.deleteMessage(CHAT_ID, doc.message_id);
                }
            } catch (e) {
                console.warn('Could not delete from Telegram:', e.message);
            }

            cache.documents.splice(index, 1);
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
            return res.status(200).json({ success: true, keyword: kw });
        }

        if (path.startsWith('/keywords/') && req.method === 'DELETE') {
            const kwId = path.split('/')[2];
            const index = cache.keywords.findIndex(k => k.id === kwId);
            if (index === -1) {
                return res.status(404).json({ error: 'Keyword not found' });
            }
            cache.keywords.splice(index, 1);
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
                keywords: cache.keywords.length,
                bot_initialized: !!bot
            });
        }

        return res.status(404).json({ error: 'Not found' });
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message });
    }
};
