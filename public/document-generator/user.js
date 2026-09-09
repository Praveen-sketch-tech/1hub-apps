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
            // Keep the ORIGINAL, unmodified DOCX bytes around. mammoth's
            // extractRawText() below is used only for the live preview/field
            // discovery text - it is plain text and cannot be turned back
            // into a formatted DOCX. The separate "Original Formatting"
            // download path (downloadOriginalFormatWord) works directly on
            // these original bytes instead, so it never goes through the
            // lossy DOCX -> plain text -> HTML -> DOCX round trip.
            doc._originalDocxBase64 = docData.contentBase64;
            doc._isOriginalDocx = true;
            const binaryString = atob(docData.contentBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const arrayBuffer = bytes.buffer;
            // Keep plain text for field discovery / existing form logic.
            const result = await mammoth.extractRawText({ arrayBuffer });
            content = result.value;

            // Build preview directly from the original WordprocessingML.
            // This preserves run-level formatting instead of asking Mammoth
            // to reinterpret the document.
            try {
                const { readZipUniversal } = await import('/turbodocx-test/docx-postprocess.js');
                doc._formattedHtml = await buildOriginalDocxPreview(arrayBuffer, readZipUniversal);
            } catch (previewError) {
                console.warn('DOCX formatting preview failed:', previewError);
                doc._formattedHtml = '';
            }
        } else if (isTxt && docData.textContent) {
            doc._isOriginalDocx = false;
            content = docData.textContent;
        } else if (docData.contentBase64) {
            doc._isOriginalDocx = false;
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


/* -------------------------------------------------------------------------
 * Original DOCX -> Preview HTML
 *
 * Reads the original WordprocessingML instead of DOCX -> plain text -> HTML.
 * The generated HTML uses explicit inline formatting for every run.
 * ---------------------------------------------------------------------- */

async function buildOriginalDocxPreview(arrayBuffer, readZipUniversal) {
    const bytes = new Uint8Array(arrayBuffer);
    const entries = await readZipUniversal(bytes);
    const entry = entries.find(e => e.name === 'word/document.xml');

    if (!entry) throw new Error('word/document.xml not found');

    const xml = new TextDecoder('utf-8').decode(entry.data);
    const parser = new DOMParser();
    const docXml = parser.parseFromString(xml, 'application/xml');

    if (docXml.querySelector('parsererror')) {
        throw new Error('Invalid Word document XML');
    }

    const body = docXml.getElementsByTagNameNS(
        'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
        'body'
    )[0];

    if (!body) throw new Error('Word document body not found');

    const html = [];

    for (const child of Array.from(body.children)) {
        const name = child.localName;

        if (name === 'p') {
            html.push(renderDocxParagraph(child));
        } else if (name === 'tbl') {
            html.push(renderDocxTable(child));
        }
    }

    return html.join('');
}

function docxAttr(el, name) {
    if (!el) return '';
    return el.getAttributeNS(
        'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
        name
    ) || el.getAttribute('w:' + name) || '';
}

function docxChild(el, name) {
    if (!el) return null;

    for (const child of Array.from(el.children)) {
        if (child.localName === name) return child;
    }

    return null;
}

function docxChildren(el, name) {
    if (!el) return [];
    return Array.from(el.children).filter(x => x.localName === name);
}

function docxBool(el) {
    if (!el) return false;
    const v = docxAttr(el, 'val');
    return !(v === '0' || v === 'false' || v === 'off' || v === 'none');
}

function docxEscape(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderDocxParagraph(p) {
    const pPr = docxChild(p, 'pPr');
    const style = [];

    const jc = docxChild(pPr, 'jc');
    const alignment = jc ? docxAttr(jc, 'val') : '';

    if (alignment === 'center') style.push('text-align:center');
    else if (alignment === 'right') style.push('text-align:right');
    else if (alignment === 'both' || alignment === 'justify')
        style.push('text-align:justify');
    else style.push('text-align:left');

    const ind = docxChild(pPr, 'ind');
    if (ind) {
        const left = parseInt(docxAttr(ind, 'left') || '0', 10);
        const right = parseInt(docxAttr(ind, 'right') || '0', 10);
        const first = parseInt(docxAttr(ind, 'firstLine') || '0', 10);
        const hanging = parseInt(docxAttr(ind, 'hanging') || '0', 10);

        if (left) style.push(`margin-left:${left / 15}px`);
        if (right) style.push(`margin-right:${right / 15}px`);
        if (first) style.push(`text-indent:${first / 15}px`);
        if (hanging) style.push(`text-indent:-${hanging / 15}px`);
    }

    const spacing = docxChild(pPr, 'spacing');
    if (spacing) {
        const before = parseInt(docxAttr(spacing, 'before') || '0', 10);
        const after = parseInt(docxAttr(spacing, 'after') || '0', 10);
        const line = parseInt(docxAttr(spacing, 'line') || '0', 10);

        if (before) style.push(`margin-top:${before / 20}pt`);
        if (after) style.push(`margin-bottom:${after / 20}pt`);
        if (line) style.push(`line-height:${Math.max(1, line / 240)}`);
    }

    const runs = [];
    for (const child of Array.from(p.children)) {
        if (child.localName === 'r') {
            runs.push(renderDocxRun(child));
        } else if (child.localName === 'hyperlink') {
            for (const r of docxChildren(child, 'r')) {
                runs.push(renderDocxRun(r));
            }
        }
    }

    // Explicit paragraph break/page-break handling.
    const hasPageBreak = p.querySelector('br[type="page"]') ||
                         p.querySelector('lastRenderedPageBreak');

    if (hasPageBreak) {
        style.push('page-break-before:always');
    }

    return `<p style="${style.join(';')};margin-top:0">${runs.join('')}</p>`;
}

function renderDocxRun(r) {
    const rPr = docxChild(r, 'rPr');
    const style = [];

    const bold = docxChild(rPr, 'b');
    const boldCs = docxChild(rPr, 'bCs');
    const italic = docxChild(rPr, 'i');
    const italicCs = docxChild(rPr, 'iCs');
    const underline = docxChild(rPr, 'u');
    const strike = docxChild(rPr, 'strike');

    style.push(`font-weight:${(docxBool(bold) || docxBool(boldCs)) ? '700' : '400'}`);
    style.push(`font-style:${(docxBool(italic) || docxBool(italicCs)) ? 'italic' : 'normal'}`);

    if (underline && docxAttr(underline, 'val') !== 'none') {
        style.push('text-decoration:underline');
    } else if (strike && docxBool(strike)) {
        style.push('text-decoration:line-through');
    } else {
        style.push('text-decoration:none');
    }

    const color = docxChild(rPr, 'color');
    const colorValue = color ? docxAttr(color, 'val') : '';
    if (colorValue && colorValue !== 'auto') {
        style.push(`color:#${colorValue}`);
    }

    const sz = docxChild(rPr, 'sz');
    const size = sz ? parseInt(docxAttr(sz, 'val') || '0', 10) : 0;
    if (size) style.push(`font-size:${size / 2}pt`);

    const fonts = docxChild(rPr, 'rFonts');
    if (fonts) {
        const font =
            docxAttr(fonts, 'ascii') ||
            docxAttr(fonts, 'hAnsi') ||
            docxAttr(fonts, 'cs') ||
            docxAttr(fonts, 'eastAsia');

        if (font) {
            style.push(`font-family:${JSON.stringify(font)}`);
        }
    }

    const vert = docxChild(rPr, 'vertAlign');
    if (vert) {
        const v = docxAttr(vert, 'val');
        if (v === 'superscript') style.push('vertical-align:super');
        if (v === 'subscript') style.push('vertical-align:sub');
    }

    const text = [];

    for (const child of Array.from(r.children)) {
        if (child.localName === 't') {
            text.push(docxEscape(child.textContent || ''));
        } else if (child.localName === 'tab') {
            text.push('&emsp;');
        } else if (child.localName === 'br') {
            const type = docxAttr(child, 'type');
            text.push(type === 'page'
                ? '<br style="page-break-after:always">'
                : '<br>');
        } else if (child.localName === 'noBreakHyphen') {
            text.push('-');
        }
    }

    if (!text.length) return '';

    return `<span style="${style.join(';')}">${text.join('')}</span>`;
}

function renderDocxTable(tbl) {
    const rows = [];

    for (const tr of docxChildren(tbl, 'tr')) {
        const cells = [];

        for (const tc of docxChildren(tr, 'tc')) {
            const tcPr = docxChild(tc, 'tcPr');
            const width = docxChild(tcPr, 'tcW');
            const cellStyle = [];

            const widthValue = width ? parseInt(docxAttr(width, 'w') || '0', 10) : 0;
            if (widthValue) cellStyle.push(`width:${widthValue / 15}px`);

            const vAlign = docxChild(tcPr, 'vAlign');
            if (vAlign) {
                const v = docxAttr(vAlign, 'val');
                if (v === 'center') cellStyle.push('vertical-align:middle');
                else if (v === 'bottom') cellStyle.push('vertical-align:bottom');
                else cellStyle.push('vertical-align:top');
            }

            const paragraphs = [];
            for (const p of docxChildren(tc, 'p')) {
                paragraphs.push(renderDocxParagraph(p));
            }

            cells.push(
                `<td style="${cellStyle.join(';')}">${paragraphs.join('')}</td>`
            );
        }

        rows.push(`<tr>${cells.join('')}</tr>`);
    }

    return `<table style="border-collapse:collapse;width:100%"><tbody>${rows.join('')}</tbody></table>`;
}

function updatePreview() {
    const doc = currentDocument;
    if (!doc || !doc._content) {
        showStatus('Please select a document first', 'error');
        return;
    }

    const values = {};

    doc.fields.forEach(field => {
        const el = document.getElementById(`field_${field.key}`);
        values[field.key] = el?.value || '';
    });

    // DOCX preview uses HTML generated directly from the original
    // WordprocessingML. Every run gets explicit formatting so a bold run
    // cannot accidentally make the following normal run bold.
    if (doc._isOriginalDocx && doc._formattedHtml) {
        let html = doc._formattedHtml;

        doc.fields.forEach(field => {
            const value = values[field.key];
            if (!value) return;

            const key = field.key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&');
            const placeholderRegex = new RegExp(
                `\\{\\{${key}\\}\\}|\\{${key}\\}`,
                'g'
            );

            html = html.replace(
                placeholderRegex,
                () => escapeHtml(value).replace(/\\n/g, '<br>')
            );
        });

        const previewEl = document.getElementById('previewContent');
        previewEl.innerHTML = html;
        document.getElementById('previewArea').style.display = 'block';

        let filledContent = doc._content;
        doc.fields.forEach(field => {
            const value = values[field.key];
            if (!value) return;

            const key = field.key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&');
            filledContent = filledContent.replace(
                new RegExp(`\\{{1,2}${key}\\}{1,2}`, 'g'),
                value
            );
        });

        window.currentPreviewContent = filledContent;
        return;
    }

    // Existing TXT / legacy fallback path.
    let filledContent = doc._content;

    doc.fields.forEach(field => {
        const value = values[field.key];
        if (!value) return;

        const key = field.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filledContent = filledContent.replace(
            new RegExp(`\\{{1,2}${key}\\}{1,2}`, 'g'),
            value
        );
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

// ============================================================
// ROOT CAUSE FIX (Issue #5 - Hindi/Devanagari PDF blank/garbled):
// jsPDF's built-in fonts (Helvetica/Times etc.) have NO Devanagari glyphs,
// so any Hindi text rendered with doc.text() using the default font comes
// out blank or as garbled boxes. We lazily fetch the Devanagari-capable
// Noto font already shipped at public/shared/fonts/, embed it into the
// jsPDF virtual filesystem, and switch to it only when the content being
// printed actually contains Devanagari characters (U+0900-U+097F) - plain
// English documents keep using the default font untouched.
// ============================================================
const DEVANAGARI_REGEX = /[\u0900-\u097F]/;
const DEVANAGARI_FONT_URL = '/shared/fonts/noto-sans-devanagari-regular.ttf';
const DEVANAGARI_FONT_VFS_NAME = 'NotoSansDevanagari-Regular.ttf';
const DEVANAGARI_FONT_ALIAS = 'NotoDevanagari';

let devanagariFontBase64 = null;
let devanagariFontLoadPromise = null;

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

async function ensureDevanagariFont(doc) {
    if (!devanagariFontLoadPromise) {
        devanagariFontLoadPromise = fetch(DEVANAGARI_FONT_URL)
            .then(response => {
                if (!response.ok) throw new Error(`Font fetch failed: HTTP ${response.status}`);
                return response.arrayBuffer();
            })
            .then(buffer => {
                devanagariFontBase64 = arrayBufferToBase64(buffer);
            });
    }
    await devanagariFontLoadPromise;
    doc.addFileToVFS(DEVANAGARI_FONT_VFS_NAME, devanagariFontBase64);
    doc.addFont(DEVANAGARI_FONT_VFS_NAME, DEVANAGARI_FONT_ALIAS, 'normal');
}

async function downloadWord() {
    const content = document.getElementById('previewContent').innerHTML;

    if (!content || content.trim() === '') {
        showStatus('Please fill the form and generate preview first!', 'error');
        return;
    }

    if (typeof window.generateDocx !== 'function') {
        showStatus('❌ Word generator is not loaded. Please refresh the page.', 'error');
        return;
    }

    const generateButton = document.getElementById('generateWordBtn');
    const downloadButton = document.getElementById('downloadReadyWordBtn');

    if (generateButton) {
        generateButton.disabled = true;
        generateButton.textContent = '⏳ Generating Word...';
    }

    if (downloadButton) {
        downloadButton.style.display = 'none';
    }

    try {
        const filename = currentDocument
            ? `${currentDocument.name}_${new Date().toISOString().split('T')[0]}.docx`
            : 'document.docx';

        const result = await window.generateDocx(content, filename);

        if (!result || !result.filename) {
            throw new Error('DOCX was generated but is not ready for download.');
        }

        if (downloadButton) {
            downloadButton.textContent = `⬇️ Download Word (${Math.round(result.size / 1024)} KB)`;
            downloadButton.style.display = 'inline-block';
        }

        showStatus(
            '✅ Word document is ready. Tap "Download Word" to save it.',
            'success'
        );
    } catch (error) {
        console.error('DOCX generation failed:', error);
        showStatus(
            '❌ Error generating Word document: ' + error.message,
            'error'
        );
    } finally {
        if (generateButton) {
            generateButton.disabled = false;
            generateButton.textContent = '📝 Generate Word';
        }
    }
}

function downloadReadyWord() {
    if (typeof window.downloadPendingDocx !== 'function') {
        showStatus('❌ Word download system is not loaded. Please refresh the page.', 'error');
        return;
    }

    try {
        const result = window.downloadPendingDocx();

        showStatus(
            '✅ Word document download started: ' + result.filename,
            'success'
        );
    } catch (error) {
        console.error('DOCX download failed:', error);
        showStatus(
            '❌ Word download failed: ' + error.message,
            'error'
        );
    }
}

function toggleOriginalFormatButton(doc) {
    const btn = document.getElementById('generateOriginalWordBtn');
    if (!btn) return;
    btn.style.display = doc && doc._isOriginalDocx && doc._originalDocxBase64 ? 'inline-block' : 'none';
}

// ============================================================
// SECOND, INDEPENDENT DOCX PATH (OOXML-preserving):
// Original uploaded .docx -> ZIP/OOXML -> targeted placeholder text
// replacement inside word/document.xml (+ headers/footers) -> re-zipped
// DOCX. Bold/italic/underline/colour/tables/numbering/headings/page
// layout/margins etc. all come from the original file untouched - only the
// placeholder text itself changes. This does NOT go through TurboDocx and
// does NOT touch/replace window.generateDocx() / downloadWord() above,
// which remains the existing HTML -> TurboDocx -> DOCX path unchanged.
// ============================================================
async function downloadOriginalFormatWord() {
    const doc = currentDocument;
    if (!doc || !doc._isOriginalDocx || !doc._originalDocxBase64) {
        showStatus('❌ Original formatting is only available for uploaded Word (.docx) templates.', 'error');
        return;
    }

    const btn = document.getElementById('generateOriginalWordBtn');
    const originalLabel = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Generating...';
    }

    try {
        const fieldValues = {};
        (doc.fields || []).forEach(field => {
            const el = document.getElementById(`field_${field.key}`);
            if (el && el.value) fieldValues[field.key] = el.value;
        });

        const { generateFormatPreservingDocx } = await import('/shared/docx-format-preserve.js');
        const blob = await generateFormatPreservingDocx({
            originalBytes: doc._originalDocxBase64,
            fieldValues
        });

        const filename = `${doc.name}_${new Date().toISOString().split('T')[0]}.docx`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.rel = 'noopener';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);

        showStatus(`✅ Word document downloaded with original formatting (${Math.round(blob.size / 1024)} KB)`, 'success');
    } catch (error) {
        console.error('Original-format DOCX generation failed:', error);
        showStatus('❌ Error generating formatted Word document: ' + error.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalLabel || '🧩 Generate Word (Original Formatting)';
        }
    }
}

async function downloadPDF() {
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
        if (DEVANAGARI_REGEX.test(textToSplit)) {
            try {
                await ensureDevanagariFont(doc);
                doc.setFont(DEVANAGARI_FONT_ALIAS, 'normal');
            } catch (fontError) {
                console.error('Devanagari font load failed, Hindi text may not render:', fontError);
                showStatus('⚠️ Hindi font failed to load, PDF text may be garbled', 'error');
            }
        }
        // splitTextToSize is measured AFTER the font is switched, so line
        // wrapping uses the correct glyph widths for whichever font will
        // actually render the text (Devanagari fonts wrap differently than
        // Helvetica).
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
