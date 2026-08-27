const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = process.env.TG_TOKEN;
const CHAT_ID = process.env.TG_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
    console.error('❌ Missing TG_TOKEN or TG_CHAT_ID');
}

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// ============================================================
// PERSISTENT STORAGE - Telegram Based
// ============================================================

let METADATA_MESSAGE_ID = null;
let metadataLoaded = false;

// Default data
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
// LOAD METADATA FROM TELEGRAM
// ============================================================
async function loadMetadata() {
    try {
        const updates = await bot.getUpdates({
            limit: 50,
            allowed_updates: ['message']
        });

        for (const update of updates) {
            if (update.message && update.message.document) {
                const fileId = update.message.document.file_id;
                const fileLink = await bot.getFileLink(fileId);
                const response = await fetch(fileLink);
                const content = await response.text();
                
                try {
                    const parsed = JSON.parse(content);
                    if (parsed.type === 'metadata') {
                        data.documents = parsed.documents || [];
                        data.categories = parsed.categories || data.categories;
                        data.keywords = parsed.keywords || data.keywords;
                        METADATA_MESSAGE_ID = update.message.message_id;
                        metadataLoaded = true;
                        console.log('✅ Metadata loaded from Telegram');
                        return;
                    }
                } catch (e) {}
            }
        }

        // No metadata found, save defaults
        await saveMetadata();
        console.log('✅ Default metadata created');
    } catch (error) {
        console.error('Load metadata error:', error.message);
        await saveMetadata();
    }
}

// ============================================================
// SAVE METADATA TO TELEGRAM
// ============================================================
async function saveMetadata() {
    try {
        const metadata = {
            type: 'metadata',
            documents: data.documents,
            categories: data.categories,
            keywords: data.keywords,
            updatedAt: new Date().toISOString()
        };

        const jsonData = JSON.stringify(metadata, null, 2);
        const buffer = Buffer.from(jsonData, 'utf-8');

        let result;
        if (METADATA_MESSAGE_ID) {
            try {
                await bot.editMessageText(jsonData, {
                    chat_id: CHAT_ID,
                    message_id: METADATA_MESSAGE_ID
                });
                console.log('✅ Metadata updated');
                return;
            } catch (e) {
                console.log('Edit failed, sending new message');
            }
        }

        result = await bot.sendDocument(CHAT_ID, buffer, {
            filename: 'metadata.json',
            caption: jsonData.substring(0, 200)
        });
        METADATA_MESSAGE_ID = result.message_id;
        console.log('✅ New metadata saved');
    } catch (error) {
        console.error('Save metadata error:', error.message);
    }
}

// ============================================================
// API HANDLER
// ============================================================
module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Load metadata if not loaded
    if (!metadataLoaded) {
        await loadMetadata();
        metadataLoaded = true;
    }

    const path = req.url.replace(/^\/api\/document-generator/, '').split('?')[0];

    try {
        // ============================================================
        // DOCUMENTS
        // ============================================================
        if (path === '/documents' && req.method === 'GET') {
            return res.status(200).json({ documents: data.documents });
        }

        if (path === '/documents/upload' && req.method === 'POST') {
            const { content, filename, metadata } = req.body;

            if (!content || !filename || !metadata) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Upload original content to Telegram
            const buffer = Buffer.from(content, 'utf-8');
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
                fields: metadata.fields || [],
                placeholders: metadata.placeholders || [],
                createdAt: new Date().toISOString()
            };

            data.documents.push(doc);
            await saveMetadata();

            return res.status(200).json({ success: true, document: doc });
        }

        if (path.startsWith('/documents/') && req.method === 'GET') {
            const docId = path.split('/')[2];
            const doc = data.documents.find(d => d.id === docId);
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
            const index = data.documents.findIndex(d => d.id === docId);
            if (index === -1) {
                return res.status(404).json({ error: 'Document not found' });
            }

            const updates = req.body;
            data.documents[index] = { ...data.documents[index], ...updates, updatedAt: new Date().toISOString() };
            await saveMetadata();

            return res.status(200).json({ success: true, document: data.documents[index] });
        }

        if (path.startsWith('/documents/') && req.method === 'DELETE') {
            const docId = path.split('/')[2];
            const index = data.documents.findIndex(d => d.id === docId);
            if (index === -1) {
                return res.status(404).json({ error: 'Document not found' });
            }

            const doc = data.documents[index];
            try {
                await bot.deleteMessage(CHAT_ID, doc.message_id);
            } catch (e) {
                console.warn('Could not delete from Telegram:', e.message);
            }

            data.documents.splice(index, 1);
            await saveMetadata();

            return res.status(200).json({ success: true });
        }

        // ============================================================
        // CATEGORIES
        // ============================================================
        if (path === '/categories' && req.method === 'GET') {
            return res.status(200).json({ categories: data.categories });
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
            data.categories.push(cat);
            await saveMetadata();

            return res.status(200).json({ success: true, category: cat });
        }

        if (path.startsWith('/categories/') && req.method === 'DELETE') {
            const catId = path.split('/')[2];
            const index = data.categories.findIndex(c => c.id === catId);
            if (index === -1) {
                return res.status(404).json({ error: 'Category not found' });
            }

            const docsInCategory = data.documents.filter(d => d.category === catId);
            if (docsInCategory.length > 0) {
                return res.status(400).json({
                    error: `Cannot delete: ${docsInCategory.length} documents use this category`
                });
            }

            data.categories.splice(index, 1);
            await saveMetadata();

            return res.status(200).json({ success: true });
        }

        // ============================================================
        // KEYWORDS
        // ============================================================
        if (path === '/keywords' && req.method === 'GET') {
            return res.status(200).json({ keywords: data.keywords });
        }

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

        // ============================================================
        // HEALTH
        // ============================================================
        if (path === '/health') {
            return res.status(200).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                documents: data.documents.length,
                categories: data.categories.length,
                keywords: data.keywords.length,
                metadata_message_id: METADATA_MESSAGE_ID
            });
        }

        return res.status(404).json({ error: 'Not found' });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message });
    }
};
