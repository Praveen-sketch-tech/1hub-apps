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

// ============================================================
// FIXED: DOCX PARSING - Manual OOXML parsing (from prorircb.html)
// ============================================================
async function parseDocxManual(arrayBuffer) {
    const zip = await JSZip.loadAsync(arrayBuffer);
    let docXml = await zip.file("word/document.xml")?.async("string");
    if (!docXml) throw new Error("document.xml not found");

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(docXml, "text/xml");

    // Parse styles
    let styles = {};
    try {
        const stylesXml = await zip.file("word/styles.xml")?.async("string");
        if (stylesXml) {
            const stylesDoc = parser.parseFromString(stylesXml, "text/xml");
            const styleEls = stylesDoc.querySelectorAll('w\\:style, style');
            for (let s of styleEls) {
                let id = s.getAttribute('w:styleId') || s.getAttribute('styleId') || '';
                if (id) {
                    styles[id] = { name: id };
                }
            }
        }
    } catch (e) {}

    // Parse numbering
    let numbering = { abstracts: {}, numToAbstract: {} };
    try {
        const numXml = await zip.file("word/numbering.xml")?.async("string");
        if (numXml) {
            const numDoc = parser.parseFromString(numXml, "text/xml");

            const absList = numDoc.querySelectorAll('w\\:abstractNum, abstractNum');
            for (let abs of absList) {
                let id = abs.getAttribute('w:abstractNumId') || abs.getAttribute('abstractNumId') || '';
                if (id) {
                    numbering.abstracts[id] = { levels: {}, numFmt: {} };
                    const lvls = abs.querySelectorAll('w\\:lvl, lvl');
                    for (let lvl of lvls) {
                        let lvlId = lvl.getAttribute('w:ilvl') || lvl.getAttribute('ilvl') || '0';
                        let fmt = lvl.querySelector('w\\:numFmt, numFmt')?.getAttribute('w:val') || 'decimal';
                        let lvlText = lvl.querySelector('w\\:lvlText, lvlText')?.getAttribute('w:val') || '';
                        let start = lvl.querySelector('w\\:start, start')?.getAttribute('w:val') || '1';
                        numbering.abstracts[id].levels[lvlId] = {
                            numFmt: fmt,
                            lvlText: lvlText,
                            start: parseInt(start)
                        };
                    }
                }
            }

            const numEls = numDoc.querySelectorAll('w\\:num, num');
            for (let n of numEls) {
                let id = n.getAttribute('w:numId') || n.getAttribute('numId') || '';
                let absId = n.querySelector('w\\:abstractNumId, abstractNumId')?.getAttribute('w:val') || '';
                if (id && absId) numbering.numToAbstract[id] = absId;
            }
        }
    } catch (e) {
        console.warn('Error parsing numbering:', e);
    }

    const body = xmlDoc.querySelector('w\\:body, body');
    const children = body ? body.children : [];
    let elements = [];
    let pageBreaks = [];
    let pIndex = 0;
    let listCountersMap = {};

    function getNumberingText(numId, level, counter) {
        const absId = numbering.numToAbstract[numId];
        if (!absId) return null;
        const abs = numbering.abstracts[absId];
        if (!abs) return null;
        const lvlDef = abs.levels[level];
        if (!lvlDef) return null;

        const numFmt = lvlDef.numFmt || 'decimal';
        const lvlText = lvlDef.lvlText || '%1';

        let numStr = '';
        if (numFmt === 'bullet') {
            return '•';
        } else if (numFmt === 'decimal') {
            numStr = String(counter || 1);
        } else if (numFmt === 'lowerLetter') {
            numStr = String.fromCharCode(96 + (counter || 1));
        } else if (numFmt === 'upperLetter') {
            numStr = String.fromCharCode(64 + (counter || 1));
        } else if (numFmt === 'lowerRoman') {
            numStr = toRoman(counter || 1).toLowerCase();
        } else if (numFmt === 'upperRoman') {
            numStr = toRoman(counter || 1);
        } else {
            numStr = String(counter || 1);
        }

        let result = lvlText;
        for (let i = 1; i <= 9; i++) {
            const pattern = '%' + i;
            if (result.includes(pattern)) {
                result = result.replace(pattern, numStr);
            }
        }
        return result;
    }

    function toRoman(num) {
        const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
        let result = '';
        for (let key in roman) {
            while (num >= roman[key]) {
                result += key;
                num -= roman[key];
            }
        }
        return result;
    }

    function getNextCounter(numId, level) {
        const key = numId + '_' + level;
        if (!listCountersMap[key]) {
            listCountersMap[key] = 0;
        }
        listCountersMap[key]++;
        return listCountersMap[key];
    }

    for (let node of children) {
        const tag = node.tagName;
        if (tag === 'w:p' || tag === 'p') {
            let isPageBreak = false;
            const br = node.querySelector('w\\:br, br');
            if (br && br.getAttribute('w:type') === 'page') {
                isPageBreak = true;
                pageBreaks.push({ index: pIndex });
                elements.push({ type: 'pageBreak', data: null });
                continue;
            }

            let pStyle = { align: 'left' };
            const pPr = node.querySelector('w\\:pPr, pPr');
            if (pPr) {
                const jc = pPr.querySelector('w\\:jc, jc');
                if (jc) {
                    const val = jc.getAttribute('w:val') || 'left';
                    pStyle.align = val === 'both' ? 'justify' : val;
                }
                const spacing = pPr.querySelector('w\\:spacing, spacing');
                if (spacing) {
                    const before = spacing.getAttribute('w:before') || '';
                    const after = spacing.getAttribute('w:after') || '';
                    if (before) pStyle.marginTop = parseInt(before) / 20;
                    if (after) pStyle.marginBottom = parseInt(after) / 20;
                }
                const indent = pPr.querySelector('w\\:ind, ind');
                if (indent) {
                    const left = indent.getAttribute('w:left') || '';
                    const first = indent.getAttribute('w:firstLine') || '';
                    if (left) pStyle.indent = parseInt(left) / 20;
                    if (first) pStyle.firstLineIndent = parseInt(first) / 20;
                }
            }

            let runs = [];
            const rNodes = node.querySelectorAll('w\\:r, r');
            for (let rn of rNodes) {
                let text = '';
                const t = rn.querySelector('w\\:t, t');
                if (t) text = t.textContent || '';
                let rStyle = {};
                const rPr = rn.querySelector('w\\:rPr, rPr');
                if (rPr) {
                    if (rPr.querySelector('w\\:b, b')) rStyle.bold = true;
                    if (rPr.querySelector('w\\:i, i')) rStyle.italic = true;
                    if (rPr.querySelector('w\\:u, u')) rStyle.underline = true;
                    if (rPr.querySelector('w\\:strike, strike')) rStyle.strike = true;
                    const color = rPr.querySelector('w\\:color, color');
                    if (color) rStyle.color = color.getAttribute('w:val') || '';
                    const sz = rPr.querySelector('w\\:sz, sz');
                    if (sz) {
                        const val = sz.getAttribute('w:val') || '';
                        if (val) rStyle.fontSize = parseInt(val) / 2;
                    }
                    const font = rPr.querySelector('w\\:rFonts, rFonts');
                    if (font) {
                        const ascii = font.getAttribute('w:ascii') || '';
                        if (ascii) rStyle.fontFamily = ascii;
                    }
                    const highlight = rPr.querySelector('w\\:highlight, highlight');
                    if (highlight) rStyle.highlight = highlight.getAttribute('w:val') || 'yellow';
                    if (rPr.querySelector('w\\:vertAlign, vertAlign')) {
                        const val = rPr.querySelector('w\\:vertAlign, vertAlign')?.getAttribute('w:val') || '';
                        if (val === 'superscript') rStyle.sup = true;
                        if (val === 'subscript') rStyle.sub = true;
                    }
                }
                if (text) runs.push({ text, style: rStyle });
            }

            let numPr = null;
            let listLevel = -1;
            let listNumId = null;
            const numPrNode = pPr?.querySelector('w\\:numPr, numPr');
            if (numPrNode) {
                let numId = numPrNode.querySelector('w\\:numId, numId')?.getAttribute('w:val') || '';
                let ilvl = numPrNode.querySelector('w\\:ilvl, ilvl')?.getAttribute('w:val') || '0';
                if (numId) {
                    listNumId = numId;
                    listLevel = parseInt(ilvl);
                    const absId = numbering.numToAbstract[numId];
                    if (absId) {
                        const abs = numbering.abstracts[absId];
                        if (abs) {
                            const lvlDef = abs.levels[listLevel];
                            if (lvlDef) {
                                const isBullet = lvlDef.numFmt === 'bullet';
                                const counter = getNextCounter(numId, listLevel);
                                let markerText = '';
                                if (isBullet) {
                                    markerText = '•';
                                } else {
                                    markerText = getNumberingText(numId, listLevel, counter);
                                    if (!markerText) {
                                        markerText = String(counter) + '.';
                                    }
                                }
                                numPr = {
                                    numId: numId,
                                    level: listLevel,
                                    marker: markerText,
                                    isBullet: isBullet,
                                    counter: counter
                                };
                            }
                        }
                    }
                }
            }

            if (numPr) {
                for (let i = listLevel + 1; i <= 8; i++) {
                    const k = listNumId + '_' + i;
                    listCountersMap[k] = 0;
                }
            }

            elements.push({
                type: 'paragraph',
                data: {
                    runs,
                    style: pStyle,
                    index: pIndex++,
                    numPr: numPr,
                    isPageBreak: false,
                    listLevel: listLevel,
                    listNumId: listNumId
                }
            });

        } else if (tag === 'w:tbl' || tag === 'tbl') {
            let rows = [];
            const trs = node.querySelectorAll('w\\:tr, tr');
            for (let tr of trs) {
                let cells = [];
                const tcs = tr.querySelectorAll('w\\:tc, tc');
                for (let tc of tcs) {
                    let cell = { paragraphs: [], align: 'left', colspan: 1, rowspan: 1 };
                    const tcPr = tc.querySelector('w\\:tcPr, tcPr');
                    if (tcPr) {
                        const grid = tcPr.querySelector('w\\:gridSpan, gridSpan');
                        if (grid) cell.colspan = parseInt(grid.getAttribute('w:val') || '1');
                        const vMerge = tcPr.querySelector('w\\:vMerge, vMerge');
                        if (vMerge) {
                            const val = vMerge.getAttribute('w:val') || '';
                            if (val === 'restart') cell.rowspan = 1;
                            else if (val === 'continue') cell.rowspan = 2;
                            else cell.rowspan = 1;
                        }
                        const shd = tcPr.querySelector('w\\:shd, shd');
                        if (shd) cell.bg = shd.getAttribute('w:fill') || '';
                        const vAlign = tcPr.querySelector('w\\:vAlign, vAlign');
                        if (vAlign) cell.valign = vAlign.getAttribute('w:val') || 'top';
                    }
                    const ps = tc.querySelectorAll('w\\:p, p');
                    for (let cp of ps) {
                        let cruns = [];
                        const crns = cp.querySelectorAll('w\\:r, r');
                        for (let crn of crns) {
                            let txt = crn.querySelector('w\\:t, t')?.textContent || '';
                            if (txt) cruns.push({ text: txt, style: {} });
                        }
                        cell.paragraphs.push({ runs: cruns, align: 'left' });
                    }
                    cells.push(cell);
                }
                rows.push({ cells });
            }
            elements.push({ type: 'table', data: { rows } });
        }
    }

    return {
        elements,
        styles,
        numbering,
        pageBreaks,
        rawXml: docXml.substring(0, 8000),
        originalZip: zip
    };
}

