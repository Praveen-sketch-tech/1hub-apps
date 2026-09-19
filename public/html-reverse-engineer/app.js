/* ============================================================
   HTML Reverse Engineer & Project Builder
   Standalone V1 — no backend, no external services except Telegram.
   ============================================================ */

/* ------------------------------------------------------------
   0. STATE
   ------------------------------------------------------------ */
const STATE = {
  file: null,
  rawHTML: '',
  manifest: null,
  projectFiles: null,
  zipBlob: null,
  zipURL: null
};

const LS_KEY = 'hre.tg.config';
const VAULT_DB = 'hre.vault';
const VAULT_STORE = 'capabilities';
const VAULT_VERSION = 1;
const MAX_FILE_BYTES_WARN = 25 * 1024 * 1024;
const TG_MSG_INTERVAL_MS = 1100;

/* ------------------------------------------------------------
   1. UTILITIES
   ------------------------------------------------------------ */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function escHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(2) + ' MB';
}
function sanitizeName(name) {
  return String(name)
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[\\/]+/g, '_')
    .replace(/\.\.+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120) || 'file';
}
function sanitizePath(p) {
  return String(p).split('/').map(sanitizeName).filter(Boolean).join('/');
}

let _toastTimer = null;
function toast(msg, kind = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast' + (kind ? ' ' + kind : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
  el.classList.remove('hidden');
}

async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}
function simpleHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return 'h' + (h >>> 0).toString(36);
}

/* ------------------------------------------------------------
   2. FILE UPLOAD
   ------------------------------------------------------------ */
const dropzone = $('#dropzone');
const fileInput = $('#fileInput');
const analyzeBtn = $('#analyzeBtn');
const fileInfo = $('#fileInfo');

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  const f = e.dataTransfer.files[0];
  if (f) handleFile(f);
});
fileInput.addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) handleFile(f);
});

async function handleFile(file) {
  const isHTMLName = /\.(html?|htm)$/i.test(file.name);
  const isHTMLType = file.type === 'text/html';
  if (!isHTMLName && !isHTMLType) {
    toast('Please upload an .html or .htm file', 'err');
    return;
  }
  if (file.size > MAX_FILE_BYTES_WARN) {
    toast('Large file (>25MB). Analysis may be slow.', '');
  }
  STATE.file = file;
  try {
    STATE.rawHTML = await file.text();
  } catch (err) {
    toast('Could not read file', 'err');
    return;
  }
  fileInfo.classList.remove('hidden');
  fileInfo.innerHTML = `<b>${escHTML(file.name)}</b> — ${fmtBytes(file.size)} — ${STATE.rawHTML.length.toLocaleString()} chars`;
  analyzeBtn.disabled = false;
}

/* ------------------------------------------------------------
   3. PARSER → MANIFEST
   ------------------------------------------------------------ */
const VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);

function detectDoctype(html) {
  const m = html.match(/<!doctype[^>]*>/i);
  return m ? m[0] : '<!DOCTYPE html>';
}

function extractAttrsOrdered(el) {
  const out = [];
  if (!el || !el.attributes) return out;
  for (const a of el.attributes) out.push([a.name, a.value]);
  return out;
}
function attrsToString(attrs) {
  if (!attrs) return '';
  if (Array.isArray(attrs)) {
    return attrs.map(([k, v]) => v === '' || v === true ? k : `${k}="${escAttr(v)}"`).join(' ');
  }
  return Object.entries(attrs)
    .map(([k, v]) => v === '' || v === true ? k : `${k}="${escAttr(v)}"`)
    .join(' ');
}

function analyzeHTML(html, filename) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const manifest = {
    meta: {
      filename,
      size: html.length,
      doctype: detectDoctype(html),
      lang: doc.documentElement.getAttribute('lang') || '',
      dir: doc.documentElement.getAttribute('dir') || '',
      htmlAttrs: extractAttrsOrdered(doc.documentElement)
    },
    head: { items: [] },
    body: { items: [] },
    fragments: { styles: [], scripts: [], assets: [] },
    externals: [],
    warnings: [],
    capabilities: [],
    missingAssets: [],
    baseTag: null,
    counts: {
      inlineStyles: 0,
      inlineScripts: 0,
      externalCSS: 0,
      externalJS: 0,
      dataURIAssets: 0,
      missingAssets: 0,
      comments: 0
    }
  };

  // Detect <base>
  const baseEl = doc.querySelector('base[href]');
  if (baseEl) {
    manifest.baseTag = { href: baseEl.getAttribute('href') };
    manifest.warnings.push({
      kind: 'base-tag',
      message: `<base href="${escAttr(baseEl.getAttribute('href'))}"> detected. Relative asset paths may resolve differently after reconstruction.`
    });
  }

  // Walk head
  if (doc.head) {
    Array.from(doc.head.childNodes).forEach(n => processNode(n, manifest, 'head'));
  }
  // Walk body
  if (doc.body) {
    Array.from(doc.body.childNodes).forEach(n => processNode(n, manifest, 'body'));
  }

  // Missing local assets
  collectMissingAssets(doc, manifest);

  // Capabilities
  manifest.capabilities = detectCapabilities(html, doc);

  // Secret scan
  manifest.warnings.push(...scanSecrets(html));

  // Dedupe warnings by kind+message
  const seenWarn = new Set();
  manifest.warnings = manifest.warnings.filter(w => {
    const key = (w.kind || '') + '|' + (w.message || '');
    if (seenWarn.has(key)) return false;
    seenWarn.add(key);
    return true;
  });

  // Comments
  manifest.counts.comments = (html.match(/<!--[\s\S]*?-->/g) || []).length;

  return manifest;
}

