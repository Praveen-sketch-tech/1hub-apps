// ============================================================
// USER PAGE - Document Generator
// ============================================================

let allDocuments = [];
let allCategories = [];
let currentLang = 'en';
let currentDocId = null;
let currentDocument = null;

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
                    ${category?.icon || '📄'} ${escapeHtml(currentLang === 'hi' ? (category?.name_hi || category?.name || 'General') : category?.name || 'General')}
                </span>
                <div class="doc-name">${escapeHtml(currentLang === 'hi' ? (doc.name_hi || doc.name) : doc.name)}</div>
                <div class="doc-desc">${escapeHtml(doc.description || '')}</div>
                <div class="doc-fields">📝 ${fieldCount} field${fieldCount > 1 ? 's' : ''}</div>
                <div class="doc-actions">
                    <button class="btn btn-primary" onclick="event.stopPropagation(); selectDocument('${doc.id}')">✏️ Fill</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderCategoryFilters() {
    const container = document.getElementById('categoryFilters');
    const filterHtml = allCategories.map(cat => `
        <div class="category-card" onclick="filterByCategory('${cat.id}')" style="cursor:pointer;">
            <div class="icon">${escapeHtml(cat.icon || '📂')}</div>
            <div class="name">${escapeHtml(currentLang === 'hi' ? (cat.name_hi || cat.name) : cat.name)}</div>
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
            🔍 No documents found for "${escapeHtml(query)}"
        </div>`;
        return;
    }
    grid.innerHTML = filtered.map((doc) => {
        const category = allCategories.find(c => c.id === doc.category);
        return `
            <div class="doc-card" onclick="selectDocument('${doc.id}')">
                <span class="category-tag" style="background:${category?.color || '#667eea'}">
                    ${category?.icon || '📄'} ${escapeHtml(currentLang === 'hi' ? (category?.name_hi || category?.name || 'General') : category?.name || 'General')}
                </span>
                <div class="doc-name">${escapeHtml(currentLang === 'hi' ? (doc.name_hi || doc.name) : doc.name)}</div>
                <div class="doc-desc">${escapeHtml(doc.description || '')}</div>
                <div class="doc-fields">📝 ${doc.fields?.length || 0} fields</div>
                <div class="doc-actions">
                    <button class="btn btn-primary" onclick="event.stopPropagation(); selectDocument('${doc.id}')">✏️ Fill</button>
                </div>
            </div>
        `;
    }).join('');
}

async function selectDocument(docId) {
    currentDocId = docId;
    const doc = allDocuments.find(d => d.id === docId);
    if (!doc) return;
    currentDocument = doc;
    switchTab('fill');
    document.getElementById('fillingDocTitle').textContent = `📝 ${escapeHtml(currentLang === 'hi' ? (doc.name_hi || doc.name) : doc.name)}`;
    document.getElementById('previewArea').style.display = 'none';
    showStatus('Loading document...', 'loading');
    try {
        const data = await apiCall(`/documents/${docId}`);
        const docData = data.document;
        if (!docData) {
            throw new Error('No document data received');
        }
        let content = '';
        const isDocx = doc.filename && doc.filename.endsWith('.docx');
        const isTxt = doc.filename && doc.filename.endsWith('.txt');
        if (isDocx && docData.contentBase64) {
            const binaryString = atob(docData.contentBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const arrayBuffer = bytes.buffer;
            const result = await mammoth.extractRawText({ arrayBuffer });
            content = result.value;
        } else if (isTxt && docData.textContent) {
            content = docData.textContent;
        } else if (docData.contentBase64) {
            try {
                content = atob(docData.contentBase64);
            } catch (e) {
                throw new Error('Cannot extract text from this document type');
            }
        } else {
            throw new Error('No content available for this document');
        }
        if (!content || content.trim() === '') {
            throw new Error('Document content is empty');
        }
        doc._content = content;
        generateForm(doc, content);
        showStatus('✅ Document loaded successfully!', 'success');
    } catch (error) {
        showStatus('❌ Failed to load document: ' + error.message, 'error');
    }
}

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
        const requiredAttr = field.required ? ' required' : '';
        switch(field.type) {
            case 'date':
                input = `<input type="date" id="field_${field.key}"${requiredAttr} oninput="updatePreview()">`;
                break;
            case 'number':
                input = `<input type="number" id="field_${field.key}" placeholder="${escapeHtml(placeholder)}"${requiredAttr} oninput="updatePreview()">`;
                break;
            case 'textarea':
                input = `<textarea id="field_${field.key}" placeholder="${escapeHtml(placeholder)}"${requiredAttr} oninput="updatePreview()" rows="3"></textarea>`;
                break;
            case 'email':
                input = `<input type="email" id="field_${field.key}" placeholder="${escapeHtml(placeholder)}"${requiredAttr} oninput="updatePreview()">`;
                break;
            default:
                input = `<input type="text" id="field_${field.key}" placeholder="${escapeHtml(placeholder)}"${requiredAttr} oninput="updatePreview()">`;
        }
        return `
            <div class="form-group">
                <label>${escapeHtml(label)} ${field.required ? '<span class="required">*</span>' : ''}</label>
                ${input}
            </div>
        `;
    }).join('') + `<button class="btn btn-primary" onclick="updatePreview()">👁️ Preview</button>`;
}

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
            const key = field.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filledContent = filledContent.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }
    });
    const previewEl = document.getElementById('previewContent');
    previewEl.innerHTML = formatDocumentContent(filledContent);
    document.getElementById('previewArea').style.display = 'block';
    window.currentPreviewContent = filledContent;
}