// ============================================================
// FIXED: RENDER FUNCTION - Proper formatting preservation
// ============================================================
function renderDocumentWithFormatting(docData) {
    if (!docData) {
        editor.innerHTML = `<div style="color:#94a3b8; text-align:center; padding:3rem 0;">No document loaded</div>`;
        return;
    }
    const { elements, styles, numbering, pageBreaks } = docData;

    let paraCount = 0;
    let runTotal = 0;
    let tableCount = 0;
    for (let el of elements) {
        if (el.type === 'paragraph') {
            paraCount++;
            if (el.data.runs) runTotal += el.data.runs.length;
        } else if (el.type === 'table') {
            tableCount++;
        }
    }
    paraCountEl.textContent = `paragraphs: ${paraCount}`;
    runCountEl.textContent = `runs: ${runTotal}`;
    tableCountEl.textContent = `tables: ${tableCount}`;
    pageCountEl.textContent = `pages: ${(pageBreaks ? pageBreaks.length : 0) + 1}`;

    let pageCounter = 1;
    let currentPageHtml = `<div class="page-sim" data-page="${pageCounter}">`;
    let pageHtml = '';

    function renderRuns(runs, pStyle) {
        let out = '';
        if (!runs) return out;
        for (let r of runs) {
            let text = r.text || '';
            let style = r.style || {};
            let inline = [];
            if (style.bold) inline.push('font-weight:700');
            if (style.italic) inline.push('font-style:italic');
            if (style.underline) inline.push('text-decoration:underline');
            if (style.color) inline.push(`color:${style.color}`);
            if (style.fontSize) inline.push(`font-size:${style.fontSize}pt`);
            if (style.fontFamily) inline.push(`font-family:"${style.fontFamily}", sans-serif`);
            if (style.highlight) inline.push(`background-color:${style.highlight}`);
            if (style.strike) inline.push('text-decoration:line-through');
            if (style.sup) inline.push('vertical-align:super;font-size:0.7em');
            if (style.sub) inline.push('vertical-align:sub;font-size:0.7em');
            let styleAttr = inline.join('; ');
            if (styleAttr) {
                out += `<span style="${styleAttr}">${escapeHtml(text)}</span>`;
            } else {
                out += escapeHtml(text);
            }
        }
        return out;
    }

    for (let el of elements) {
        if (el.type === 'pageBreak') {
            currentPageHtml += `</div>`;
            pageHtml += currentPageHtml;
            pageCounter++;
            currentPageHtml = `<div class="page-sim" data-page="${pageCounter}">`;
            continue;
        }

        if (el.type === 'paragraph') {
            let p = el.data;
            let pStyle = p.style || {};
            let align = pStyle.align || 'left';
            let marginTop = pStyle.marginTop ? `margin-top:${pStyle.marginTop}pt;` : '';
            let marginBottom = pStyle.marginBottom ? `margin-bottom:${pStyle.marginBottom}pt;` : '';
            let lineHeight = pStyle.lineHeight ? `line-height:${pStyle.lineHeight};` : '';
            let indent = pStyle.indent ? `padding-left:${pStyle.indent}pt;` : '';
            let firstLine = pStyle.firstLineIndent ? `text-indent:${pStyle.firstLineIndent}pt;` : '';
            let styleBlock = `text-align:${align};${marginTop}${marginBottom}${lineHeight}${indent}${firstLine}`;

            let content = renderRuns(p.runs, pStyle);

            if (p.numPr) {
                const marker = p.numPr.marker || '';
                const isBullet = p.numPr.isBullet || false;
                const level = p.numPr.level || 0;

                let renderedContent = '';
                if (isBullet) {
                    renderedContent = `<div class="docx-list-item docx-list-bullet" style="padding-left: ${(level + 1) * 20}px; margin: 0.1rem 0;">• ${content}</div>`;
                } else {
                    renderedContent = `<div class="docx-list-item docx-list-decimal" style="padding-left: ${(level + 1) * 20}px; margin: 0.1rem 0;">${marker} ${content}</div>`;
                }
                currentPageHtml += renderedContent;
            } else {
                let cls = pStyle.styleName ? ` docx-style-${pStyle.styleName.toLowerCase().replace(/\s+/g, '-')}` : '';
                currentPageHtml += `<p style="${styleBlock}" class="docx-paragraph${cls}" data-para-idx="${p.index || 0}">${content}</p>`;
            }

        } else if (el.type === 'table') {
            let tbl = el.data;
            let rows = tbl.rows || [];
            let tableHtml = '<table class="docx-table">';
            for (let row of rows) {
                tableHtml += '<tr>';
                let cells = row.cells || [];
                for (let cell of cells) {
                    let cellStyle = '';
                    if (cell.width) cellStyle += `width:${cell.width}pt;`;
                    if (cell.bg) cellStyle += `background-color:${cell.bg};`;
                    if (cell.valign) cellStyle += `vertical-align:${cell.valign};`;
                    let align = cell.align || 'left';
                    cellStyle += `text-align:${align};`;
                    let colspan = cell.colspan > 1 ? `colspan="${cell.colspan}"` : '';
                    let rowspan = cell.rowspan > 1 ? `rowspan="${cell.rowspan}"` : '';
                    let cellContent = '';
                    if (cell.paragraphs) {
                        for (let cp of cell.paragraphs) {
                            let cr = renderRuns(cp.runs, {});
                            cellContent += `<div style="text-align:${cp.align || 'left'};">${cr}</div>`;
                        }
                    }
                    tableHtml += `<td ${colspan} ${rowspan} style="${cellStyle}">${cellContent || '&nbsp;'}</td>`;
                }
                tableHtml += '</tr>';
            }
            tableHtml += '</table>';
            currentPageHtml += tableHtml;
        }
    }

    currentPageHtml += `</div>`;
    pageHtml += currentPageHtml;

    editor.innerHTML = pageHtml;

    isEditing = false;
    editor.contentEditable = 'false';
    editor.classList.add('readonly');
    editModeBtn.textContent = '✏️ Edit';
    editModeBtn.classList.remove('active');

    if (docData.rawXml) {
        rawXmlDisplay.textContent = docData.rawXml.substring(0, 4000) + (docData.rawXml.length > 4000 ? '… (truncated)' : '');
    } else {
        rawXmlDisplay.textContent = 'No raw XML captured.';
    }
    techStats.innerHTML = `
        <strong>DOCX stats</strong> · paragraphs: ${paraCount} · runs: ${runTotal} · tables: ${tableCount} · pageBreaks: ${pageBreaks?pageBreaks.length:0}
        · styles: ${styles?Object.keys(styles).length:0} · numbering: ${numbering?Object.keys(numbering.abstracts||{}).length:0}
    `;

    downloadSection.className = 'download-section download-section-visible';
}

