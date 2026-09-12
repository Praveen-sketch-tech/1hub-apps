#!/usr/bin/env node
/**
 * api-hunter-node.js
 * Read-only local API discovery + optional live capture.
 *
 * Usage:
 *   node api-hunter-node.js <url>
 *   node api-hunter-node.js <url> --json out.json
 *   node api-hunter-node.js <url> --live --depth 2 --json out.json
 *   node api-hunter-node.js <url> --live --headful
 *
 * Static mode: fetch HTML/JS server-side (no CORS), extract evidence-tagged endpoints.
 * Live mode:   Playwright drives Chromium, records real network requests.
 *
 * Safety: GET/HEAD only. No auth bypass. No destructive requests. No writes to target.
 */

"use strict";

const fs = require("fs");

const args = process.argv.slice(2);
if (!args.length || args[0].startsWith("--")) {
  console.error("Usage: node api-hunter-node.js <url> [--json out.json] [--live] [--headful] [--depth N]");
  process.exit(1);
}

const targetUrl = args[0];
const flag = (name) => args.includes(name);
const valueOf = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const LIVE = flag("--live");
const HEADFUL = flag("--headful");
const DEPTH = parseInt(valueOf("--depth", "2"), 10);
const OUT = valueOf("--json", null);

/* ---------------- shared helpers ---------------- */

function safeUrl(u, base) {
  try { return new URL(u, base).href; } catch { return null; }
}
function sameOrigin(a, b) {
  try { return new URL(a).origin === new URL(b).origin; } catch { return false; }
}
function isStatic(url) {
  return /\.(png|jpe?g|gif|svg|webp|ico|css|woff2?|ttf|eot|mp4|webm|mp3|wav|pdf|zip)(\?|$)/i.test(url);
}
function isAnalytics(url) {
  return /(google-analytics|googletagmanager|facebook\.com\/tr|hotjar|mixpanel|segment\.io|doubleclick|analytics|tracking|pixel)/i.test(url);
}
function isSocial(url) {
  return /(twitter\.com|facebook\.com|linkedin\.com|instagram\.com|youtube\.com|github\.com|discord\.gg|t\.me)/i.test(url);
}
function isDocsLink(url) {
  return /(docs|documentation|developer|endpoint|swagger|openapi|redoc|reference)/i.test(url);
}

/* ---- narrow 400 classification + required-param detection (new) ---- */

