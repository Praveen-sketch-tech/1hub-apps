export { chatModule } from './chatActions';
import React, { useMemo, useState } from 'react';
import { Sparkles, Copy, Check, Image as ImageIcon, Star, Search } from 'lucide-react';
import { TEXT_STYLES } from './services/textStyler';
import { CARD_THEMES, renderTextCard } from './services/imageCard';
import { downloadBlob } from '@shared/utils/downloads';
import type { StyleCategory } from './types';

const CATEGORY_ORDER: StyleCategory[] = ['Bold & Italic', 'Script & Fraktur', 'Sans & Mono', 'Bubble & Box', 'Fun & Meme'];

const PLATFORM_LIMITS: { label: string; limit: number }[] = [
  { label: 'Instagram bio', limit: 150 },
  { label: 'WhatsApp status', limit: 139 },
  { label: 'Twitter/X post', limit: 280 }
];

const FAVORITES_KEY = 'fancy_text_favorites';

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function FancyTextGenerator() {
  const [input, setInput] = useState('Hello World');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [imageThemeId, setImageThemeId] = useState(CARD_THEMES[0].id);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites());

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  };

  const filteredStyles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return TEXT_STYLES;
    return TEXT_STYLES.filter((s) => s.label.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
  }, [search]);

  const favoriteStyles = useMemo(() => TEXT_STYLES.filter((s) => favorites.includes(s.id)), [favorites]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard permission denied or unavailable — silently ignore, the
      // person can still select-and-copy the visible preview text.
    }
  };

  const handleCopyAsImage = async (id: string, text: string) => {
    if (!text.trim() || generatingImageId) return;
    setGeneratingImageId(id);
    try {
      const theme = CARD_THEMES.find((t) => t.id === imageThemeId) || CARD_THEMES[0];
      const blob = await renderTextCard(text, theme);
      downloadBlob(blob, 'fancy-text.png');
    } catch {
      // Rendering failed (e.g. canvas unsupported) — nothing to download.
    } finally {
      setGeneratingImageId(null);
    }
  };

  const charCount = input.length;

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-white p-4 font-sans space-y-4 overflow-y-auto">
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
        <div className="p-2 rounded-xl bg-pink-600/20 text-pink-400 border border-pink-500/30">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-base">Fancy Text Generator</h1>
          <p className="text-xs text-slate-400">Stylish fonts for Instagram bio, WhatsApp status &amp; more</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your text here..."
          rows={2}
          className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-white text-lg outline-none focus:border-pink-500 resize-none"
        />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span>{charCount} characters</span>
          {PLATFORM_LIMITS.map((p) => (
            <span key={p.label} className={charCount > p.limit ? 'text-amber-400' : ''}>
              {p.label}: {p.limit - charCount >= 0 ? `${p.limit - charCount} left` : `${charCount - p.limit} over`}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search styles (e.g. bold, bubble, glitch)..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-600"
          />
        </div>
        <select
          value={imageThemeId}
          onChange={(e) => setImageThemeId(e.target.value)}
          className="px-2 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 outline-none"
          title="Image card theme"
        >
          {CARD_THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {favoriteStyles.length > 0 && !search && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 fill-amber-400" /> Favorites
          </h2>
          <div className="space-y-2">
            {favoriteStyles.map((style) => (
              <StyleRow
                key={style.id}
                label={style.label}
                text={style.apply(input)}
                isFavorite
                onToggleFavorite={() => toggleFavorite(style.id)}
                onCopy={() => handleCopy(style.id, style.apply(input))}
                onCopyImage={() => handleCopyAsImage(style.id, style.apply(input))}
                copied={copiedId === style.id}
                generatingImage={generatingImageId === style.id}
              />
            ))}
          </div>
        </div>
      )}

      {CATEGORY_ORDER.map((category) => {
        const stylesInCategory = filteredStyles.filter((s) => s.category === category);
        if (stylesInCategory.length === 0) return null;
        return (
          <div key={category} className="space-y-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{category}</h2>
            <div className="space-y-2">
              {stylesInCategory.map((style) => (
                <StyleRow
                  key={style.id}
                  label={style.label}
                  text={style.apply(input)}
                  isFavorite={favorites.includes(style.id)}
                  onToggleFavorite={() => toggleFavorite(style.id)}
                  onCopy={() => handleCopy(style.id, style.apply(input))}
                  onCopyImage={() => handleCopyAsImage(style.id, style.apply(input))}
                  copied={copiedId === style.id}
                  generatingImage={generatingImageId === style.id}
                />
              ))}
            </div>
          </div>
        );
      })}

      {filteredStyles.length === 0 && <p className="text-sm text-slate-500 text-center py-8">No styles match "{search}".</p>}
    </div>
  );
}

function StyleRow({
  label,
  text,
  isFavorite,
  onToggleFavorite,
  onCopy,
  onCopyImage,
  copied,
  generatingImage
}: {
  label: string;
  text: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onCopy: () => void;
  onCopyImage: () => void;
  copied: boolean;
  generatingImage: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 flex items-center gap-2">
      <button
        type="button"
        onClick={onToggleFavorite}
        className="shrink-0 text-slate-600 hover:text-amber-400 transition"
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-500">{label}</p>
        <p className="text-base truncate" style={{ wordBreak: 'break-word' }}>
          {text}
        </p>
      </div>
      <button
        type="button"
        onClick={onCopyImage}
        disabled={generatingImage}
        className="shrink-0 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition disabled:opacity-40"
        title="Copy as shareable image"
      >
        <ImageIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 p-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white transition"
        title="Copy text"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

export const FancyTextGeneratorPage = FancyTextGenerator;
