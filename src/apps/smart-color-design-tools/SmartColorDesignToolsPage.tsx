import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { ToolAppHeader } from '../../shared/components/tools/ToolAppHeader';
import { LocalProcessingBadge } from '../../shared/components/tools/LocalProcessingBadge';
import './smart-color-design-tools.css';

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };
type PaletteColor = RGB & { hex: string; count: number };

type HarmonyMode = 'complementary' | 'analogous' | 'triadic';

const clamp = (value: number, min = 0, max = 255) => Math.min(max, Math.max(min, value));
const toHex = (value: number) => clamp(Math.round(value)).toString(16).padStart(2, '0').toUpperCase();
const rgbToHex = ({ r, g, b }: RGB) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

const hexToRgb = (hex: string): RGB | null => {
  const clean = hex.trim().replace('#', '');
  const normalized = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
};

const rgbToHsl = ({ r, g, b }: RGB): HSL => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
};

const hslToRgb = ({ h, s, l }: HSL): RGB => {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r1, g1, b1] = [0, 0, 0];
  if (hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = ln - c / 2;
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
};

const luminance = ({ r, g, b }: RGB) => {
  const convert = (v: number) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * convert(r) + 0.7152 * convert(g) + 0.0722 * convert(b);
};

const contrastRatio = (a: RGB, b: RGB) => {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

const copyText = async (text: string) => {
  await navigator.clipboard.writeText(text);
};

const downloadText = (text: string, filename: string) => {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default function SmartColorDesignToolsPage() {
  const [color, setColor] = useState('#6C63FF');
  const [foreground, setForeground] = useState('#111827');
  const [background, setBackground] = useState('#FFFFFF');
  const [gradientA, setGradientA] = useState('#6C63FF');
  const [gradientB, setGradientB] = useState('#22C55E');
  const [gradientAngle, setGradientAngle] = useState(135);
  const [palette, setPalette] = useState<PaletteColor[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [harmonyMode, setHarmonyMode] = useState<HarmonyMode>('complementary');
  const [status, setStatus] = useState('Ready. Everything runs locally in your browser.');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const rgb = useMemo(() => hexToRgb(color) ?? { r: 108, g: 99, b: 255 }, [color]);
  const hsl = useMemo(() => rgbToHsl(rgb), [rgb]);
  const fgRgb = useMemo(() => hexToRgb(foreground) ?? { r: 17, g: 24, b: 39 }, [foreground]);
  const bgRgb = useMemo(() => hexToRgb(background) ?? { r: 255, g: 255, b: 255 }, [background]);
  const ratio = useMemo(() => contrastRatio(fgRgb, bgRgb), [fgRgb, bgRgb]);

  const shades = useMemo(() => {
    return Array.from({ length: 9 }, (_, index) => {
      const l = 10 + index * 10;
      const shadeRgb = hslToRgb({ ...hsl, l });
      return rgbToHex(shadeRgb);
    });
  }, [hsl]);

  const harmony = useMemo(() => {
    const offsets = harmonyMode === 'complementary' ? [0, 180] : harmonyMode === 'analogous' ? [-30, 0, 30] : [0, 120, 240];
    return offsets.map((offset) => rgbToHex(hslToRgb({ ...hsl, h: hsl.h + offset })));
  }, [hsl, harmonyMode]);

  const gradientCss = `linear-gradient(${gradientAngle}deg, ${gradientA}, ${gradientB})`;

  const onImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current ?? document.createElement('canvas');
      canvasRef.current = canvas;
      const max = 180;
      const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
      for (let i = 0; i < data.length; i += 16) {
        const alpha = data[i + 3];
        if (alpha < 180) continue;
        const r = Math.round(data[i] / 32) * 32;
        const g = Math.round(data[i + 1] / 32) * 32;
        const b = Math.round(data[i + 2] / 32) * 32;
        const key = `${r}-${g}-${b}`;
        const existing = buckets.get(key);
        if (existing) existing.count += 1;
        else buckets.set(key, { r, g, b, count: 1 });
      }
      const result = [...buckets.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
        .map((item) => ({ ...item, hex: rgbToHex(item) }));
      setPalette(result);
      setStatus(`Extracted ${result.length} dominant colors locally.`);
    };
    image.src = url;
    event.target.value = '';
  };

  const exportPalette = () => {
    const colors = palette.length ? palette.map((p) => p.hex) : harmony;
    const css = `:root {\n${colors.map((hex, i) => `  --color-${i + 1}: ${hex};`).join('\n')}\n}`;
    downloadText(css, 'color-palette.css');
  };

  return (
    <main className="scdt-page">
      <ToolAppHeader
        appNumber="016"
        title="Smart Color & Design Tools"
        description="Pick colors, extract palettes, generate harmonies and gradients, and check accessibility — all locally in your browser."
      />

      <div className="scdt-badge-wrap"><LocalProcessingBadge /></div>

      <section className="scdt-grid scdt-grid-2">
        <article className="scdt-card">
          <h2>Color converter</h2>
          <div className="scdt-color-row">
            <input className="scdt-color-input" type="color" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} />
            <input className="scdt-input" value={color} onChange={(e) => setColor(e.target.value)} aria-label="HEX color" />
          </div>
          <div className="scdt-values">
            <button onClick={() => copyText(color)}>HEX <strong>{color}</strong></button>
            <button onClick={() => copyText(`rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`)}>RGB <strong>{Math.round(rgb.r)}, {Math.round(rgb.g)}, {Math.round(rgb.b)}</strong></button>
            <button onClick={() => copyText(`hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`)}>HSL <strong>{Math.round(hsl.h)}°, {Math.round(hsl.s)}%, {Math.round(hsl.l)}%</strong></button>
          </div>
        </article>

        <article className="scdt-card">
          <h2>Shades & tints</h2>
          <div className="scdt-swatch-grid">
            {shades.map((hex) => (
              <button key={hex} className="scdt-swatch" style={{ background: hex }} onClick={() => copyText(hex)} title={`Copy ${hex}`}>
                <span>{hex}</span>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="scdt-grid scdt-grid-2">
        <article className="scdt-card">
          <h2>Image palette extractor</h2>
          <label className="scdt-dropzone">
            <input type="file" accept="image/*" onChange={onImage} />
            <strong>Choose an image</strong>
            <span>Dominant colors are calculated locally.</span>
          </label>
          {imageUrl && <img className="scdt-preview" src={imageUrl} alt="Palette source preview" />}
          {palette.length > 0 && (
            <div className="scdt-palette">
              {palette.map((item) => (
                <button key={item.hex} style={{ background: item.hex }} onClick={() => copyText(item.hex)} title={`Copy ${item.hex}`}>
                  <span>{item.hex}</span>
                </button>
              ))}
            </div>
          )}
          <button className="scdt-button" onClick={exportPalette}>Download palette CSS</button>
          <canvas ref={canvasRef} hidden />
        </article>

        <article className="scdt-card">
          <h2>Color harmony</h2>
          <select className="scdt-input" value={harmonyMode} onChange={(e) => setHarmonyMode(e.target.value as HarmonyMode)}>
            <option value="complementary">Complementary</option>
            <option value="analogous">Analogous</option>
            <option value="triadic">Triadic</option>
          </select>
          <div className="scdt-harmony">
            {harmony.map((hex) => (
              <button key={hex} style={{ background: hex }} onClick={() => copyText(hex)}><span>{hex}</span></button>
            ))}
          </div>
        </article>
      </section>

      <section className="scdt-grid scdt-grid-2">
        <article className="scdt-card">
          <h2>Contrast & WCAG checker</h2>
          <div className="scdt-field-row">
            <label>Text<input type="color" value={foreground} onChange={(e) => setForeground(e.target.value.toUpperCase())} /></label>
            <label>Background<input type="color" value={background} onChange={(e) => setBackground(e.target.value.toUpperCase())} /></label>
          </div>
          <div className="scdt-contrast-preview" style={{ color: foreground, background }}>
            The quick brown fox jumps over the lazy dog.
          </div>
          <div className="scdt-ratio">Contrast ratio: <strong>{ratio.toFixed(2)}:1</strong></div>
          <div className="scdt-checks">
            <span className={ratio >= 4.5 ? 'pass' : 'fail'}>AA Normal: {ratio >= 4.5 ? 'Pass' : 'Fail'}</span>
            <span className={ratio >= 3 ? 'pass' : 'fail'}>AA Large: {ratio >= 3 ? 'Pass' : 'Fail'}</span>
            <span className={ratio >= 7 ? 'pass' : 'fail'}>AAA Normal: {ratio >= 7 ? 'Pass' : 'Fail'}</span>
          </div>
        </article>

        <article className="scdt-card">
          <h2>CSS gradient generator</h2>
          <div className="scdt-field-row">
            <input type="color" value={gradientA} onChange={(e) => setGradientA(e.target.value.toUpperCase())} />
            <input type="color" value={gradientB} onChange={(e) => setGradientB(e.target.value.toUpperCase())} />
          </div>
          <label className="scdt-range">Angle: {gradientAngle}°<input type="range" min="0" max="360" value={gradientAngle} onChange={(e) => setGradientAngle(Number(e.target.value))} /></label>
          <div className="scdt-gradient-preview" style={{ background: gradientCss }} />
          <div className="scdt-code">background: {gradientCss};</div>
          <button className="scdt-button" onClick={() => copyText(`background: ${gradientCss};`)}>Copy CSS</button>
        </article>
      </section>

      <div className="scdt-status">{status}</div>
    </main>
  );
}