// ============================================================
// FIXED: selectDocument - Uses manual parsing
// ============================================================
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
            doc._originalDocxBase64 = docData.contentBase64;
            doc._isOriginalDocx = true;
            const binaryString = atob(docData.contentBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const arrayBuffer = bytes.buffer;

            // ============================================================
            // FIXED: Use manual parsing instead of mammoth
            // ============================================================
            const parsedData = await parseDocxManual(arrayBuffer);
            doc._parsedData = parsedData;
            doc._isParsed = true;
            
            // Store raw content for field detection
            let rawText = '';
            for (let el of parsedData.elements) {
                if (el.type === 'paragraph') {
                    for (let run of el.data.runs) {
                        rawText += run.text + ' ';
                    }
                    rawText += '\n';
                }
            }
            doc._content = rawText;
            content = rawText;

        } else if (isTxt && docData.textContent) {
            doc._isOriginalDocx = false;
            doc._isParsed = false;
            content = docData.textContent;
            doc._content = content;
        } else if (docData.contentBase64) {
            doc._isOriginalDocx = false;
            doc._isParsed = false;
            try {
                content = atob(docData.contentBase64);
                doc._content = content;
            } catch (e) {
                throw new Error('Cannot extract text from this document type');
            }
        } else {
            throw new Error('No content available for this document');
        }

        if (!content || content.trim() === '') {
            throw new Error('Document content is empty');
        }
        
        generateForm(doc, content);
        toggleOriginalFormatButton(doc);
        
        // ============================================================
        // FIXED: Render with formatting if parsed
        // ============================================================
        if (doc._isParsed && doc._parsedData) {
            renderDocumentWithFormatting(doc._parsedData);
        } else {
            // Fallback for txt files
            renderDocumentWithFormatting(null);
            editor.innerHTML = `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(content)}</pre>`;
        }
        
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

