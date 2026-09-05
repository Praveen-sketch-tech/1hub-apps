// ============================================================
// ADMIN PAGE - Document Generator
// ============================================================

let allDocuments = [];
let allCategories = [];
let allKeywords = [];
let currentLang = 'en';
let editingDocId = null;

// ============================================================
// API CALLS
// ============================================================
async function apiCall(endpoint, options = {}) {
    const url = `/api/document-generator${endpoint}`;
    const response = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
}

// ============================================================
// ADMIN LOGIN
// ============================================================
function adminLogin() {
    const password = document.getElementById('adminPassword').value;
    if (password === 'admin123') {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'block';
        init();
    } else {
        document.getElementById('loginError').style.display = 'block';
    }
}

// Enter key support
document.getElementById('adminPassword').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') adminLogin();
});

// ============================================================
// LOAD DATA
// ============================================================
async function loadDocuments() {
    try {
        const data = await apiCall('/documents');
        allDocuments = data.documents || [];
        renderDocuments();
        updateDashboard();
    } catch (error) {
        showStatus('Failed to load documents: ' + error.message, 'error');
    }
}

async function loadCategories() {
    try {
        const data = await apiCall('/categories');
        allCategories = data.categories || [];
        renderCategories();
        populateCategorySelect();
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
}

async function loadKeywords() {
    try {
        const data = await apiCall('/keywords');
        allKeywords = data.keywords || [];
        renderKeywords();
    } catch (error) {
        console.error('Failed to load keywords:', error);
    }
}

// ============================================================
// DASHBOARD
// ============================================================
function updateDashboard() {
    const total = allDocuments.length;
    const active = allDocuments.filter(d => d.status === 'active').length;
    const cats = allCategories.length;
    const fields = allDocuments.reduce((sum, d) => sum + (d.fields?.length || 0), 0);
    
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statActive').textContent = active;
    document.getElementById('statCategories').textContent = cats;
    document.getElementById('statFields').textContent = fields;
}

// ============================================================
// DOCUMENTS CRUD
// ============================================================
function renderDocuments() {
    const container = document.getElementById('documentsList');
    if (allDocuments.length === 0) {
        container.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">No documents. Upload one!</p>';
        return;
    }
    
    container.innerHTML = allDocuments.map(doc => {
        const category = allCategories.find(c => c.id === doc.category);
        const statusBadge = doc.status === 'active' ? '✅ Active' : '⏸️ Inactive';
        const statusColor = doc.status === 'active' ? 'var(--success)' : 'var(--gray)';
        
        return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 15px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:10px;">
                <div>
                    <strong>${doc.name}</strong>
                    <span style="font-size:0.8rem;color:var(--gray);margin-left:10px;">
                        ${category?.icon || '📄'} ${category?.name || 'General'}
                    </span>
                    <span style="font-size:0.8rem;margin-left:10px;color:${statusColor};">
                        ${statusBadge}
                    </span>
                    <span style="font-size:0.8rem;color:var(--gray);margin-left:10px;">
                        ${doc.fields?.length || 0} fields
                    </span>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-primary" onclick="editDocument('${doc.id}')">✏️ Edit</button>
                    <button class="btn btn-sm ${doc.status === 'active' ? 'btn-warning' : 'btn-success'}" onclick="toggleDocumentStatus('${doc.id}')">
                        ${doc.status === 'active' ? '⏸️' : '▶️'}
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteDocument('${doc.id}')">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function editDocument(docId) {
    const doc = allDocuments.find(d => d.id === docId);
    if (!doc) return;
    
    editingDocId = docId;
    
    document.getElementById('editDocName').value = doc.name;
    document.getElementById('editDocNameHi').value = doc.name_hi || '';
    document.getElementById('editDocCategory').value = doc.category || '';
    document.getElementById('editDocDescription').value = doc.description || '';
    document.getElementById('editDocStatus').value = doc.status || 'active';
    document.getElementById('editDocFields').value = JSON.stringify(doc.fields || [], null, 2);
    
    document.getElementById('editModal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    editingDocId = null;
}

async function saveDocumentEdit() {
    if (!editingDocId) return;
    
    try {
        const name = document.getElementById('editDocName').value.trim();
        const nameHi = document.getElementById('editDocNameHi').value.trim();
        const category = document.getElementById('editDocCategory').value;
        const description = document.getElementById('editDocDescription').value.trim();
        const status = document.getElementById('editDocStatus').value;
        const fields = JSON.parse(document.getElementById('editDocFields').value || '[]');
        
        if (!name) {
            showStatus('Document name is required', 'error');
            return;
        }
        
        await apiCall(`/documents/${editingDocId}`, {
            method: 'PUT',
            body: JSON.stringify({ name, name_hi: nameHi, category, description, status, fields })
        });
        
        closeEditModal();
        await loadDocuments();
        showStatus('✅ Document updated!', 'success');
    } catch (error) {
        showStatus('❌ Update failed: ' + error.message, 'error');
    }
}

async function deleteDocument(docId) {
    if (!confirm('Delete this document permanently?')) return;
    try {
        await apiCall(`/documents/${docId}`, { method: 'DELETE' });
        await loadDocuments();
        showStatus('✅ Document deleted', 'success');
    } catch (error) {
        showStatus('❌ Delete failed: ' + error.message, 'error');
    }
}

async function toggleDocumentStatus(docId) {
    const doc = allDocuments.find(d => d.id === docId);
    if (!doc) return;
    const newStatus = doc.status === 'active' ? 'inactive' : 'active';
    try {
        await apiCall(`/documents/${docId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        await loadDocuments();
        showStatus(`✅ Document ${newStatus}`, 'success');
    } catch (error) {
        showStatus('❌ Failed to update status: ' + error.message, 'error');
    }
}

// ============================================================
// UPLOAD DOCUMENT
// ============================================================
async function uploadDocument() {
    const name = document.getElementById('docName').value.trim();
    const nameHi = document.getElementById('docNameHi').value.trim();
    const category = document.getElementById('docCategory').value;
    const description = document.getElementById('docDescription').value.trim();
    const status = document.getElementById('docStatus').value;
    const fileInput = document.getElementById('fileUpload');
    
    if (!name || !category || !fileInput.files[0]) {
        showStatus('Please fill all fields and select a file', 'error');
        return;
    }
    
    showStatus('Processing document...', 'loading');
    
    try {
        let content = '';
        const file = fileInput.files[0];
        
        if (file.name.endsWith('.docx')) {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            content = result.value;
        } else {
            content = await file.text();
        }
        
        const placeholders = content.match(/\{([^}]+)\}/g) || [];
        const uniquePlaceholders = [...new Set(placeholders.map(p => p.replace(/[{}]/g, '')))];
        
        const fields = uniquePlaceholders.map(ph => ({
            id: 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            key: ph,
            type: detectFieldType(ph),
            label: ph.replace(/_/g, ' ').toUpperCase(),
            label_hi: ph.replace(/_/g, ' '),
            required: true,
            placeholder: 'Enter ' + ph.replace(/_/g, ' '),
            placeholder_hi: ph.replace(/_/g, ' ') + ' दर्ज करें',
            order: uniquePlaceholders.indexOf(ph)
        }));
        
        const docId = 'doc_' + Date.now();
        const filename = name + '_' + Date.now() + '.txt';
        
        await apiCall('/documents/upload', {
            method: 'POST',
            body: JSON.stringify({
                content,
                filename,
                metadata: {
                    id: docId,
                    name,
                    name_hi: nameHi || name,
                    category,
                    description,
                    status,
                    fields,
                    placeholders: uniquePlaceholders
                }
            })
        });
        
        document.getElementById('docName').value = '';
        document.getElementById('docNameHi').value = '';
        document.getElementById('docDescription').value = '';
        document.getElementById('fileUpload').value = '';
        
        await loadDocuments();
        showStatus('✅ Document uploaded successfully!', 'success');
    } catch (error) {
        showStatus('❌ Upload failed: ' + error.message, 'error');
    }
}

function detectFieldType(key) {
    const types = {
        'date': ['date', 'dob', 'birthdate'],
        'number': ['amount', 'rent', 'price', 'number', 'age'],
        'email': ['email', 'mail'],
        'phone': ['phone', 'mobile', 'contact'],
        'textarea': ['address', 'description', 'notes']
    };
    for (const [type, keywords] of Object.entries(types)) {
        if (keywords.some(k => key.toLowerCase().includes(k))) return type;
    }
    return 'text';
}

// ============================================================
// CATEGORIES CRUD
// ============================================================
function renderCategories() {
    const container = document.getElementById('categoriesList');
    if (allCategories.length === 0) {
        container.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">No categories.</p>';
        return;
    }
    
    container.innerHTML = allCategories.map(cat => `
        <div class="category-card">
            <div class="icon">${cat.icon || '📂'}</div>
            <div class="name">${cat.name}</div>
            <div style="font-size:0.8rem;color:var(--gray);">${cat.name_hi || ''}</div>
            <div class="count">${allDocuments.filter(d => d.category === cat.id).length} docs</div>
            <div style="margin-top:10px;display:flex;gap:8px;justify-content:center;">
                <button class="btn btn-sm btn-danger" onclick="deleteCategory('${cat.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function populateCategorySelect() {
    const selects = ['docCategory', 'editDocCategory'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const currentVal = el.value;
            el.innerHTML = allCategories.map(cat => 
                `<option value="${cat.id}" ${cat.id === currentVal ? 'selected' : ''}>${cat.icon || '📄'} ${cat.name}</option>`
            ).join('');
        }
    });
}

async function addCategory() {
    const name = document.getElementById('newCategoryName').value.trim();
    const nameHi = document.getElementById('newCategoryNameHi').value.trim();
    const icon = document.getElementById('newCategoryIcon').value.trim() || '📂';
    const color = document.getElementById('newCategoryColor').value;
    
    if (!name) {
        showStatus('Please enter category name', 'error');
        return;
    }
    
    try {
        await apiCall('/categories', {
            method: 'POST',
            body: JSON.stringify({ name, name_hi: nameHi || name, icon, color })
        });
        document.getElementById('newCategoryName').value = '';
        document.getElementById('newCategoryNameHi').value = '';
        document.getElementById('newCategoryIcon').value = '';
        await loadCategories();
        showStatus('✅ Category added!', 'success');
    } catch (error) {
        showStatus('❌ Failed: ' + error.message, 'error');
    }
}

async function deleteCategory(catId) {
    const docCount = allDocuments.filter(d => d.category === catId).length;
    if (docCount > 0) {
        if (!confirm(`${docCount} documents use this category. Delete anyway?`)) return;
    } else {
        if (!confirm('Delete this category?')) return;
    }
    try {
        await apiCall(`/categories/${catId}`, { method: 'DELETE' });
        await loadCategories();
        showStatus('✅ Category deleted', 'success');
    } catch (error) {
        showStatus('❌ Delete failed: ' + error.message, 'error');
    }
}

// ============================================================
// KEYWORDS CRUD
// ============================================================
function renderKeywords() {
    const container = document.getElementById('keywordsList');
    if (allKeywords.length === 0) {
        container.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">No keywords.</p>';
        return;
    }
    
    container.innerHTML = allKeywords.map(kw => `
        <span class="keyword-tag">
            ${kw.name}
            <span style="font-size:0.7rem;color:var(--gray);">(${kw.type})</span>
            <span class="remove" onclick="deleteKeyword('${kw.id}')">×</span>
        </span>
    `).join('');
}

async function addKeyword() {
    const name = document.getElementById('newKeyword').value.trim();
    const type = document.getElementById('newKeywordType').value;
    
    if (!name) {
        showStatus('Please enter keyword', 'error');
        return;
    }
    
    try {
        await apiCall('/keywords', {
            method: 'POST',
            body: JSON.stringify({ name, type })
        });
        document.getElementById('newKeyword').value = '';
        await loadKeywords();
        showStatus('✅ Keyword added!', 'success');
    } catch (error) {
        showStatus('❌ Failed: ' + error.message, 'error');
    }
}

async function deleteKeyword(kwId) {
    if (!confirm('Delete this keyword?')) return;
    try {
        await apiCall(`/keywords/${kwId}`, { method: 'DELETE' });
        await loadKeywords();
        showStatus('✅ Keyword deleted', 'success');
    } catch (error) {
        showStatus('❌ Delete failed: ' + error.message, 'error');
    }
}

// ============================================================
// UI HELPERS
// ============================================================
function showStatus(message, type = 'info') {
    const bar = document.getElementById('statusBar');
    bar.textContent = message;
    bar.className = 'status-bar ' + type;
    bar.style.display = 'block';
    if (type !== 'loading') {
        setTimeout(() => { bar.style.display = 'none'; }, 5000);
    }
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`).classList.add('active');
    if (tab === 'documents') renderDocuments();
    if (tab === 'categories') renderCategories();
    if (tab === 'keywords') renderKeywords();
}

function setLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.includes(lang.toUpperCase())) btn.classList.add('active');
    });
}

// ============================================================
// EXPORT/IMPORT
// ============================================================
async function exportData() {
    try {
        const docs = await apiCall('/documents');
        const cats = await apiCall('/categories');
        const keys = await apiCall('/keywords');
        const data = {
            documents: docs.documents || [],
            categories: cats.categories || [],
            keywords: keys.keywords || [],
            exportDate: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `documents_backup_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        showStatus('✅ Data exported!', 'success');
    } catch (error) {
        showStatus('❌ Export failed: ' + error.message, 'error');
    }
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            showStatus('⚠️ Import via API coming soon. Use Admin UI.', 'info');
        } catch (error) {
            showStatus('❌ Import failed: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ============================================================
// INIT
// ============================================================
async function init() {
    await loadCategories();
    await loadKeywords();
    await loadDocuments();
}

// ============================================================
// LOAD SETTINGS FROM ENV (No frontend tokens!)
// ============================================================
// TG_TOKEN and TG_CHAT_ID are ONLY used server-side via Vercel env vars.
// Frontend never sees them.