function looksLikeMissingParam400(body) {
  if (!body) return false;
  const b = String(body).toLowerCase();
  if (/parameter\s+is\s+required/.test(b)) return true;
  if (/\bparameter\s+required\b/.test(b)) return true;
  if (/\bmissing\s+parameter\b/.test(b)) return true;
  if (/\bmissing\s+required\b/.test(b)) return true;
  if (/\brequired\s+parameter\b/.test(b)) return true;
  if (/provide\s+a\s+valid\s+url/.test(b)) return true;
  if (/\burl\s+parameter\s+is\s+required\b/.test(b)) return true;
  if (/\baction\s+must\s+be\b/.test(b)) return true;
  if (/\bunknown\s+action\b/.test(b)) return true;
  if (/use\s+\?action=/.test(b)) return true;
  if (/\?action=/.test(b)) return true;
  if (/\bparam(?:eter)?\s+["'`]?\w+["'`]?\s+(?:is\s+)?(?:required|missing)\b/.test(b)) return true;
  return false;
}

/**
 * Extract required parameter names from a 400 response body.
 * Only marks a parameter required when:
 *   - the wording explicitly says it is required/missing/must be, OR
 *   - the endpoint uses the common `?action=` routing pattern and the
 *     body mentions `action` or shows `?action=` examples.
 * Optional params appearing only in examples (q, id, p, mail, name, folder)
 * are NOT globally marked required.
 */
function detectRequiredParams(body, endpointUrl) {
  const out = [];
  const push = (p) => { if (p && !out.includes(p)) out.push(p); };
  if (!body) return out;
  const s = String(body);
  const lower = s.toLowerCase();

  // 1) Explicit "X parameter is required" / "missing X" / "X is required"
  let m;
  const explicit = /\b([a-z_][a-z0-9_]{0,30})\s+parameter\s+is\s+required\b/gi;
  while ((m = explicit.exec(s))) push(m[1].toLowerCase());

  const missing = /\bmissing\s+(?:parameter\s+)?["'`]?([a-z_][a-z0-9_]{0,30})["'`]?/gi;
  while ((m = missing.exec(s))) push(m[1].toLowerCase());

  const required = /\b(?:required\s+parameter|parameter\s+required)\s*[:\s]\s*["'`]?([a-z_][a-z0-9_]{0,30})["'`]?/gi;
  while ((m = required.exec(s))) push(m[1].toLowerCase());

  const paramIsReq = /\bparam(?:eter)?\s+["'`]?([a-z_][a-z0-9_]{0,30})["'`]?\s+(?:is\s+)?(?:required|missing)\b/gi;
  while ((m = paramIsReq.exec(s))) push(m[1].toLowerCase());

  // 2) "provide a valid URL" + example with ?url=
  if (/provide\s+a\s+valid\s+url/i.test(s) && /[?&]url=/.test(s)) {
    push("url");
  }

  // 3) "action must be: ..." -> action
  if (/\baction\s+must\s+be\b/i.test(s)) {
    push("action");
  }

  // 4) "Unknown action" + "?action=" examples -> action
  if (/\bunknown\s+action\b/i.test(s) && /[?&]action=/.test(s)) {
    push("action");
  }

  // 5) "Use ?action=" -> action
  if (/use\s+\?action=/i.test(s)) {
    push("action");
  }

  // 6) Generic: response shows "?action=" or "&action=" examples for this endpoint
  if (/[?&]action=/.test(s)) {
    // Only conclude 'action' is required when the body also uses routing/error
    // language, otherwise it's just an example. Routing language:
    if (/\b(action|unknown|must|required|use)\b/i.test(lower)) {
      push("action");
    }
  }

  return out;
}

function statusFromResponse(status, body) {
  if (status >= 200 && status < 300) return "SUCCESS";
  if (status === 400) {
    if (looksLikeMissingParam400(body)) return "PARAMETER_REQUIRED";
    return "UNKNOWN";
  }
  if (status === 401 || status === 403) return "AUTH_REQUIRED";
  if (status === 404) return "NOT_FOUND";
  if (status === 405) return "METHOD_REQUIRED";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return "UNKNOWN";
}
function authFromResponse(status, headers, body) {
  if (status === 401 || status === 403) return "AUTH_REQUIRED";
  const h = (headers || "").toLowerCase();
  if (h.includes("www-authenticate")) return "AUTH_REQUIRED";
  const b = (body || "").toLowerCase();
  if (/api[\s_-]?key|bearer|token required|unauthorized|authentication required|invalid.*key/.test(b)) {
    return "AUTH_REQUIRED";
  }
  return "UNKNOWN";
}
function category(url) {
  const u = url.toLowerCase();
  const map = [
    ["ocr", /ocr/],
    ["vision", /vision|analyze.*image|image.*analy/],
    ["image generation", /image.*gen|txt2img|text2image|generate.*image|imagine|draw/],
    ["image", /image|img|photo|picture/],
    ["video", /video|mp4|movie/],
    ["audio", /audio|sound|music/],
    ["tts", /tts|text.*speech|speak|voice/],
    ["stt", /stt|speech.*text|transcribe/],
    ["translation", /translat|translate|lang/],
    ["pdf", /pdf/],
    ["document", /doc|document|word|excel/],
    ["file", /file|upload|download/],
    ["convert", /convert|transform/],
    ["search", /search|query/],
    ["screenshot", /screenshot|screen.*shot|capture/],
    ["downloader", /download|downloader/],
    ["qr", /qr|qrcode/],
    ["email", /email|mail/],
    ["ai", /ai|chat|gpt|llm|completion/],
    ["code", /code|compiler|execute|run/],
    ["utility", /util|tool|helper/]
  ];
  for (const [n, re] of map) if (re.test(u)) return n;
  return "Unknown";
}

/* ---- strict candidate validation ---- */

function isConcreteUrlString(raw) {
  if (!raw || typeof raw !== "string") return false;
  const s = raw.trim();
  if (s.length < 2 || s.length > 500) return false;
  if (/\$\{/.test(s)) return false;
  if (/\\\$\{/.test(s)) return false;
  if (/<[a-zA-Z/][^>]*>/.test(s)) return false;
  if (/\s/.test(s) && !/^https?:\/\//i.test(s)) return false;
  if (/\s{2,}/.test(s)) return false;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length >= 6 && !/[\/?=&]/.test(s)) return false;
  if (/[.!?]\s+[A-Z]/.test(s) && !/^https?:\/\//i.test(s)) return false;
  const pctCount = (s.match(/%[0-9A-Fa-f]{2}/g) || []).length;
  if (pctCount > 3 && !/^https?:\/\//i.test(s)) return false;
  if (/^[%3C%3E<>"'`]+/i.test(s)) return false;
  if (!/[\/?=&:#.]/.test(s)) return false;
  return true;
}

function safeUrlStrict(u, base) {
  if (!isConcreteUrlString(u)) return null;
  let abs;
  try { abs = new URL(u, base).href; } catch { return null; }
  if (/\$\{/.test(abs)) return null;
  if (/\s/.test(abs)) return null;
  return abs;
}

function normalizeTemplateUrl(raw, baseUrl) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s.includes("${")) return null;
  const idx = s.indexOf("${");
  const head = s.slice(0, idx);
  const tail = s.slice(idx);
  const params = [];
  let pm;
  const paramRe = /\$\{\s*([A-Za-z_$][\w$]*)/g;
  while ((pm = paramRe.exec(tail))) {
    if (!params.includes(pm[1])) params.push(pm[1]);
  }
  const qm = head.match(/[?&]([A-Za-z_][\w]*)=\s*$/);
  if (qm && !params.includes(qm[1])) params.unshift(qm[1]);
  const headClean = head.replace(/[?&]\s*$/, "");
  const abs = safeUrlStrict(headClean, baseUrl);
  if (!abs) return null;
  return { endpoint: abs, params };
}


/* ---- JSON endpoint catalog discovery ---- */

function extractJsonEndpointCatalog(body, baseUrl, sourceUrl) {
  const found = [];
  if (!body) return found;

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return found;
  }

  const walk = (value) => {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (typeof value !== "object") return;

    // Common endpoint-definition shapes:
    // { path: "/api/..." }, { url: "/api/..." },
    // { endpoint: "/api/..." }, { route: "/api/..." }
    const route = value.path || value.url || value.endpoint || value.route;
    const method = String(value.method || value.httpMethod || "GET").toUpperCase();

    if (typeof route === "string") {
      const raw = route.trim();

      if (
        raw.startsWith("/") &&
        !raw.startsWith("/Help/") &&
        !raw.startsWith("/help/")
      ) {
        const abs = safeUrlStrict(raw, baseUrl);

        if (abs && !isStatic(abs) && !isAnalytics(abs) && !isSocial(abs)) {
          found.push({
            url: abs,
            method: ["GET","HEAD","POST","PUT","PATCH","DELETE"].includes(method)
              ? method
              : "GET",
            evidence: "JSON_RESPONSE_ENDPOINT_CATALOG",
            source: sourceUrl
          });
        }
      }
    }

    Object.values(value).forEach(walk);
  };

  walk(data);
  return found;
}

/* ---------------- static mode ---------------- */

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "api-hunter/1.0" } });
  const text = await res.text();
  return { res, text };
}

function extractFromJS(jsText, sourceUrl, baseUrl) {
  const found = [];
  if (!jsText) return found;
  const push = (url, method, evidence) => {
    const norm = normalizeTemplateUrl(url, baseUrl);
    if (norm) {
      found.push({ url: norm.endpoint, method, evidence, source: sourceUrl, params_detected: norm.params });
      return;
    }
    const abs = safeUrlStrict(url, baseUrl);
    if (abs) found.push({ url: abs, method, evidence, source: sourceUrl });
  };
  let m;
  const fetchRe = /fetch\s*\(\s*([`'"])([^`'"]+)\1/g;
  while ((m = fetchRe.exec(jsText))) push(m[2], "GET", "JS_FETCH");
  const axiosRe = /axios\s*\.\s*(get|post|put|delete|patch|request)\s*\(\s*([`'"])([^`'"]+)\2/gi;
  while ((m = axiosRe.exec(jsText))) push(m[3], m[1].toUpperCase(), "JS_AXIOS");
  const xhrRe = /\.open\s*\(\s*([`'"])([A-Z]+)\1\s*,\s*([`'"])([^`'"]+)\3/g;
  while ((m = xhrRe.exec(jsText))) push(m[4], m[2], "JS_XHR");
  const apiStrRe = /[`'"]([^`'"]*\/api\/[^`'"]*)[`'"]/g;
  while ((m = apiStrRe.exec(jsText))) {
    if (!isConcreteUrlString(m[1])) continue;
    push(m[1], "GET", "JS_HEURISTIC");
  }
  const vRe = /[`'"]([^`'"]*\/v[12]\/[^`'"]*)[`'"]/g;
  while ((m = vRe.exec(jsText))) {
    if (!isConcreteUrlString(m[1])) continue;
    push(m[1], "GET", "JS_HEURISTIC");
  }
  return found;
}

function extractFromDoc(html, pageUrl) {
  const found = [];
  const codeBlocks = [];
  const re = /<(pre|code)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html))) {
    let block = m[2]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    codeBlocks.push(block);
  }

  codeBlocks.forEach(block => {
    let n;

    const curlRe = /curl\s+(?:-[A-Za-z]+\s+)*["']([^"']+)["']/g;
    while ((n = curlRe.exec(block))) {
      const raw = n[1].trim();
      if (!/^https?:\/\//i.test(raw) && !raw.startsWith("/")) continue;
      const norm = normalizeTemplateUrl(raw, pageUrl);
      if (norm) {
        found.push({ url: norm.endpoint, method: "GET", evidence: "DOCUMENTATION_CURL", source: pageUrl, params_detected: norm.params });
        continue;
      }
      const url = safeUrlStrict(raw, pageUrl);
      if (url) found.push({ url, method: "GET", evidence: "DOCUMENTATION_CURL", source: pageUrl });
    }

    const fetchRe = /fetch\s*\(\s*["'`]([^"'`]+)["'`]/g;
    while ((n = fetchRe.exec(block))) {
      const raw = n[1].trim();
      if (!/^https?:\/\//i.test(raw) && !raw.startsWith("/")) continue;
      const norm = normalizeTemplateUrl(raw, pageUrl);
      if (norm) {
        found.push({ url: norm.endpoint, method: "GET", evidence: "DOCUMENTATION_FETCH", source: pageUrl, params_detected: norm.params });
        continue;
      }
      const url = safeUrlStrict(raw, pageUrl);
      if (url) found.push({ url, method: "GET", evidence: "DOCUMENTATION_FETCH", source: pageUrl });
    }

    const axiosRe = /axios\s*\.\s*(get|post|put|delete|patch)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
    while ((n = axiosRe.exec(block))) {
      const raw = n[2].trim();
      if (!/^https?:\/\//i.test(raw) && !raw.startsWith("/")) continue;
      const norm = normalizeTemplateUrl(raw, pageUrl);
      if (norm) {
        found.push({ url: norm.endpoint, method: n[1].toUpperCase(), evidence: "DOCUMENTATION_AXIOS", source: pageUrl, params_detected: norm.params });
        continue;
      }
      const url = safeUrlStrict(raw, pageUrl);
      if (url) found.push({ url, method: n[1].toUpperCase(), evidence: "DOCUMENTATION_AXIOS", source: pageUrl });
    }

    const methodRe = /\b(GET|POST|PUT|DELETE|PATCH)\s+(\/[A-Za-z0-9_\-\/\.\{\}?=&]+)/g;
    while ((n = methodRe.exec(block))) {
      const raw = n[2].trim();
      if (!/^\/[A-Za-z0-9_\-]/i.test(raw)) continue;
      if (!isConcreteUrlString(raw)) continue;
      const norm = normalizeTemplateUrl(raw, pageUrl);
      if (norm) {
        found.push({ url: norm.endpoint, method: n[1], evidence: "DOCUMENTATION", source: pageUrl, params_detected: norm.params });
        continue;
      }
      const url = safeUrlStrict(raw, pageUrl);
      if (url) found.push({ url, method: n[1], evidence: "DOCUMENTATION", source: pageUrl });
    }
  });

  return found;
}

function extractLinks(html, baseUrl) {
  const links = [];
  const re = /<a\s+[^>]*href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const abs = safeUrl(m[1], baseUrl);
    if (abs) links.push(abs);
  }
  return links;
}
function extractScripts(html, baseUrl) {
  const scripts = [];
  const re = /<script\s+[^>]*src\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const abs = safeUrl(m[1], baseUrl);
    if (abs) scripts.push(abs);
  }
  return scripts;
}
function extractInlineScripts(html) {
  const out = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

async function runStatic(url) {
  const result = {
    website: url,
    scan_time: new Date().toISOString(),
    mode: "static",
    api_candidates: [],
    website_pages: [],
    documentation: [],
    static_resources: [],
    errors: []
  };

  let html = "";
  try {
    const { text } = await fetchText(url);
    html = text;
  } catch (e) {
    result.errors.push("Fetch failed: " + e.message);
    return result;
  }

  const links = extractLinks(html, url);
  const scripts = extractScripts(html, url).filter(s => sameOrigin(s, url));
  const inline = extractInlineScripts(html);

  const candidates = [];
  for (const jsUrl of scripts) {
    try {
      const { text } = await fetchText(jsUrl);
      candidates.push(...extractFromJS(text, jsUrl, url));
    } catch (e) {
      result.errors.push("JS fetch failed: " + jsUrl);
    }
  }
  inline.forEach(js => candidates.push(...extractFromJS(js, url, url)));

  const docUrls = [...new Set(links.filter(l => sameOrigin(l, url) && isDocsLink(l)))].slice(0, 5);
  for (const d of docUrls) {
    try {
      const { text } = await fetchText(d);
      candidates.push(...extractFromDoc(text, d));
    } catch (e) {
      result.errors.push("Doc fetch failed: " + d);
    }
  }

  links.forEach(l => {
    if (isStatic(l) || isAnalytics(l) || isSocial(l)) result.static_resources.push({ url: l });
    else if (isDocsLink(l)) result.documentation.push({ url: l });
    else if (sameOrigin(l, url)) result.website_pages.push({ url: l });
  });

  const seen = new Set();
  for (const c of candidates) {
    if (!c.url || !/^https?:\/\//i.test(c.url)) continue;
    if (/\$\{/.test(c.url)) continue;
    if (/\s/.test(c.url)) continue;
    if (isStatic(c.url) || isAnalytics(c.url) || isSocial(c.url)) continue;
    const key = c.method + " " + c.url;
    if (seen.has(key)) continue;
    seen.add(key);
    result.api_candidates.push(c);
  }

  for (let i = 0; i < result.api_candidates.length; i++) {
    const c = result.api_candidates[i];
    if (c.method !== "GET" && c.method !== "HEAD") {
      c.tested = false; c.status = "UNKNOWN"; c.auth = "UNKNOWN"; c.cors = "N/A_LOCAL";
      continue;
    }
    try {
      const res = await fetch(c.url, { method: "GET", redirect: "follow", headers: { "user-agent": "api-hunter/1.0" } });
      const text = await res.text();
      c.http_status = res.status;
      c.content_type = res.headers.get("content-type") || "";
      c.response_preview = text.slice(0, 500);
      c.status = statusFromResponse(res.status, text);
      c.auth = authFromResponse(res.status, "", text);
      c.cors = "N/A_LOCAL";
      c.tested = true;
      if (res.status === 400) {
        const detected = detectRequiredParams(text, c.url);
        if (detected.length) {
          const existing = Array.isArray(c.params_detected) ? c.params_detected : [];
          const merged = existing.slice();
          detected.forEach(p => { if (!merged.includes(p)) merged.push(p); });
          c.params_detected = merged;
        }
      }
    } catch (e) {
      c.http_status = null;
      c.status = "UNKNOWN";
      c.auth = "UNKNOWN";
      c.cors = "N/A_LOCAL";
      c.tested = true;
      c.notes = "fetch failed: " + e.message;
    }
  }

  return result;
}

/* ---------------- live mode (Playwright) ---------------- */

async function runLive(url) {
  let playwright;
  try {
    playwright = require("playwright");
  } catch (e) {
    console.error("ERROR: Playwright is not installed.");
    console.error("Install with:");
    console.error("  npm i playwright");
    console.error("  npx playwright install chromium");
    process.exit(2);
  }

  const { chromium } = playwright;
  const browser = await chromium.launch({ headless: !HEADFUL });
  const context = await browser.newContext();
  const page = await context.newPage();

  const records = new Map();
  const errors = [];

  page.on("request", req => {
    const r = req;
    const key = r.method() + " " + r.url();
    if (records.has(key)) return;
    records.set(key, {
      url: r.url(),
      method: r.method(),
      resource_type: r.resourceType(),
      request_headers: r.headers(),
      post_data: (() => { try { return r.postData(); } catch { return null; } })(),
      initiator: r.frame() ? r.frame().url() : null,
      timestamp: new Date().toISOString()
    });
  });

  page.on("response", async res => {
    const req = res.request();
    const key = req.method() + " " + req.url();
    const rec = records.get(key);
    if (!rec) return;
    rec.http_status = res.status();
    rec.content_type = res.headers()["content-type"] || "";
    const ct = rec.content_type;
    if (/json|text|javascript|xml/i.test(ct)) {
      try {
        const body = await res.text();
        rec.response_preview = body.slice(0, 500);
      } catch {
        rec.response_preview = "";
      }
    } else {
      rec.response_preview = "";
    }
  });

  page.on("requestfailed", req => {
    const key = req.method() + " " + req.url();
    const rec = records.get(key);
    if (rec) rec.failed = req.failure() ? req.failure().errorText : "unknown";
  });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  } catch (e) {
    errors.push("Navigation: " + e.message);
  }

  const visited = new Set([url]);
  let frontier = [url];
  for (let d = 0; d < DEPTH; d++) {
    const next = [];
    for (const pageUrl of frontier) {
      try {
        const hrefs = await page.$$eval("a[href]", as => as.map(a => a.href));
        for (const h of hrefs) {
          if (!h || visited.has(h)) continue;
          if (!sameOrigin(h, url)) continue;
          if (isStatic(h) || isAnalytics(h) || isSocial(h)) continue;
          visited.add(h);
          next.push(h);
        }
      } catch {}
    }
    for (const p of next.slice(0, 8)) {
      try {
        await page.goto(p, { waitUntil: "networkidle", timeout: 30000 });
      } catch (e) {
        errors.push("Nav " + p + ": " + e.message);
      }
    }
    frontier = next.slice(0, 8);
    if (!frontier.length) break;
  }

  await browser.close();

  const result = {
    website: url,
    scan_time: new Date().toISOString(),
    mode: "live",
    api_candidates: [],
    website_pages: [],
    documentation: [],
    static_resources: [],
    errors
  };

  for (const rec of records.values()) {
    if (isStatic(rec.url) || isAnalytics(rec.url) || isSocial(rec.url)) {
      result.static_resources.push({ url: rec.url, method: rec.method });
      continue;
    }
    const isLikelyApi =
      rec.resource_type === "xhr" || rec.resource_type === "fetch" ||
      /json/i.test(rec.content_type || "") ||
      /\/api\/|\/v\d\/|\/graphql/.test(rec.url) ||
      ["POST","PUT","PATCH","DELETE"].includes(rec.method);

    if (!isLikelyApi) {
      result.website_pages.push({ url: rec.url, method: rec.method });
      continue;
    }

    const preview = rec.response_preview || "";
    const status = statusFromResponse(rec.http_status, preview);
    const auth = authFromResponse(rec.http_status, JSON.stringify(rec.request_headers || {}), preview);

    const entry = {
      url: rec.url,
      method: rec.method,
      evidence: rec.resource_type === "xhr" ? "LIVE_XHR"
              : rec.resource_type === "fetch" ? "LIVE_FETCH"
              : /json/i.test(rec.content_type || "") ? "LIVE_JSON"
              : "LIVE_CAPTURE",
      source: rec.initiator || "",
      request_headers: rec.request_headers || {},
      post_data: rec.post_data || null,
      http_status: rec.http_status || null,
      content_type: rec.content_type || "",
      response_preview: preview,
      status,
      auth,
      cors: "N/A_LOCAL",
      tested: true,
      notes: rec.failed ? ("request failed: " + rec.failed) : ""
    };
    if (rec.http_status === 400) {
      const detected = detectRequiredParams(preview, rec.url);
      if (detected.length) entry.params_detected = detected;
    }
    result.api_candidates.push(entry);
  }

  return result;
}

/* ---------------- main ---------------- */

(async () => {
  let result;
  if (LIVE) {
    result = await runLive(targetUrl);
  } else {
    result = await runStatic(targetUrl);
  }

  const json = JSON.stringify(result, null, 2);
  if (OUT) {
    fs.writeFileSync(OUT, json, "utf8");
    console.error("Wrote " + OUT);
  } else {
    process.stdout.write(json);
  }

  console.error(
    "API candidates: " + result.api_candidates.length +
    " | website pages: " + result.website_pages.length +
    " | documentation: " + result.documentation.length +
    " | static: " + result.static_resources.length
  );
  if (result.errors && result.errors.length) {
    console.error("Errors: " + result.errors.length);
    result.errors.slice(0, 5).forEach(e => console.error("  - " + e));
  }
})();