// ============================================================
// FIXED: updatePreview - Uses parsed data with formatting
// ============================================================
function updatePreview() {
    const doc = currentDocument;
    if (!doc || !doc._content) {
        showStatus('Please select a document first', 'error');
        return;
    }

    const previewEl = document.getElementById('previewContent');

    // If we have parsed data with formatting, re-render with field values
    if (doc._isParsed && doc._parsedData) {
        // Get field values
        const fieldValues = {};
        doc.fields.forEach(field => {
            const el = document.getElementById(`field_${field.key}`);
            fieldValues[field.key] = el?.value || '';
        });

        // Deep clone the parsed data
        const dataCopy = JSON.parse(JSON.stringify(doc._parsedData));
        
        // Replace placeholders in text runs
        dataCopy.elements.forEach(el => {
            if (el.type === 'paragraph') {
                el.data.runs.forEach(run => {
                    let text = run.text;
                    doc.fields.forEach(field => {
                        const value = fieldValues[field.key] || '';
                        if (value) {
                            const key = field.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            text = text.replace(new RegExp(`\\{{1,2}${key}\\}{1,2}`, 'g'), value);
                        }
                    });
                    run.text = text;
                });
            }
        });

        // Re-render with updated data
        renderDocumentWithFormatting(dataCopy);
        
    } else {
        // Fallback for plain text
        let filledContent = doc._content;
        doc.fields.forEach(field => {
            const el = document.getElementById(`field_${field.key}`);
            const value = el?.value || '';
            if (value) {
                const key = field.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                filledContent = filledContent.replace(new RegExp(`\\{{1,2}${key}\\}{1,2}`, 'g'), value);
            }
        });
        previewEl.innerHTML = formatPlainText(filledContent);
    }

    document.getElementById('previewArea').style.display = 'block';
    window.currentPreviewContent = previewEl.innerHTML;
}

