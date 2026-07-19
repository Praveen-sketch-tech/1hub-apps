import { ChangeEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ToolAppHeader } from '../../shared/components/tools/ToolAppHeader';
import { LocalProcessingBadge } from '../../shared/components/tools/LocalProcessingBadge';
import './smart-screenshot-tools.css';

type Item = {
  id: string;
  file: File;
  url: string;
};

type ToolMode = 'stitch' | 'blur' | 'rectangle' | 'highlight' | 'arrow' | 'text';

type Point = { x: number; y: number };

type DrawAction =
  | { type: 'blur'; start: Point; end: Point }
  | { type: 'rectangle'; start: Point; end: Point }
  | { type: 'highlight'; start: Point; end: Point }
  | { type: 'arrow'; start: Point; end: Point }
  | { type: 'text'; at: Point; value: string };

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export default function SmartScreenshotToolsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<ToolMode>('stitch');
  const [actions, setActions] = useState<DrawAction[]>([]);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [format, setFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/png');
  const [quality, setQuality] = useState(0.92);
  const [padding, setPadding] = useState(0);
  const [gap, setGap] = useState(0);
  const [background, setBackground] = useState('#ffffff');
  const [status, setStatus] = useState('Upload screenshots to begin.');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  useEffect(() => {
    if (!selectedId && items[0]) setSelectedId(items[0].id);
  }, [items, selectedId]);

  useEffect(() => {
    return () => items.forEach((item) => URL.revokeObjectURL(item.url));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'));
    if (!files.length) return;
    const next = files.map((file) => ({
      id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      url: URL.createObjectURL(file),
    }));
    setItems((current) => [...current, ...next]);
    setSelectedId((current) => current ?? next[0].id);
    setStatus(`${next.length} screenshot${next.length > 1 ? 's' : ''} added.`);
    event.target.value = '';
  };

  const move = (index: number, direction: -1 | 1) => {
    setItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };

  const remove = (id: string) => {
    setItems((current) => {
      const found = current.find((item) => item.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return current.filter((item) => item.id !== id);
    });
    if (selectedId === id) setSelectedId(null);
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, start: Point, end: Point) => {
    const head = 14;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  };

  const applyActions = async (canvas: HTMLCanvasElement, image: HTMLImageElement) => {
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    for (const action of actions) {
      if (action.type === 'text') {
        ctx.save();
        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = '#ff2d55';
        ctx.fillText(action.value, action.at.x, action.at.y);
        ctx.restore();
        continue;
      }

      const x = Math.min(action.start.x, action.end.x);
      const y = Math.min(action.start.y, action.end.y);
      const w = Math.abs(action.end.x - action.start.x);
      const h = Math.abs(action.end.y - action.start.y);

      ctx.save();
      if (action.type === 'blur') {
        const off = document.createElement('canvas');
        off.width = Math.max(1, w);
        off.height = Math.max(1, h);
        const offCtx = off.getContext('2d');
        if (offCtx && w > 0 && h > 0) {
          offCtx.filter = 'blur(18px)';
          offCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
          ctx.drawImage(off, 0, 0, w, h, x, y, w, h);
        }
      } else if (action.type === 'highlight') {
        ctx.fillStyle = 'rgba(255, 230, 0, 0.38)';
        ctx.fillRect(x, y, w, h);
      } else {
        ctx.strokeStyle = '#ff2d55';
        ctx.lineWidth = Math.max(3, canvas.width / 300);
        if (action.type === 'rectangle') ctx.strokeRect(x, y, w, h);
        if (action.type === 'arrow') drawArrow(ctx, action.start, action.end);
      }
      ctx.restore();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selected || mode === 'stitch') return;
    loadImage(selected.url).then((image) => applyActions(canvas, image)).catch(() => setStatus('Could not load image.'));
  }, [selected, actions, mode]);

  const toCanvasPoint = (event: MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const onCanvasDown = (event: MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'stitch') return;
    const point = toCanvasPoint(event);
    if (mode === 'text') {
      const value = window.prompt('Enter annotation text:')?.trim();
      if (value) setActions((current) => [...current, { type: 'text', at: point, value }]);
      return;
    }
    setDragStart(point);
  };

  const onCanvasUp = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!dragStart || mode === 'stitch' || mode === 'text') return;
    const end = toCanvasPoint(event);
    setActions((current) => [...current, { type: mode, start: dragStart, end } as DrawAction]);
    setDragStart(null);
  };

  const createStitchedCanvas = async () => {
    if (!items.length) throw new Error('No screenshots uploaded.');
    const images = await Promise.all(items.map((item) => loadImage(item.url)));
    const contentWidth = Math.max(...images.map((img) => img.naturalWidth));
    const totalHeight = images.reduce((sum, img) => sum + img.naturalHeight, 0) + gap * Math.max(0, images.length - 1);
    const canvas = document.createElement('canvas');
    canvas.width = contentWidth + padding * 2;
    canvas.height = totalHeight + padding * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not supported.');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let y = padding;
    for (const image of images) {
      const x = padding + (contentWidth - image.naturalWidth) / 2;
      ctx.drawImage(image, x, y);
      y += image.naturalHeight + gap;
    }
    return canvas;
  };

  const exportImage = async () => {
    try {
      setStatus('Preparing export...');
      let canvas: HTMLCanvasElement;
      if (mode === 'stitch') {
        canvas = await createStitchedCanvas();
      } else {
        const current = canvasRef.current;
        if (!current) throw new Error('Nothing to export.');
        canvas = current;
      }
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, format, quality));
      if (!blob) throw new Error('Export failed.');
      const ext = format === 'image/png' ? 'png' : format === 'image/webp' ? 'webp' : 'jpg';
      downloadBlob(blob, `smart-screenshot-${Date.now()}.${ext}`);
      setStatus('Export complete.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Export failed.');
    }
  };

  const copyToClipboard = async () => {
    try {
      const canvas = mode === 'stitch' ? await createStitchedCanvas() : canvasRef.current;
      if (!canvas) throw new Error('Nothing to copy.');
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob || !navigator.clipboard || typeof ClipboardItem === 'undefined') {
        throw new Error('Clipboard image copy is not supported in this browser.');
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setStatus('Image copied to clipboard.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not copy image.');
    }
  };

  const reset = () => {
    items.forEach((item) => URL.revokeObjectURL(item.url));
    setItems([]);
    setSelectedId(null);
    setActions([]);
    setStatus('Reset complete.');
  };

  return (
    <main className="sst-page">
      <ToolAppHeader
        appNumber="015"
        title="Smart Screenshot Tools"
        description="Stitch, blur, annotate and export screenshots locally in your browser."
      />

      <div className="sst-badge-wrap"><LocalProcessingBadge /></div>

      <section className="sst-card sst-upload-card">
        <label className="sst-dropzone">
          <input type="file" accept="image/*" multiple onChange={onFiles} />
          <strong>Choose screenshots</strong>
          <span>PNG, JPG and WebP • multiple files supported</span>
        </label>
      </section>

      <section className="sst-layout">
        <aside className="sst-card sst-sidebar">
          <div className="sst-section-title">Screenshots ({items.length})</div>
          <div className="sst-list">
            {items.map((item, index) => (
              <div className={`sst-item ${selected?.id === item.id ? 'is-selected' : ''}`} key={item.id}>
                <button className="sst-thumb-button" onClick={() => { setSelectedId(item.id); setActions([]); }}>
                  <img src={item.url} alt={item.file.name} />
                  <span>{item.file.name}</span>
                </button>
                <div className="sst-item-actions">
                  <button onClick={() => move(index, -1)} disabled={index === 0}>↑</button>
                  <button onClick={() => move(index, 1)} disabled={index === items.length - 1}>↓</button>
                  <button onClick={() => remove(item.id)}>×</button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="sst-main-column">
          <section className="sst-card">
            <div className="sst-toolbar">
              {(['stitch', 'blur', 'rectangle', 'highlight', 'arrow', 'text'] as ToolMode[]).map((tool) => (
                <button key={tool} className={mode === tool ? 'is-active' : ''} onClick={() => setMode(tool)}>
                  {tool[0].toUpperCase() + tool.slice(1)}
                </button>
              ))}
            </div>

            {mode === 'stitch' ? (
              <div className="sst-preview-placeholder">
                <strong>Long Screenshot Stitcher</strong>
                <span>Files are stitched vertically in the order shown on the left.</span>
                <span>Use ↑ ↓ to reorder before exporting.</span>
              </div>
            ) : selected ? (
              <div className="sst-canvas-wrap">
                <canvas ref={canvasRef} onMouseDown={onCanvasDown} onMouseUp={onCanvasUp} />
              </div>
            ) : (
              <div className="sst-preview-placeholder">Upload and select a screenshot.</div>
            )}
          </section>

          <section className="sst-card sst-controls">
            <div className="sst-field">
              <label>Output format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPG</option>
                <option value="image/webp">WebP</option>
              </select>
            </div>
            <div className="sst-field">
              <label>Quality {Math.round(quality * 100)}%</label>
              <input type="range" min="0.5" max="1" step="0.01" value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
            </div>
            <div className="sst-field">
              <label>Padding</label>
              <input type="number" min="0" max="300" value={padding} onChange={(e) => setPadding(Number(e.target.value) || 0)} />
            </div>
            <div className="sst-field">
              <label>Gap</label>
              <input type="number" min="0" max="200" value={gap} onChange={(e) => setGap(Number(e.target.value) || 0)} />
            </div>
            <div className="sst-field">
              <label>Background</label>
              <input type="color" value={background} onChange={(e) => setBackground(e.target.value)} />
            </div>
          </section>

          <section className="sst-card sst-footer-actions">
            <div className="sst-status">{status}</div>
            <div className="sst-buttons">
              {mode !== 'stitch' && <button onClick={() => setActions((current) => current.slice(0, -1))} disabled={!actions.length}>Undo</button>}
              <button onClick={copyToClipboard} disabled={!items.length}>Copy</button>
              <button className="sst-primary" onClick={exportImage} disabled={!items.length}>Download</button>
              <button onClick={reset} disabled={!items.length}>Reset</button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
