export interface CardTheme {
  id: string;
  label: string;
  background: string; // CSS gradient or color
  textColor: string;
}

export const CARD_THEMES: CardTheme[] = [
  { id: 'sunset', label: 'Sunset', background: 'linear-gradient(135deg, #ff6b6b, #f06595, #cc5de8)', textColor: '#ffffff' },
  { id: 'ocean', label: 'Ocean', background: 'linear-gradient(135deg, #0093E9, #80D0C7)', textColor: '#ffffff' },
  { id: 'midnight', label: 'Midnight', background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', textColor: '#f5f5f5' },
  { id: 'mint', label: 'Mint', background: 'linear-gradient(135deg, #43e97b, #38f9d7)', textColor: '#0f2419' },
  { id: 'gold', label: 'Gold', background: 'linear-gradient(135deg, #f7971e, #ffd200)', textColor: '#2b1a00' },
  { id: 'plain', label: 'Plain White', background: '#ffffff', textColor: '#111111' }
];

function parseGradient(bg: string): { stops: string[]; angleDeg: number } | null {
  const match = bg.match(/linear-gradient\((\d+)deg,\s*(.+)\)/);
  if (!match) return null;
  return { angleDeg: parseInt(match[1], 10), stops: match[2].split(',').map((s) => s.trim()) };
}

export async function renderTextCard(text: string, theme: CardTheme): Promise<Blob> {
  const width = 1080;
  const height = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');

  const gradient = parseGradient(theme.background);
  if (gradient) {
    const rad = (gradient.angleDeg * Math.PI) / 180;
    const x1 = width / 2 - (Math.sin(rad) * width) / 2;
    const y1 = height / 2 + (Math.cos(rad) * height) / 2;
    const x2 = width / 2 + (Math.sin(rad) * width) / 2;
    const y2 = height / 2 - (Math.cos(rad) * height) / 2;
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    gradient.stops.forEach((stop, i) => {
      grad.addColorStop(i / Math.max(1, gradient.stops.length - 1), stop);
    });
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = theme.background;
  }
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = theme.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const maxWidth = width - 160;
  let fontSize = 96;
  const fontFamily = "'Noto Sans', 'Segoe UI Symbol', system-ui, sans-serif";

  const wrapText = (size: number): string[] => {
    ctx.font = `${size}px ${fontFamily}`;
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    });
    if (current) lines.push(current);
    return lines;
  };

  let lines = wrapText(fontSize);
  while ((lines.length * fontSize * 1.3 > height - 200 || lines.some((l) => ctx.measureText(l).width > maxWidth)) && fontSize > 28) {
    fontSize -= 4;
    lines = wrapText(fontSize);
  }

  ctx.font = `${fontSize}px ${fontFamily}`;
  const lineHeight = fontSize * 1.3;
  const totalHeight = lines.length * lineHeight;
  const startY = height / 2 - totalHeight / 2 + lineHeight / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, startY + i * lineHeight);
  });

  ctx.font = '28px system-ui, sans-serif';
  ctx.globalAlpha = 0.6;
  ctx.fillText('made with Hub Apps', width / 2, height - 60);
  ctx.globalAlpha = 1;

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to render image card.'));
    }, 'image/png');
  });
}