function formatPlainText(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    html = html
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/__(.+?)__/g, '<b>$1</b>')
        .replace(/\*(.+?)\*/g, '<i>$1</i>')
        .replace(/_(.+?)_/g, '<i>$1</i>')
        .replace(/\+\+(.+?)\+\+/g, '<u>$1</u>')
        .replace(/^([A-Z][A-Z\s]{4,})$/gm, '<h2>$1</h2>')
        .replace(/^[-]{3,}$/gm, '<hr>')
        .split('\n\n')
        .map(p => p.trim())
        .filter(p => p)
        .map(p => {
            if (p.match(/^\d+\.\s/)) {
                return p.replace(/^(\d+\.\s)(.+)$/gm, '<li>$1 $2</li>');
            }
            if (p.match(/^[•\-*]\s/)) {
                return p.replace(/^[•\-*]\s(.+)$/gm, '<li>• $1</li>');
            }
            if (p.startsWith('<h') || p.startsWith('<hr>')) return p;
            return `<p>${p}</p>`;
        })
        .join('\n');
    html = html.replace(/(<li>.*?<\/li>)/g, (match) => {
        if (match.includes('•')) {
            return `<ul>${match}</ul>`;
        }
        return `<ol>${match}</ol>`;
    });
    html = html.replace(/<\/ul>\s*<ul>/g, '');
    html = html.replace(/<\/ol>\s*<ol>/g, '');
    return html;
}

