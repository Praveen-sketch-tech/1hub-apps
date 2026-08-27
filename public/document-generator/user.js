// ============================================================
// USER PAGE - Document Generator
// ============================================================

let allDocuments = [];
let allCategories = [];
let currentLang = 'en';
let currentDocId = null;
let currentDocument = null;

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
// LOAD DATA
// ============================================================
async function loadDocuments() {
    try {
        const data = await apiCall('/documents');
        allDocuments = data.documents || [];
        renderDocuments();
        updateTotalCount();
    } catch (error) {
        showStatus('Failed to load documents: ' + error.message, 'error');
    }
}

async function loadCategories() {
    try {
        const data = await apiCall('/categories');
        allCategories = data.categories || [];
        renderCategoryFilters();
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
}

// ============================================================
// RENDER DOCUMENTS
// ============================================================
function renderDocuments(filter = 'All') {
    const grid = document.getElementById('documentsGrid');
    let filtered = allDocuments.filter(d => d.status !== 'inactive');
    
    if (filter !== 'All') {
        filtered = filtered.filter(d => d.category === filter);
    }
    
    if (filtered.length === 0) {
        grid.innerHTML = `<div style="text-align:center;padding:50px;color:#999;grid-column:1/-1;">
            📭 No documents available.
        </div>`;
        return;
    }
    
    grid.innerHTML = filtered.map((doc) => {
        const category = allCategories.find(c => c.id === doc.category);
        const fieldCount = doc.fields?.length || 0;
        
        return `
            <div class="doc-card" onclick="selectDocument('${doc.id}')">
                <span class="category-tag" style="background:${category?.color || '#667eea'}">
                    ${category?.icon || '📄'} ${currentLang === 'hi' ? (category?.name_hi || category?.name || 'General') : category?.name || 'General'}
                </span>
                <div class="doc-name">${currentLang === 'hi' ? (doc.name_hi || doc.name) : doc.name}</div>
                <div class="doc-desc">${doc.description || ''}</div>
                <div class="doc-fields">📝 ${fieldCount} field${fieldCount > 1 ? 's' : ''}</div>
                <div class="doc-actions">
                    <button class="btn btn-primary" onclick="event.stopPropagation(); selectDocument('${doc.id}')">✏️ Fill</button>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================
// CATEGORY FILTERS
// ============================================================
function renderCategoryFilters() {
    const container = document.getElementById('categoryFilters');
    const filterHtml = allCategories.map(cat => `
        <div class="category-card" onclick="filterByCategory('${cat.id}')" style="cursor:pointer;">
            <div class="icon">${cat.icon || '📂'}</div>
            <div class="name">${currentLang === 'hi' ? (cat.name_hi || cat.name) : cat.name}</div>
            <div class="count">${allDocuments.filter(d => d.category === cat.id && d.status !== 'inactive').length} docs</div>
        </div>
    `).join('');
    
    container.innerHTML = `
        <div class="category-card" onclick="filterByCategory('All')" style="cursor:pointer;">
            <div class="icon">📚</div>
            <div class="name">All</div>
            <div class="count" id="totalDocs">${allDocuments.filter(d => d.status !== 'inactive').length} documents</div>
        </div>
        ${filterHtml}
    `;
}

function filterByCategory(category) {
    renderDocuments(category);
}

function updateTotalCount() {
    const el = document.getElementById('totalDocs');
    if (el) {
        el.textContent = allDocuments.filter(d => d.status !== 'inactive').length + ' documents';
    }
}

// ============================================================
// SEARCH
// ============================================================
function searchDocuments() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const grid = document.getElementById('documentsGrid');
    
    let filtered = allDocuments.filter(d => d.status !== 'inactive');
    
    if (query) {
        filtered = filtered.filter(d => 
            d.name.toLowerCase().includes(query) || 
            (d.description && d.description.toLowerCase().includes(query))
        );
    }
    
    if (filtered.length === 0) {
        grid.innerHTML = `<div style="text-align:center;padding:50px;color:#999;grid-column:1/-1;">
            🔍 No documents found for "${query}"
        </div>`;
        return;
    }
    
    grid.innerHTML = filtered.map((doc) => {
        const category = allCategories.find(c => c.id === doc.category);
        return `
            <div class="doc-card" onclick="selectDocument('${doc.id}')">
                <span class="category-tag" style="background:${category?.color || '#667eea'}">
                    ${category?.icon || '📄'} ${currentLang === 'hi' ? (category?.name_hi || category?.name || 'General') : category?.name || 'General'}
                </span>
                <div class="doc-name">${currentLang === 'hi' ? (doc.name_hi || doc.name) : doc.name}</div>
                <div class="doc-desc">${doc.description || ''}</div>
                <div class="doc-fields">📝 ${doc.fields?.length || 0} fields</div>
                <div class="doc-actions">
                    <button class="btn btn-primary" onclick="event.stopPropagation(); selectDocument('${doc.id}')">✏️ Fill</button>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================
// SELECT DOCUMENT
// ============================================================
async function selectDocument(docId) {
    currentDocId = docId;
    const doc = allDocuments.find(d => d.id === docId);
    if (!doc) return;
    
    currentDocument = doc;
    switchTab('fill');
    
    document.getElementById('fillingDocTitle').textContent = `📝 ${currentLang === 'hi' ? (doc.name_hi || doc.name) : doc.name}`;
    document.getElementById('previewArea').style.display = 'none';
    
    showStatus('Loading document...', 'loading');
    
    try {
        const data = await apiCall(`/documents/${docId}`);
        const content = data.document?.content;
        
        if (!content) {
            throw new Error('No content received');
        }
        
        doc._content = content;
        generateForm(doc, content);
        showStatus('✅ Document loaded successfully!', 'success');
    } catch (error) {
        showStatus('❌ Failed to load document: ' + error.message, 'error');
    }
}

// ============================================================
// GENERATE FORM
// ============================================================
function generateForm(doc, content) {
    const container = document.getElementById('formFields');
    
    if (!doc.fields || doc.fields.length === 0) {
        container.innerHTML = '<p style="color:#999;">No fields found in this document.</p>';
        return;
    }
    
    const sortedFields = [...doc.fields].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    container.innerHTML = sortedFields.map(field => {
        const label = currentLang === 'hi' ? (field.label_hi || field.label) : field.label;
        const placeholder = currentLang === 'hi' ? (field.placeholder_hi || field.placeholder) : field.placeholder;
        
        let input = '';
        switch(field.type) {
            case 'date':
                input = `<input type="date" id="field_${field.key}" oninput="updatePreview()">`;
                break;
            case 'number':
                input = `<input type="number" id="field_${field.key}" placeholder="${placeholder}" oninput="updatePreview()">`;
                break;
            case 'textarea':
                input = `<textarea id="field_${field.key}" placeholder="${placeholder}" oninput="updatePreview()" rows="3"></textarea>`;
                break;
            case 'email':
                input = `<input type="email" id="field_${field.key}" placeholder="${placeholder}" oninput="updatePreview()">`;
                break;
            default:
                input = `<input type="text" id="field_${field.key}" placeholder="${placeholder}" oninput="updatePreview()">`;
        }
        
        return `
            <div class="form-group">
                <label>${label} ${field.required ? '<span class="required">*</span>' : ''}</label>
                ${input}
            </div>
        `;
    }).join('') + `<button class="btn btn-primary" onclick="updatePreview()">👁️ Preview</button>`;
}

// ============================================================
// PREVIEW
// ============================================================
function updatePreview() {
    const doc = currentDocument;
    if (!doc || !doc._content) {
        showStatus('Please select a document first', 'error');
        return;
    }

    let filledContent = doc._content;
    
    doc.fields.forEach(field => {
        const el = document.getElementById(`field_${field.key}`);
        const value = el?.value || '';
        if (value) {
            filledContent = filledContent.replace(new RegExp(`\\{${field.key}\\}`, 'g'), value);
        }
    });

    // Format content with proper styling
    const previewEl = document.getElementById('previewContent');
    previewEl.innerHTML = formatDocumentContent(filledContent);
    document.getElementById('previewArea').style.display = 'block';
    window.currentPreviewContent = filledContent;
}

// ============================================================
// FORMAT DOCUMENT CONTENT - Preserve formatting
// ============================================================
function formatDocumentContent(text) {
    let html = text
        // Headers
        .replace(/^([A-Z][A-Z\s]{4,})$/gm, '<h2>$1</h2>')
        .replace(/^([A-Z][A-Z\s]{2,}):/gm, '<h3>$1:</h3>')
        // Bold: **text** or __text__
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/__(.+?)__/g, '<b>$1</b>')
        // Italic: *text* or _text_
        .replace(/\*(.+?)\*/g, '<i>$1</i>')
        .replace(/_(.+?)_/g, '<i>$1</i>')
        // Underline: ++text++ (new syntax to avoid conflicts)
        .replace(/\+\+(.+?)\+\+/g, '<u>$1</u>')
        // Numbered lists
        .replace(/^(\d+\.)\s(.+)$/gm, '<li>$1 $2</li>')
        // Bullet lists
        .replace(/^[-*]\s(.+)$/gm, '<li>• $1</li>')
        // Separators
        .replace(/^[-]{3,}$/gm, '<hr>')
        // Paragraphs
        .split('\n\n')
        .map(p => p.trim())
        .filter(p => p)
        .map(p => {
            if (p.includes('<li>')) return `<ul>${p}</ul>`;
            if (p.startsWith('<h')) return p;
            return `<p>${p}</p>`;
        })
        .join('\n');
    
    html = html.replace(/<p>(<li>.*?<\/li>)/g, '<ul>$1');
    html = html.replace(/(<\/li>)<\/p>/g, '$1</ul>');
    
    return html;
}

// ============================================================
// GENERATE ACTUAL PDF - Using jsPDF
// ============================================================
function generatePDF() {
    updatePreview();
    downloadPDF();
}

function downloadPDF() {
    const content = document.getElementById('previewContent').innerHTML;
    if (!content || content.trim() === '') {
        showStatus('Please fill the form and generate preview first!', 'error');
        return;
    }

    try {
        // Use jsPDF for actual PDF generation
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        // Get clean text from preview
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        
        // Add to PDF with proper formatting
        const lines = doc.splitTextToSize(textContent, 180);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(lines, 15, 20);
        
        const filename = currentDocument ? 
            `${currentDocument.name}_${new Date().toISOString().split('T')[0]}.pdf` : 
            'document.pdf';
        
        doc.save(filename);
        showStatus('✅ PDF downloaded successfully!', 'success');
    } catch (error) {
        showStatus('❌ Error generating PDF: ' + error.message, 'error');
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
}

function setLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.includes(lang.toUpperCase())) btn.classList.add('active');
    });
    renderDocuments();
    renderCategoryFilters();
    if (currentDocId) selectDocument(currentDocId);
}

// ============================================================
// INIT
// ============================================================
async function init() {
    await loadCategories();
    await loadDocuments();
    document.getElementById('searchInput').addEventListener('input', searchDocuments);
}

// Keyboard shortcut: Ctrl+Enter to preview
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        updatePreview();
    }
});

document.addEventListener('DOMContentLoaded', init);
