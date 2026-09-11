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
function statusFromResponse(status, body) {
  if (status >= 200 && status < 300) return "SUCCESS";
  if (status === 400) {
    const b = (body || "").toLowerCase();
    if (/parameter|missing|required|invalid/.test(b)) return "PARAMETER_REQUIRED";
    return "UNKNOWN";
  }
  if (status === 401 || status === 403) return "AUTH_REQUIRED";
  if (status === 404) return "NOT_FOUND";
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
    const abs = safeUrl(url, baseUrl);
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
  while ((m = apiStrRe.exec(jsText))) push(m[1], "GET", "JS_HEURISTIC");
  const vRe = /[`'"]([^`'"]*\/v[12]\/[^`'"]*)[`'"]/g;
  while ((m = vRe.exec(jsText))) push(m[1], "GET", "JS_HEURISTIC");
  return found;
}

function extractFromDoc(html, pageUrl) {
  const found = [];
  const codeBlocks = [];
  const re = /<(pre|code)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html))) codeBlocks.push(m[2]);
  codeBlocks.forEach(block => {
    let n;
    const curlRe = /curl\s+(?:-[A-Za-z]+\s+)*["']([^"']+)["']/g;
    while ((n = curlRe.exec(block))) {
      const url = safeUrl(n[1], pageUrl);
      if (url) found.push({ url, method: "GET", evidence: "DOCUMENTATION_CURL", source: pageUrl });
    }
    const fetchRe = /fetch\s*\(\s*["'`]([^"'`]+)["'`]/g;
    while ((n = fetchRe.exec(block))) {
      const url = safeUrl(n[1], pageUrl);
      if (url) found.push({ url, method: "GET", evidence: "DOCUMENTATION_FETCH", source: pageUrl });
    }
    const axiosRe = /axios\s*\.\s*(get|post|put|delete|patch)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
    while ((n = axiosRe.exec(block))) {
      const url = safeUrl(n[2], pageUrl);
      if (url) found.push({ url, method: n[1].toUpperCase(), evidence: "DOCUMENTATION_AXIOS", source: pageUrl });
    }
    const methodRe = /\b(GET|POST|PUT|DELETE|PATCH)\s+(\/[A-Za-z0-9_\-\/\.{}?=&]+)/g;
    while ((n = methodRe.exec(block))) {
      const url = safeUrl(n[2], pageUrl);
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

  // doc pages (same-origin, first 5)
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
    if (isStatic(c.url) || isAnalytics(c.url) || isSocial(c.url)) continue;
    const key = c.method + " " + c.url;
    if (seen.has(key)) continue;
    seen.add(key);
    result.api_candidates.push(c);
  }

  // test GET/HEAD only
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

  const records = new Map(); // key: method + url
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

  // crawl same-origin links up to depth
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

    result.api_candidates.push({
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
    });
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