// ============================================================
// REST OF THE CODE (Unchanged from previous)
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
        showStatus('✅ Word document is ready. Tap "Download Word" to save it.', 'success');
    } catch (error) {
        console.error('DOCX generation failed:', error);
        showStatus('❌ Error generating Word document: ' + error.message, 'error');
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
        showStatus('✅ Word document download started: ' + result.filename, 'success');
    } catch (error) {
        console.error('DOCX download failed:', error);
        showStatus('❌ Word download failed: ' + error.message, 'error');
    }
}

function toggleOriginalFormatButton(doc) {
    const btn = document.getElementById('generateOriginalWordBtn');
    if (!btn) return;
    btn.style.display = doc && doc._isOriginalDocx && doc._originalDocxBase64 ? 'inline-block' : 'none';
}

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
        const lineHeight = 7;
        let y = margin;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        let textToSplit = '';
        const children = tempDiv.childNodes;
        for (const node of children) {
            if (node.nodeType === 3) {
                textToSplit += node.textContent + '\n';
            } else if (node.tagName === 'P') {
                textToSplit += node.textContent + '\n\n';
            } else if (node.tagName === 'H2' || node.tagName === 'H3') {
                textToSplit += node.textContent + '\n\n';
            } else if (node.tagName === 'H1') {
                textToSplit += node.textContent + '\n\n';
            } else if (node.tagName === 'UL' || node.tagName === 'OL') {
                const items = node.querySelectorAll('li');
                items.forEach(li => {
                    const bullet = node.tagName === 'UL' ? '  • ' : '  ' + (items.length > 1 ? (Array.from(items).indexOf(li) + 1) + '. ' : '• ');
                    textToSplit += bullet + li.textContent + '\n';
                });
                textToSplit += '\n';
            } else if (node.tagName === 'TABLE') {
                const rows = node.querySelectorAll('tr');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td, th');
                    const rowText = Array.from(cells).map(cell => cell.textContent.trim()).join(' | ');
                    textToSplit += rowText + '\n';
                });
                textToSplit += '\n';
            } else if (node.tagName === 'HR') {
                textToSplit += '---\n\n';
            } else if (node.tagName === 'DIV') {
                if (node.className === 'page-break') {
                    textToSplit += '\n--- PAGE BREAK ---\n\n';
                } else {
                    textToSplit += node.textContent + '\n\n';
                }
            } else {
                textToSplit += node.textContent + '\n';
            }
        }
        if (DEVANAGARI_REGEX.test(textToSplit)) {
            try {
                await ensureDevanagariFont(doc);
                doc.setFont(DEVANAGARI_FONT_ALIAS, 'normal');
            } catch (fontError) {
                console.error('Devanagari font load failed:', fontError);
                showStatus('⚠️ Hindi font failed to load, PDF text may be garbled', 'error');
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
        console.error('PDF generation error:', error);
        showStatus('❌ Error generating PDF: ' + error.message, 'error');
    }
}