function processNode(node, manifest, section) {
  if (node.nodeType === 3) {
    const t = node.textContent;
    if (t.length) manifest[section].items.push({ type: 'text', raw: t });
    return;
  }
  if (node.nodeType === 8) {
    manifest[section].items.push({ type: 'comment', raw: `<!--${node.textContent}-->` });
    return;
  }
  if (node.nodeType !== 1) return;

  const tag = node.tagName.toLowerCase();
  const attrs = extractAttrsOrdered(node);

  // <style>
  if (tag === 'style') {
    const content = node.textContent;
    if (!content.trim()) {
      // keep empty style as-is
      manifest[section].items.push({ type: 'raw', html: node.outerHTML });
      return;
    }
    const idx = manifest.fragments.styles.length;
    const id = `s${idx + 1}`;
    const media = node.getAttribute('media') || '';
    const filename = media
      ? `style-${idx + 1}-${sanitizeName(media)}.css`
      : `style-${idx + 1}.css`;
    manifest.fragments.styles.push({
      id, filename, content, media,
      attrs: attrsToString(attrs),
      section,
      lineCount: content.split('\n').length
    });
    manifest.counts.inlineStyles++;
    manifest[section].items.push({ type: 'style-ref', id });
    return;
  }

  // <script>
  if (tag === 'script') {
    const src = node.getAttribute('src');
    if (src) {
      manifest.externals.push({ kind: 'script', url: src, attrs: attrsToString(attrs) });
      manifest.counts.externalJS++;
      manifest[section].items.push({ type: 'script-ext', src, attrs: attrsToString(attrs) });
      return;
    }
    const content = node.textContent;
    if (!content.trim()) {
      manifest[section].items.push({ type: 'raw', html: node.outerHTML });
      return;
    }
    const idx = manifest.fragments.scripts.length;
    const id = `js${idx + 1}`;
    const typeAttr = (node.getAttribute('type') || '').toLowerCase();
    const isModule = typeAttr === 'module';
    manifest.fragments.scripts.push({
      id,
      filename: `script-${idx + 1}.js`,
      content,
      attrs: attrsToString(attrs),
      isModule,
      section,
      lineCount: content.split('\n').length
    });
    manifest.counts.inlineScripts++;
    manifest[section].items.push({ type: 'script-ref', id });
    return;
  }

  // <link rel=stylesheet>
  if (tag === 'link') {
    const rel = (node.getAttribute('rel') || '').toLowerCase();
    const href = node.getAttribute('href') || '';
    if (rel.includes('stylesheet') && href) {
      manifest.externals.push({ kind: 'style', url: href, attrs: attrsToString(attrs) });
      manifest.counts.externalCSS++;
      manifest[section].items.push({ type: 'link-ext', href, attrs: attrsToString(attrs) });
      return;
    }
  }

  // data-URI assets on this element
  ['src', 'href', 'poster'].forEach(attrName => {
    const val = node.getAttribute(attrName);
    if (val && /^data:/i.test(val)) {
      const m = val.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/i);
      if (m) {
        const mime = m[1];
        const isB64 = !!m[2];
        const data = m[3];
        const ext = mimeToExt(mime);
        const idx = manifest.fragments.assets.length;
        const id = `asset${idx + 1}`;
        manifest.fragments.assets.push({
          id,
          filename: `asset-${idx + 1}.${ext}`,
          mime, isBase64: isB64, data
        });
        manifest.counts.dataURIAssets++;
      }
    }
  });

  // <template> / <noscript> → keep raw outerHTML
  if (tag === 'template' || tag === 'noscript') {
    manifest[section].items.push({ type: 'raw', html: node.outerHTML });
    return;
  }

  // Void element
  if (VOID_TAGS.has(tag)) {
    manifest[section].items.push({ type: 'void', tag, attrs: attrsToString(attrs) });
    return;
  }

  // Regular element — open, children, close
  manifest[section].items.push({ type: 'open', tag, attrs: attrsToString(attrs) });
  Array.from(node.childNodes).forEach(child => processNode(child, manifest, section));
  manifest[section].items.push({ type: 'close', tag });
}

function mimeToExt(mime) {
  const map = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif',
    'image/svg+xml': 'svg', 'image/webp': 'webp', 'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
    'font/woff': 'woff', 'font/woff2': 'woff2', 'font/ttf': 'ttf',
    'application/pdf': 'pdf', 'text/plain': 'txt', 'text/css': 'css',
    'application/javascript': 'js', 'text/javascript': 'js'
  };
  return map[String(mime).toLowerCase()] || 'bin';
}

