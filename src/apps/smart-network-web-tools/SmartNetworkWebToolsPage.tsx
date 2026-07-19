import { useMemo, useState } from "react";
import { ToolAppHeader } from "../../shared/components/tools/ToolAppHeader";
import "./SmartNetworkWebToolsPage.css";

type Tab =
  | "url"
  | "codec"
  | "base64"
  | "cidr"
  | "uuid"
  | "timestamp"
  | "browser";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "url", label: "URL Analyzer" },
  { id: "codec", label: "URL Encode / Decode" },
  { id: "base64", label: "Base64" },
  { id: "cidr", label: "IPv4 / CIDR" },
  { id: "uuid", label: "UUID Generator" },
  { id: "timestamp", label: "Timestamp" },
  { id: "browser", label: "Browser Info" },
];

const toBinary = (ip: string): number | null => {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return (((nums[0] << 24) >>> 0) + (nums[1] << 16) + (nums[2] << 8) + nums[3]) >>> 0;
};

const fromBinary = (value: number) =>
  [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");

const randomUuid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const safeCopy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
};

export function SmartNetworkWebToolsPage() {
  const [tab, setTab] = useState<Tab>("url");

  const [urlInput, setUrlInput] = useState("https://example.com/path?q=hello#section");
  const parsedUrl = useMemo(() => {
    try {
      const url = new URL(urlInput);
      return {
        valid: true,
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || "(default)",
        pathname: url.pathname,
        search: url.search || "(none)",
        hash: url.hash || "(none)",
        origin: url.origin,
        params: Array.from(url.searchParams.entries()),
      };
    } catch {
      return { valid: false, params: [] as Array<[string, string]> };
    }
  }, [urlInput]);

  const [codecInput, setCodecInput] = useState("hello world?name=Praveen");
  const [codecOutput, setCodecOutput] = useState("");

  const [base64Input, setBase64Input] = useState("Hello from 1 Hub Apps");
  const [base64Output, setBase64Output] = useState("");

  const [ip, setIp] = useState("192.168.1.10");
  const [prefix, setPrefix] = useState(24);
  const cidr = useMemo(() => {
    const value = toBinary(ip);
    if (value === null || prefix < 0 || prefix > 32) return null;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    const network = (value & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    const total = 2 ** (32 - prefix);
    const usable = prefix >= 31 ? total : Math.max(0, total - 2);
    return {
      mask: fromBinary(mask),
      network: fromBinary(network),
      broadcast: fromBinary(broadcast),
      firstHost: prefix >= 31 ? fromBinary(network) : fromBinary((network + 1) >>> 0),
      lastHost: prefix >= 31 ? fromBinary(broadcast) : fromBinary((broadcast - 1) >>> 0),
      total,
      usable,
    };
  }, [ip, prefix]);

  const [uuidCount, setUuidCount] = useState(5);
  const [uuids, setUuids] = useState<string[]>(() => Array.from({ length: 5 }, randomUuid));

  const [timestampInput, setTimestampInput] = useState(() => String(Math.floor(Date.now() / 1000)));
  const timestampResult = useMemo(() => {
    const raw = Number(timestampInput);
    if (!Number.isFinite(raw)) return null;
    const milliseconds = raw < 1e12 ? raw * 1000 : raw;
    const date = new Date(milliseconds);
    if (Number.isNaN(date.getTime())) return null;
    return {
      local: date.toLocaleString(),
      iso: date.toISOString(),
      utc: date.toUTCString(),
      seconds: Math.floor(date.getTime() / 1000),
      milliseconds: date.getTime(),
    };
  }, [timestampInput]);

  const browserInfo = useMemo(
    () => ({
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages?.join(", ") || navigator.language,
      platform: navigator.platform || "Unavailable",
      cookies: navigator.cookieEnabled ? "Enabled" : "Disabled",
      online: navigator.onLine ? "Online" : "Offline",
      screen: `${window.screen.width} × ${window.screen.height}`,
      viewport: `${window.innerWidth} × ${window.innerHeight}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
    []
  );

  return (
    <main className="tool-page network-web-tools-page">
      <div className="network-web-tools-shell">
        <ToolAppHeader
          appNumber="015"
          title="Smart Network & Web Tools"
          description="Analyze URLs, encode data, calculate IPv4/CIDR ranges and inspect browser details — all locally in your browser."
        />
<section className="network-web-tabs" aria-label="Tool sections">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "network-web-tab active" : "network-web-tab"}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </section>

        <section className="network-web-card">
          {tab === "url" && (
            <>
              <h2>URL Analyzer</h2>
              <p>Paste any URL to break it into protocol, host, path, query parameters and hash.</p>
              <label>
                URL
                <textarea value={urlInput} onChange={(e) => setUrlInput(e.target.value)} rows={3} />
              </label>

              {!parsedUrl.valid ? (
                <div className="network-web-error">Enter a valid absolute URL, including http:// or https://.</div>
              ) : (
                <div className="network-web-grid">
                  {[
                    ["Protocol", parsedUrl.protocol],
                    ["Hostname", parsedUrl.hostname],
                    ["Port", parsedUrl.port],
                    ["Path", parsedUrl.pathname],
                    ["Query", parsedUrl.search],
                    ["Hash", parsedUrl.hash],
                    ["Origin", parsedUrl.origin],
                  ].map(([label, value]) => (
                    <div className="network-web-result" key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              )}

              {parsedUrl.valid && parsedUrl.params.length > 0 && (
                <>
                  <h3>Query Parameters</h3>
                  <div className="network-web-table">
                    {parsedUrl.params.map(([key, value], index) => (
                      <div className="network-web-row" key={`${key}-${index}`}>
                        <code>{key}</code>
                        <code>{value}</code>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {tab === "codec" && (
            <>
              <h2>URL Encode / Decode</h2>
              <label>
                Input
                <textarea value={codecInput} onChange={(e) => setCodecInput(e.target.value)} rows={6} />
              </label>
              <div className="network-web-actions">
                <button type="button" onClick={() => setCodecOutput(encodeURIComponent(codecInput))}>Encode component</button>
                <button
                  type="button"
                  onClick={() => {
                    try { setCodecOutput(decodeURIComponent(codecInput)); }
                    catch { setCodecOutput("Invalid encoded input."); }
                  }}
                >
                  Decode component
                </button>
                <button type="button" onClick={() => setCodecOutput(encodeURI(codecInput))}>Encode URI</button>
                <button type="button" onClick={() => setCodecOutput("")}>Clear output</button>
              </div>
              <label>
                Output
                <textarea value={codecOutput} readOnly rows={6} />
              </label>
              <button type="button" className="secondary" onClick={() => safeCopy(codecOutput)} disabled={!codecOutput}>Copy output</button>
            </>
          )}

          {tab === "base64" && (
            <>
              <h2>Base64 Encode / Decode</h2>
              <label>
                Input
                <textarea value={base64Input} onChange={(e) => setBase64Input(e.target.value)} rows={6} />
              </label>
              <div className="network-web-actions">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const bytes = new TextEncoder().encode(base64Input);
                      let binary = "";
                      bytes.forEach((b) => (binary += String.fromCharCode(b)));
                      setBase64Output(btoa(binary));
                    } catch {
                      setBase64Output("Could not encode input.");
                    }
                  }}
                >
                  Encode
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const binary = atob(base64Input.trim());
                      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
                      setBase64Output(new TextDecoder().decode(bytes));
                    } catch {
                      setBase64Output("Invalid Base64 input.");
                    }
                  }}
                >
                  Decode
                </button>
                <button type="button" onClick={() => setBase64Output("")}>Clear output</button>
              </div>
              <label>
                Output
                <textarea value={base64Output} readOnly rows={6} />
              </label>
              <button type="button" className="secondary" onClick={() => safeCopy(base64Output)} disabled={!base64Output}>Copy output</button>
            </>
          )}

          {tab === "cidr" && (
            <>
              <h2>IPv4 / CIDR Calculator</h2>
              <div className="network-web-two-col">
                <label>
                  IPv4 address
                  <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.1.10" />
                </label>
                <label>
                  CIDR prefix
                  <input
                    type="number"
                    min={0}
                    max={32}
                    value={prefix}
                    onChange={(e) => setPrefix(Number(e.target.value))}
                  />
                </label>
              </div>
              {!cidr ? (
                <div className="network-web-error">Enter a valid IPv4 address and prefix from 0 to 32.</div>
              ) : (
                <div className="network-web-grid">
                  {[
                    ["Subnet mask", cidr.mask],
                    ["Network", cidr.network],
                    ["Broadcast", cidr.broadcast],
                    ["First host", cidr.firstHost],
                    ["Last host", cidr.lastHost],
                    ["Total addresses", cidr.total.toLocaleString()],
                    ["Usable hosts", cidr.usable.toLocaleString()],
                  ].map(([label, value]) => (
                    <div className="network-web-result" key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "uuid" && (
            <>
              <h2>UUID Generator</h2>
              <div className="network-web-two-col">
                <label>
                  Count
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={uuidCount}
                    onChange={(e) => setUuidCount(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                  />
                </label>
                <div className="network-web-inline-button">
                  <button type="button" onClick={() => setUuids(Array.from({ length: uuidCount }, randomUuid))}>Generate UUIDs</button>
                </div>
              </div>
              <textarea value={uuids.join("\n")} readOnly rows={Math.min(12, Math.max(5, uuids.length))} />
              <button type="button" className="secondary" onClick={() => safeCopy(uuids.join("\n"))}>Copy all</button>
            </>
          )}

          {tab === "timestamp" && (
            <>
              <h2>Unix Timestamp Converter</h2>
              <label>
                Unix timestamp (seconds or milliseconds)
                <input value={timestampInput} onChange={(e) => setTimestampInput(e.target.value)} />
              </label>
              <div className="network-web-actions">
                <button type="button" onClick={() => setTimestampInput(String(Math.floor(Date.now() / 1000)))}>Use current time</button>
              </div>
              {!timestampResult ? (
                <div className="network-web-error">Enter a valid Unix timestamp.</div>
              ) : (
                <div className="network-web-grid">
                  {[
                    ["Local time", timestampResult.local],
                    ["ISO 8601", timestampResult.iso],
                    ["UTC", timestampResult.utc],
                    ["Seconds", String(timestampResult.seconds)],
                    ["Milliseconds", String(timestampResult.milliseconds)],
                  ].map(([label, value]) => (
                    <div className="network-web-result" key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "browser" && (
            <>
              <h2>Browser & Device Info</h2>
              <p>Useful environment details available directly from your browser.</p>
              <div className="network-web-grid">
                {Object.entries(browserInfo).map(([key, value]) => (
                  <div className="network-web-result" key={key}>
                    <span>{key.replace(/([A-Z])/g, " $1")}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  safeCopy(
                    Object.entries(browserInfo)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join("\n")
                  )
                }
              >
                Copy browser info
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default SmartNetworkWebToolsPage;