// ============================================================
// PRINT FUNCTION
// ============================================================
function printDocument() {
    const previewContent = document.getElementById('previewContent');
    if (!previewContent || previewContent.innerHTML.trim() === '') {
        showStatus('Please generate preview first!', 'error');
        return;
    }
    const contentHTML = previewContent.innerHTML;
    const styles = document.querySelector('style')?.innerHTML || '';
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
        showStatus('⚠️ Please allow popups for printing', 'error');
        return;
    }
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Document Print</title>
            <meta charset="UTF-8">
            <style>
                ${styles}
                body {
                    font-family: 'Times New Roman', Times, serif;
                    padding: 40px 50px;
                    margin: 0;
                    background: white;
                    color: black;
                }
                .preview-box {
                    max-height: none !important;
                    overflow: visible !important;
                    border: none !important;
                    padding: 20px !important;
                    box-shadow: none !important;
                }
                .docx-preview-wrapper {
                    font-family: 'Times New Roman', Times, serif;
                    font-size: 12pt;
                    line-height: 1.5;
                    color: #000;
                    max-width: 100%;
                }
                .docx-preview-wrapper p { margin: 0 0 8px 0; padding: 0; }
                .docx-preview-wrapper h1, .docx-preview-wrapper h2, .docx-preview-wrapper h3,
                .docx-preview-wrapper h4, .docx-preview-wrapper h5, .docx-preview-wrapper h6 {
                    margin: 12px 0 8px 0;
                    font-weight: bold;
                }
                .docx-preview-wrapper h1 { font-size: 18pt; text-align: center; }
                .docx-preview-wrapper h2 { font-size: 16pt; }
                .docx-preview-wrapper h3 { font-size: 14pt; }
                .docx-preview-wrapper b, .docx-preview-wrapper strong { font-weight: bold; }
                .docx-preview-wrapper i, .docx-preview-wrapper em { font-style: italic; }
                .docx-preview-wrapper u { text-decoration: underline; }
                .docx-preview-wrapper .text-left { text-align: left; }
                .docx-preview-wrapper .text-center { text-align: center; }
                .docx-preview-wrapper .text-right { text-align: right; }
                .docx-preview-wrapper .text-justify { text-align: justify; }
                .docx-preview-wrapper ul, .docx-preview-wrapper ol {
                    margin: 6px 0 6px 0;
                    padding-left: 30px;
                }
                .docx-preview-wrapper li { margin: 2px 0; }
                .docx-preview-wrapper table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 10px 0;
                    font-size: 11pt;
                }
                .docx-preview-wrapper table td, 
                .docx-preview-wrapper table th {
                    border: 1px solid #000;
                    padding: 4px 8px;
                    text-align: left;
                    vertical-align: top;
                }
                .docx-preview-wrapper table th { background: #f0f4ff; font-weight: bold; }
                .docx-preview-wrapper .page-break {
                    page-break-after: always;
                    border-top: 2px dashed #ccc;
                    margin: 30px 0;
                    padding: 10px 0;
                    text-align: center;
                    color: #999;
                    font-size: 10pt;
                }
                @media print {
                    body { padding: 20px 30px; }
                    .no-print { display: none; }
                    .page-break { page-break-after: always; }
                }
            </style>
        </head>
        <body>
            ${contentHTML}
            <script>
                window.onload = function() {
                    setTimeout(function() { window.print(); }, 500);
                };
                window.onafterprint = function() {
                    setTimeout(function() { window.close(); }, 1000);
                };
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
    showStatus('🖨️ Print dialog opened. Select "Save as PDF" or print.', 'success');
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