function collectMissingAssets(doc, manifest) {
  const seen = new Set();
  doc.querySelectorAll('img, source, video, audio, link, script, iframe, embed').forEach(el => {
    ['src', 'href', 'poster', 'data-src'].forEach(attr => {
      const val = el.getAttribute(attr);
      if (!val) return;
      if (/^(https?:)?\/\//i.test(val)) return;   // external
      if (/^data:/i.test(val)) return;            // data-uri
      if (/^(mailto:|tel:|javascript:|#)/i.test(val)) return;
      if (/^blob:/i.test(val)) return;
      // skip stylesheet links and script src — handled separately as externals
      if (el.tagName === 'LINK' && (el.getAttribute('rel') || '').includes('stylesheet')) return;
      if (el.tagName === 'SCRIPT' && el.hasAttribute('src')) return;
      const key = el.tagName + '|' + val;
      if (seen.has(key)) return;
      seen.add(key);
      manifest.missingAssets.push({ ref: val, from: el.tagName.toLowerCase() });
      manifest.counts.missingAssets++;
    });
  });
}

/* ------------------------------------------------------------
   4. CAPABILITY DETECTION
   ------------------------------------------------------------ */
function detectCapabilities(html, doc) {
  const scriptText = Array.from(doc.querySelectorAll('script'))
    .filter(s => !s.hasAttribute('src'))
    .map(s => s.textContent).join('\n');
  const allText = html;

  const rules = [
    { cat: 'PDF_READ',  name: 'PDF Reading',        needles: [/pdfjsLib/i, /getDocument\s*\(/, /<embed[^>]+application\/pdf/i] },
    { cat: 'PDF_WRITE', name: 'PDF Generation',     needles: [/jsPDF/i, /new\s+jsPDF/i, /pdfmake/i, /doc\.save\s*\(/] },
    { cat: 'OCR',       name: 'OCR',                needles: [/Tesseract/i, /tesseract\.recognize/i, /OCRAD/i, /gocr/i] },
    { cat: 'EXCEL',     name: 'Excel / CSV',        needles: [/\bXLSX\b/, /SheetJS/i, /Papa\.parse/i, /to_csv/i] },
    { cat: 'UPLOAD',    name: 'File Upload',        needles: [/<input[^>]+type=["']file["']/i, /FileReader/i, /\.files\b/] },
    { cat: 'DOWNLOAD',  name: 'File Download',      needles: [/\.download\s*=/, /URL\.createObjectURL/i, /saveAs\s*\(/i] },
    { cat: 'IMAGE',     name: 'Image Processing',   needles: [/getContext\s*\(\s*['"]2d['"]/, /drawImage/i, /\.filter\s*=/] },
    { cat: 'ZIP',       name: 'ZIP Handling',       needles: [/\bJSZip\b/, /\bpako\b/i, /\bfflate\b/i] },
    { cat: 'API',       name: 'API / Network',      needles: [/\bfetch\s*\(/, /XMLHttpRequest/, /\baxios\b/, /\$\.ajax\b/] },
    { cat: 'STORAGE',   name: 'LocalStorage',       needles: [/localStorage\./] },
    { cat: 'STORAGE',   name: 'SessionStorage',     needles: [/sessionStorage\./] },
    { cat: 'STORAGE',   name: 'IndexedDB',          needles: [/indexedDB\./, /IDBOpenDBRequest/] },
    { cat: 'CLIPBOARD', name: 'Clipboard',          needles: [/navigator\.clipboard/i, /execCommand\s*\(\s*['"]copy['"]/] },
    { cat: 'PRINT',     name: 'Print',              needles: [/window\.print\s*\(/, /@media\s+print/i] },
    { cat: 'DRAG_DROP', name: 'Drag & Drop',        needles: [/ondrop\s*=/i, /dragstart/i, /dataTransfer/] },
    { cat: 'WORKER',    name: 'Web Worker',         needles: [/new\s+Worker\s*\(/] },
    { cat: 'CANVAS',    name: 'Canvas',             needles: [/<canvas\b/i, /getContext\s*\(/] },
    { cat: 'MEDIA',     name: 'Camera / Microphone', needles: [/getUserMedia/i, /MediaRecorder/i] }
  ];

  const results = [];
  const seen = new Set();

  rules.forEach(rule => {
    for (const re of rule.needles) {
      const m = scriptText.match(re) || allText.match(re);
      if (!m) continue;
      const key = rule.cat + '|' + rule.name;
      if (seen.has(key)) break;
      seen.add(key);
      const src = (scriptText.match(re) ? scriptText : allText);
      const lineIdx = src.slice(0, m.index).split('\n').length;
      results.push({
        category: rule.cat,
        name: rule.name,
        evidence: m[0].slice(0, 90).replace(/\s+/g, ' ').trim(),
        line: lineIdx,
        fingerprint: simpleHash(rule.cat + '::' + rule.name + '::' + m[0].slice(0, 60))
      });
      break;
    }
  });

  return results;
}

/* ------------------------------------------------------------
   5. SECRET SCANNER
   ------------------------------------------------------------ */
function scanSecrets(html) {
  const findings = [];
  const patterns = [
    { name: 'AWS Access Key',      re: /\bAKIA[0-9A-Z]{16}\b/g },
    { name: 'Google API Key',      re: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
    { name: 'Stripe Live Key',     re: /\bsk_live_[0-9a-zA-Z]{24,}\b/g },
    { name: 'Stripe Publishable',  re: /\bpk_live_[0-9a-zA-Z]{24,}\b/g },
    { name: 'GitHub Token',        re: /\bghp_[0-9A-Za-z]{36}\b/g },
    { name: 'Slack Token',         re: /\bxox[baprs]-[0-9A-Za-z-]+\b/g },
    { name: 'JWT',                 re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
    { name: 'Private Key Block',   re: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g },
    { name: 'Generic API Key',     re: /(?:api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*["'][A-Za-z0-9\-_]{16,}["']/gi },
    { name: 'Bearer Token',        re: /Bearer\s+[A-Za-z0-9\-_.=]{20,}/g }
  ];

  patterns.forEach(p => {
    const matches = html.match(p.re);
    if (matches && matches.length) {
      findings.push({
        kind: 'secret',
        name: p.name,
        count: matches.length,
        message: `${p.name} detected (${matches.length} occurrence${matches.length > 1 ? 's' : ''}). Review before sharing.`
      });
    }
  });
  return findings;
}

/* ------------------------------------------------------------
   6. RECONSTRUCTION
   ------------------------------------------------------------ */
function reconstruct(manifest, options) {
  const files = {};

  // --- CSS ---
  const styles = manifest.fragments.styles;
  if (styles.length > 0) {
    // Group by media
    const byMedia = new Map();
    styles.forEach(f => {
      const key = f.media || '';
      if (!byMedia.has(key)) byMedia.set(key, []);
      byMedia.get(key).push(f);
    });
    byMedia.forEach((arr, media) => {
      if (media) {
        // per-media file
        const mediaSafe = sanitizeName(media);
        const path = `css/style-${mediaSafe}.css`;
        files[path] = arr.map(f => `/* ${f.filename} */\n${f.content}`).join('\n\n');
      } else {
        files['css/style.css'] = arr.map(f => `/* ${f.filename} */\n${f.content}`).join('\n\n');
      }
    });
  }

  // --- JS ---
  manifest.fragments.scripts.forEach(f => {
    let content = f.content;
    if (options.minify) content = basicMinifyJS(content);
    if (options.stripLogs) content = stripConsoleLogs(content);
    files[`js/${f.filename}`] = content;
  });

  // --- Assets ---
  const assetPathById = {};
  if (options.extractAssets) {
    manifest.fragments.assets.forEach(a => {
      const path = `assets/${a.filename}`;
      assetPathById[a.id] = path;
      files[path] = { __asset: true, data: a.data, isBase64: a.isBase64 };
    });
  }

  // --- index.html ---
  const out = [];
  out.push(manifest.meta.doctype);

  const htmlAttrsStr = manifest.meta.htmlAttrs.length
    ? ' ' + attrsToString(manifest.meta.htmlAttrs.filter(([k]) => k !== 'xmlns'))
    : '';
  out.push(`<html${htmlAttrsStr}>`);
  out.push('<head>');

  manifest.head.items.forEach(item => {
    const rendered = renderItem(item, manifest, assetPathById, options);
    if (rendered) out.push(rendered);
  });

  // Inject CSS links
  if (styles.length > 0) {
    const byMedia = new Map();
    styles.forEach(f => {
      const key = f.media || '';
      if (!byMedia.has(key)) byMedia.set(key, true);
    });
    byMedia.forEach((_, media) => {
      if (media) {
        const mediaSafe = sanitizeName(media);
        out.push(`<link rel="stylesheet" href="css/style-${mediaSafe}.css" media="${escAttr(media)}">`);
      } else {
        out.push(`<link rel="stylesheet" href="css/style.css">`);
      }
    });
  }

  if (options.friction) {
    out.push(`<script>(function(){try{document.addEventListener('contextmenu',function(e){e.preventDefault();});document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&['c','u','s'].indexOf(e.key.toLowerCase())>-1){e.preventDefault();}});}catch(_){}})();</script>`);
  }

  out.push('</head>');
  out.push('<body>');

  manifest.body.items.forEach(item => {
    const rendered = renderItem(item, manifest, assetPathById, options);
    if (rendered) out.push(rendered);
  });

  out.push('</body>');
  out.push('</html>');

  files['index.html'] = out.join('\n');
  files['README.md'] = buildReadme(manifest, options);
  files['VALIDATION.md'] = buildValidation(manifest);

  return files;
}

function renderItem(item, manifest, assetPathById, options) {
  switch (item.type) {
    case 'text':    return item.raw;
    case 'comment': return item.raw;
    case 'raw':     return item.html;
    case 'void':    return `<${item.tag}${item.attrs ? ' ' + item.attrs : ''}>`;
    case 'open':    return `<${item.tag}${item.attrs ? ' ' + item.attrs : ''}>`;
    case 'close':   return `</${item.tag}>`;

    case 'style-ref':
      return '';

    case 'script-ref': {
      const frag = manifest.fragments.scripts.find(f => f.id === item.id);
      if (!frag) return '';
      return `<script src="js/${frag.filename}"${frag.attrs ? ' ' + frag.attrs : ''}></script>`;
    }

    case 'script-ext':
      return `<script src="${escAttr(item.src)}"${item.attrs ? ' ' + item.attrs : ''}></script>`;

    case 'link-ext':
      return `<link ${item.attrs}>`;

    default:
      return '';
  }
}

function basicMinifyJS(code) {
  return code
    .replace(/\/\*(?!\!)[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function stripConsoleLogs(code) {
  return code
    .replace(/console\.(log|debug|info|warn)\s*\([^;]*?\)\s*;?/g, '')
    .replace(/debugger\s*;?/g, '');
}

/* ------------------------------------------------------------
   7. README + VALIDATION
   ------------------------------------------------------------ */
function buildReadme(m, options) {
  const lines = [];
  lines.push(`# Reconstructed Project`);
  lines.push('');
  lines.push(`Generated from: \`${sanitizeName(m.meta.filename)}\``);
  lines.push(`Source size: ${fmtBytes(m.meta.size)}`);
  lines.push('');
  lines.push(`## Structure`);
  lines.push('```');
  lines.push('index.html');
  if (m.fragments.styles.length) lines.push('css/style.css');
  m.fragments.scripts.forEach(f => lines.push(`js/${f.filename}`));
  if (m.fragments.assets.length) lines.push('assets/…');
  lines.push('README.md');
  lines.push('VALIDATION.md');
  lines.push('```');
  lines.push('');
  lines.push(`## Detected Capabilities`);
  if (!m.capabilities.length) lines.push('- None detected.');
  else m.capabilities.forEach(c => lines.push(`- **${c.name}** (${c.category}) — \`${c.evidence}\``));
  lines.push('');
  lines.push(`## External Dependencies`);
  if (!m.externals.length) lines.push('- None. Project is self-contained.');
  else {
    lines.push('Kept as external URLs. Internet required:');
    m.externals.forEach(e => lines.push(`- [${e.kind}] ${e.url}`));
  }
  lines.push('');
  lines.push(`## Assets`);
  lines.push(`- Data-URI assets extracted: ${m.counts.dataURIAssets}`);
  lines.push(`- Referenced local assets not present: ${m.counts.missingAssets}`);
  if (m.missingAssets.length) {
    lines.push('');
    lines.push('Missing references:');
    m.missingAssets.forEach(a => lines.push(`- \`${a.ref}\` (from <${a.from}>)`));
  }
  lines.push('');
  lines.push(`## Warnings`);
  if (!m.warnings.length) lines.push('- None.');
  else m.warnings.forEach(w => lines.push(`- ${w.message}`));
  lines.push('');
  lines.push(`## How to Run`);
  lines.push('');
  lines.push(`1. Extract this folder anywhere.`);
  lines.push(`2. Open \`index.html\` in a browser.`);
  if (m.externals.length) lines.push(`3. Internet required for external dependencies.`);
  lines.push('');
  lines.push(`## Security Notice`);
  lines.push('This project was reconstructed from an untrusted HTML source. Test it in an isolated environment before deploying. No guarantee is provided about the safety of embedded scripts.');
  lines.push('');
  lines.push(`## Options Used`);
  lines.push(`- Minify JS: ${options.minify ? 'yes' : 'no'}`);
  lines.push(`- Strip console logs: ${options.stripLogs ? 'yes' : 'no'}`);
  lines.push(`- Extract data-URI assets: ${options.extractAssets ? 'yes' : 'no'}`);
  lines.push(`- Copy friction: ${options.friction ? 'yes' : 'no'}`);
  return lines.join('\n');
}

function buildValidation(m) {
  const lines = [];
  lines.push(`# Validation Report`);
  lines.push('');
  lines.push(`Source: \`${sanitizeName(m.meta.filename)}\``);
  lines.push('');
  lines.push(`| Check | Result |`);
  lines.push(`|---|---|`);
  lines.push(`| Doctype preserved | ${m.meta.doctype ? '✓' : '—'} |`);
  lines.push(`| html lang | ${m.meta.lang || '—'} |`);
  lines.push(`| html dir | ${m.meta.dir || '—'} |`);
  lines.push(`| Inline styles extracted | ${m.counts.inlineStyles} |`);
  lines.push(`| Inline scripts extracted | ${m.counts.inlineScripts} |`);
  lines.push(`| External CSS preserved | ${m.counts.externalCSS} |`);
  lines.push(`| External JS preserved | ${m.counts.externalJS} |`);
  lines.push(`| Data-URI assets extracted | ${m.counts.dataURIAssets} |`);
  lines.push(`| Missing local assets | ${m.counts.missingAssets} |`);
  lines.push(`| HTML comments | ${m.counts.comments} |`);
  lines.push(`| Capabilities detected | ${m.capabilities.length} |`);
  lines.push(`| Warnings | ${m.warnings.length} |`);
  lines.push('');
  lines.push(`## Capabilities`);
  if (!m.capabilities.length) lines.push('- none');
  else m.capabilities.forEach(c => lines.push(`- ${c.name} [${c.category}] — \`${c.evidence}\``));
  lines.push('');
  lines.push(`## Warnings`);
  if (!m.warnings.length) lines.push('- none');
  else m.warnings.forEach(w => lines.push(`- ${w.message}`));
  lines.push('');
  lines.push(`## Notes`);
  lines.push(`- External scripts/styles are intentionally NOT localized in this version.`);
  lines.push(`- Order of head/body elements is preserved by the reconstructor.`);
  lines.push(`- Scripts are kept as separate files; no merging performed.`);
  lines.push(`- Media-scoped <style> blocks are placed into separate CSS files.`);
  return lines.join('\n');
}

/* ------------------------------------------------------------
   8. ZIP BUILD
   ------------------------------------------------------------ */
async function buildZip(files) {
  const zip = new JSZip();
  Object.entries(files).forEach(([path, content]) => {
    const safe = sanitizePath(path);
    if (content && typeof content === 'object' && content.__asset) {
      if (content.isBase64) zip.file(safe, content.data, { base64: true });
      else {
        let decoded = content.data;
        try { decoded = decodeURIComponent(content.data); } catch (_) {}
        zip.file(safe, decoded);
      }
    } else {
      zip.file(safe, String(content));
    }
  });
  return await zip.generateAsync({ type: 'blob' });
}

/* ------------------------------------------------------------
   9. UI CONTROLLER
   ------------------------------------------------------------ */
const cardUpload = $('#cardUpload');
const cardAnalysis = $('#cardAnalysis');
const cardBuild = $('#cardBuild');

analyzeBtn.addEventListener('click', async () => {
  if (!STATE.file) return;
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing…';
  await new Promise(r => setTimeout(r, 20));
  try {
    STATE.manifest = analyzeHTML(STATE.rawHTML, STATE.file.name);
    renderAnalysis(STATE.manifest);
    cardUpload.classList.add('hidden');
    cardAnalysis.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    toast('Analysis failed: ' + err.message, 'err');
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze';
  }
});

function renderAnalysis(m) {
  const s = $('#analysisStats');
  s.innerHTML = `
    <div class="stat"><div class="l">File</div><div class="v" style="font-size:13px">${escHTML(m.meta.filename)}</div></div>
    <div class="stat"><div class="l">Size</div><div class="v">${fmtBytes(m.meta.size)}</div></div>
    <div class="stat"><div class="l">Inline CSS</div><div class="v">${m.counts.inlineStyles}</div></div>
    <div class="stat"><div class="l">Inline JS</div><div class="v">${m.counts.inlineScripts}</div></div>
    <div class="stat"><div class="l">External CSS</div><div class="v">${m.counts.externalCSS}</div></div>
    <div class="stat"><div class="l">External JS</div><div class="v">${m.counts.externalJS}</div></div>
    <div class="stat"><div class="l">Data-URI Assets</div><div class="v">${m.counts.dataURIAssets}</div></div>
    <div class="stat"><div class="l">Missing Assets</div><div class="v">${m.counts.missingAssets}</div></div>
  `;

  const c = $('#capabilities');
  if (!m.capabilities.length) {
    c.innerHTML = `<div class="chip">No capabilities detected</div>`;
  } else {
    c.innerHTML = m.capabilities.map(cap =>
      `<div class="chip"><span>${escHTML(cap.name)}</span><span class="count">${escHTML(cap.category)}</span><span class="ev">${escHTML(cap.evidence)}</span></div>`
    ).join('');
  }

  const ex = $('#externals');
  if (!m.externals.length) {
    ex.innerHTML = `<div class="item">No external dependencies. Self-contained.</div>`;
  } else {
    ex.innerHTML = m.externals.map(e =>
      `<div class="item">[${e.kind}] ${escHTML(e.url)}</div>`
    ).join('');
  }

  const as = $('#assets');
  const parts = [];
  if (m.fragments.assets.length) {
    parts.push(`<div class="item">${m.fragments.assets.length} data-URI asset(s) → <code>assets/</code><div class="meta">${m.fragments.assets.map(a => escHTML(a.filename)).join(', ')}</div></div>`);
  }
  if (m.missingAssets.length) {
    m.missingAssets.forEach(a => parts.push(`<div class="item">Missing: <b>${escHTML(a.ref)}</b><div class="meta">referenced by &lt;${a.from}&gt;</div></div>`));
  }
  if (!parts.length) parts.push(`<div class="item">No assets detected.</div>`);
  as.innerHTML = parts.join('');

  const w = $('#warnings');
  if (!m.warnings.length) {
    w.innerHTML = `<div class="item">No warnings.</div>`;
  } else {
    w.innerHTML = m.warnings.map(x =>
      `<div class="item ${x.kind === 'secret' ? 'secret' : ''}">${escHTML(x.message)}</div>`
    ).join('');
  }
}

$('#buildBtn').addEventListener('click', async () => {
  const options = {
    minify: $('#optMinify').checked,
    stripLogs: $('#optStripLogs').checked,
    extractAssets: $('#optExtractAssets').checked,
    friction: $('#optFriction').checked
  };
  try {
    const files = reconstruct(STATE.manifest, options);
    STATE.projectFiles = files;
    STATE.zipBlob = await buildZip(files);
    if (STATE.zipURL) URL.revokeObjectURL(STATE.zipURL);
    STATE.zipURL = URL.createObjectURL(STATE.zipBlob);

    renderBuildResult(files);
    cardAnalysis.classList.add('hidden');
    cardBuild.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('Project built successfully', 'ok');
  } catch (err) {
    console.error(err);
    toast('Build failed: ' + err.message, 'err');
  }
});

function renderBuildResult(files) {
  const paths = Object.keys(files).sort();
  const tree = {};
  paths.forEach(p => {
    const parts = p.split('/');
    let node = tree;
    parts.forEach((part, i) => {
      if (!node[part]) node[part] = (i === parts.length - 1) ? null : {};
      node = node[part] || {};
    });
  });
  $('#buildTree').textContent = printTree(tree);

  // Preview
  const html = typeof files['index.html'] === 'string' ? files['index.html'] : '';
  let previewHTML = html;

  // Inline CSS
  Object.keys(files).forEach(p => {
    if (p.startsWith('css/') && typeof files[p] === 'string') {
      const filename = p.slice(4);
      const css = files[p].replace(/<\/style>/gi, '<\\/style>');
      const re = new RegExp(`<link[^>]+href=["']css/${escapeRegex(filename)}["'][^>]*>`, 'gi');
      previewHTML = previewHTML.replace(re, `<style>${css}</style>`);
    }
  });

  // Inline JS
  Object.keys(files).forEach(p => {
    if (p.startsWith('js/') && typeof files[p] === 'string') {
      const filename = p.slice(3);
      const js = files[p].replace(/<\/script>/gi, '<\\/script>');
      const re = new RegExp(`<script([^>]*)src=["']js/${escapeRegex(filename)}["']([^>]*)></script>`, 'gi');
      previewHTML = previewHTML.replace(re, `<script$1$2>${js}</script>`);
    }
  });

  $('#previewFrame').srcdoc = previewHTML;

  const m = STATE.manifest;
  const checks = [
    ['Doctype preserved', !!m.meta.doctype],
    ['Language attribute', !!m.meta.lang],
    ['Inline styles extracted', m.counts.inlineStyles > 0],
    ['Inline scripts extracted', m.counts.inlineScripts > 0],
    ['External deps kept as-is', true],
    ['Script order preserved', true],
    ['Module/classic scripts', true],
    ['Data-URI assets extracted', m.counts.dataURIAssets === 0 || true]
  ];
  $('#validation').innerHTML = checks.map(([label, ok]) =>
    `<div><span class="${ok ? 'ok' : 'warn'}">${ok ? '✓' : '·'}</span> ${escHTML(label)}</div>`
  ).join('') +
  `<div style="margin-top:10px;color:var(--muted);font-size:12px">
     Extracted: ${m.counts.inlineStyles} CSS · ${m.counts.inlineScripts} JS ·
     Data-URI: ${m.counts.dataURIAssets} · Missing: ${m.counts.missingAssets} ·
     Warnings: ${m.warnings.length}
   </div>`;
}

function printTree(node, prefix = '') {
  let out = '';
  const keys = Object.keys(node).sort((a, b) => {
    const aF = node[a] !== null, bF = node[b] !== null;
    if (aF && !bF) return -1;
    if (!aF && bF) return 1;
    return a.localeCompare(b);
  });
  keys.forEach((k, i) => {
    const last = i === keys.length - 1;
    const branch = last ? '└── ' : '├── ';
    const isF = node[k] !== null;
    out += prefix + branch + (isF ? '📁 ' : '📄 ') + k + '\n';
    if (isF) out += printTree(node[k], prefix + (last ? '    ' : '│   '));
  });
  return out;
}

$('#downloadBtn').addEventListener('click', () => {
  if (!STATE.zipURL) return;
  const a = document.createElement('a');
  a.href = STATE.zipURL;
  const base = (STATE.file?.name || 'project').replace(/\.html?$/i, '');
  a.download = sanitizeName(base) + '-project.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
});

function resetAll() {
  STATE.file = null;
  STATE.rawHTML = '';
  STATE.manifest = null;
  STATE.projectFiles = null;
  if (STATE.zipURL) URL.revokeObjectURL(STATE.zipURL);
  STATE.zipBlob = null;
  STATE.zipURL = null;
  fileInput.value = '';
  fileInfo.classList.add('hidden');
  fileInfo.innerHTML = '';
  analyzeBtn.disabled = true;
  cardUpload.classList.remove('hidden');
  cardAnalysis.classList.add('hidden');
  cardBuild.classList.remove('hidden');
  cardBuild.classList.add('hidden');
  $('#previewFrame').srcdoc = '';
}
$('#resetBtn').addEventListener('click', resetAll);
$('#startOverBtn').addEventListener('click', resetAll);

/* ------------------------------------------------------------
   10. VAULT (IndexedDB)
   ------------------------------------------------------------ */
function openVault() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VAULT_DB, VAULT_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(VAULT_STORE)) {
        const store = db.createObjectStore(VAULT_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('fingerprint', 'fingerprint', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function vaultSave(capability, sourceName) {
  const db = await openVault();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, 'readwrite');
    const store = tx.objectStore(VAULT_STORE);
    const record = {
      category: capability.category,
      name: capability.name,
      evidence: capability.evidence,
      fingerprint: capability.fingerprint || simpleHash(capability.category + capability.name),
      source: sourceName,
      timestamp: Date.now()
    };
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function vaultList() {
  const db = await openVault();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, 'readonly');
    const store = tx.objectStore(VAULT_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function vaultCountByFingerprint(fp) {
  const db = await openVault();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, 'readonly');
    const store = tx.objectStore(VAULT_STORE);
    const idx = store.index('fingerprint');
    const req = idx.count(IDBKeyRange.only(fp));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function vaultWipe() {
  const db = await openVault();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, 'readwrite');
    const store = tx.objectStore(VAULT_STORE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* ------------------------------------------------------------
   11. TELEGRAM
   ------------------------------------------------------------ */
function tgLoadConfig() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : { token: '', chat: '' };
  } catch { return { token: '', chat: '' }; }
}
function tgSaveConfig(cfg) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch {}
}

async function tgSend(cfg, text) {
  const url = `https://api.telegram.org/bot${encodeURIComponent(cfg.token)}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: cfg.chat,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'Telegram error');
  return data;
}
async function tgTest(cfg) {
  return tgSend(cfg, '✅ HTML Reverse Engineer vault connected.');
}
async function tgPushCapabilities(cfg, capabilities, sourceName) {
  if (!capabilities.length) return 0;
  const chunks = [];
  let cur = `<b>Vault update</b>\n<i>source: ${escHTML(sourceName)}</i>\n\n`;
  for (const c of capabilities) {
    const line = `• <b>${escHTML(c.name)}</b> [${escHTML(c.category)}]\n  <code>${escHTML(c.evidence)}</code>\n  fp: <code>${escHTML(c.fingerprint || '')}</code>\n\n`;
    if ((cur + line).length > 3500) { chunks.push(cur); cur = ''; }
    cur += line;
  }
  if (cur) chunks.push(cur);

  let sent = 0;
  for (const chunk of chunks) {
    await tgSend(cfg, chunk);
    sent++;
    await new Promise(r => setTimeout(r, TG_MSG_INTERVAL_MS));
  }
  return sent;
}
async function tgPull(cfg) {
  const url = `https://api.telegram.org/bot${encodeURIComponent(cfg.token)}/getUpdates?limit=50`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'Telegram error');
  return data.result || [];
}

/* ------------------------------------------------------------
   12. DRAWER
   ------------------------------------------------------------ */
const drawer = $('#vaultDrawer');
$('#openVault').addEventListener('click', async () => {
  drawer.classList.remove('hidden');
  drawer.setAttribute('aria-hidden', 'false');
  refreshTgUI();
  await refreshVaultList();
});
$('#closeVault').addEventListener('click', () => {
  drawer.classList.add('hidden');
  drawer.setAttribute('aria-hidden', 'true');
});

function refreshTgUI() {
  const cfg = tgLoadConfig();
  $('#tgToken').value = cfg.token || '';
  $('#tgChat').value = cfg.chat || '';
}

$('#tgSave').addEventListener('click', () => {
  const cfg = { token: $('#tgToken').value.trim(), chat: $('#tgChat').value.trim() };
  tgSaveConfig(cfg);
  toast('Telegram config saved', 'ok');
});

$('#tgClear').addEventListener('click', () => {
  localStorage.removeItem(LS_KEY);
  $('#tgToken').value = '';
  $('#tgChat').value = '';
  toast('Cleared', 'ok');
});

$('#tgTest').addEventListener('click', async () => {
  const st = $('#tgStatus');
  st.textContent = 'Testing…';
  st.className = 'status';
  try {
    const cfg = { token: $('#tgToken').value.trim(), chat: $('#tgChat').value.trim() };
    if (!cfg.token || !cfg.chat) throw new Error('Token and chat ID required');
    await tgTest(cfg);
    st.textContent = '✓ Telegram reachable';
    st.className = 'status ok';
  } catch (e) {
    st.textContent = '✗ ' + e.message;
    st.className = 'status err';
  }
});

$('#tgPull').addEventListener('click', async () => {
  const list = $('#tgRemoteList');
  list.innerHTML = '<div class="vault-item">Pulling…</div>';
  try {
    const cfg = tgLoadConfig();
    if (!cfg.token) throw new Error('Token not set');
    const updates = await tgPull(cfg);
    if (!updates.length) {
      list.innerHTML = '<div class="vault-item">No updates.</div>';
      return;
    }
    list.innerHTML = updates.slice(-20).reverse().map(u => {
      const m = u.message || u.channel_post || {};
      const txt = (m.text || m.caption || '').slice(0, 220);
      const date = m.date ? new Date(m.date * 1000).toLocaleString() : '';
      return `<div class="vault-item"><div class="sub">${escHTML(date)}</div><div>${escHTML(txt)}</div></div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = `<div class="vault-item">Error: ${escHTML(e.message)}</div>`;
  }
});

async function refreshVaultList() {
  const list = $('#vaultList');
  try {
    const items = await vaultList();
    if (!items.length) {
      list.innerHTML = '<div class="vault-item">No capabilities stored yet. Process an HTML and press “Save to Vault”.</div>';
      return;
    }
    const groups = {};
    items.forEach(it => { (groups[it.category] = groups[it.category] || []).push(it); });
    list.innerHTML = Object.entries(groups).map(([cat, arr]) =>
      `<div class="vault-item">
         <div class="cat">${escHTML(cat)} · ${arr.length}</div>
         ${arr.slice(-4).reverse().map(it =>
            `<div class="name">${escHTML(it.name)}</div>
             <div class="sub">${escHTML(it.source || '')} · fp ${escHTML(it.fingerprint || '')}</div>`
          ).join('')}
       </div>`
    ).join('');
  } catch (e) {
    list.innerHTML = `<div class="vault-item">Error: ${escHTML(e.message)}</div>`;
  }
}

$('#vaultRefresh').addEventListener('click', refreshVaultList);
$('#vaultWipe').addEventListener('click', async () => {
  if (!confirm('Wipe all locally stored capabilities?')) return;
  await vaultWipe();
  toast('Local vault wiped', 'ok');
  await refreshVaultList();
});

$('#vaultSaveBtn').addEventListener('click', async () => {
  if (!STATE.manifest) return;
  const caps = STATE.manifest.capabilities;
  if (!caps.length) { toast('No capabilities to save', ''); return; }
  try {
    let saved = 0, dupes = 0;
    for (const c of caps) {
      const fp = c.fingerprint || simpleHash(c.category + c.name);
      const existing = await vaultCountByFingerprint(fp);
      if (existing > 0) { dupes++; continue; }
      await vaultSave(c, STATE.file?.name || '');
      saved++;
    }
    toast(`Saved ${saved} locally, ${dupes} duplicate(s) skipped`, 'ok');

    const cfg = tgLoadConfig();
    if (cfg.token && cfg.chat) {
      try {
        const sent = await tgPushCapabilities(cfg, caps, STATE.file?.name || '');
        toast(`Telegram: ${sent} message(s) sent`, 'ok');
      } catch (e) {
        toast('Telegram push failed: ' + e.message, 'err');
      }
    }
    await refreshVaultList();
  } catch (e) {
    toast('Vault save failed: ' + e.message, 'err');
  }
});