function formatDocumentContent(text) {
    let html = escapeHtml(text)
        .replace(/^([A-Z][A-Z\s]{4,})$/gm, '<h2>$1</h2>')
        .replace(/^([A-Z][A-Z\s]{2,}):/gm, '<h3>$1:</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/__(.+?)__/g, '<b>$1</b>')
        .replace(/\*(.+?)\*/g, '<i>$1</i>')
        .replace(/_(.+?)_/g, '<i>$1</i>')
        .replace(/\+\+(.+?)\+\+/g, '<u>$1</u>')
        .replace(/^(\d+\.)\s(.+)$/gm, '<li>$1 $2</li>')
        .replace(/^[-*]\s(.+)$/gm, '<li>• $1</li>')
        .replace(/^[-]{3,}$/gm, '<hr>')
        .split('\n\n')
        .map(p => p.trim())
        .filter(p => p)
        .map(p => {
            if (p.includes('<li>')) return `<ul>${p}</ul>`;
            if (p.startsWith('<h')) return p;
            return `<p>${p}</p>`;
        })
        .join('\n');
    html = html.replace(/<p>(<li>.*?<\/li>)<\/p>/g, '<ul>$1</ul>');
    html = html.replace(/<ul>\s*<ul>/g, '<ul>');
    return html;
}

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
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        const maxWidth = pageWidth - 2 * margin;
        const lineHeight = 6;
        let y = margin;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        let textToSplit = '';
        const children = tempDiv.childNodes;
        for (const node of children) {
            if (node.nodeType === 3) textToSplit += node.textContent;
            else if (node.tagName === 'P') textToSplit += node.textContent + '\n\n';
            else if (node.tagName === 'H2') textToSplit += node.textContent + '\n\n';
            else if (node.tagName === 'H3') textToSplit += node.textContent + '\n\n';
            else if (node.tagName === 'UL') {
                const items = node.querySelectorAll('li');
                items.forEach(li => textToSplit += '  • ' + li.textContent + '\n');
                textToSplit += '\n';
            }
        }
        const splitLines = doc.splitTextToSize(textToSplit, maxWidth);
        for (let i = 0; i < splitLines.length; i++) {
            const line = splitLines[i];
            if (y + lineHeight > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }
            doc.text(line, margin, y);
            y += lineHeight;
        }
        const filename = currentDocument ? 
            `${currentDocument.name}_${new Date().toISOString().split('T')[0]}.pdf` : 
            'document.pdf';
        doc.save(filename);
        showStatus('✅ PDF downloaded successfully!', 'success');
    } catch (error) {
        showStatus('❌ Error generating PDF: ' + error.message, 'error');
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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

async function init() {
    await loadCategories();
    await loadDocuments();
    document.getElementById('searchInput').addEventListener('input', searchDocuments);
}

document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        updatePreview();
    }
});

document.addEventListener('DOMContentLoaded', init);
