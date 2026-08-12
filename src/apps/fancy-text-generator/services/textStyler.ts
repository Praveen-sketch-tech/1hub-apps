import type { TextStyle } from '../types';

interface OffsetStyleConfig {
  upperBase?: number;
  lowerBase?: number;
  digitBase?: number;
  upperExceptions?: Record<string, number>;
  lowerExceptions?: Record<string, number>;
  reuseUpperForLower?: boolean; // for blocks with no lowercase glyphs (e.g. circled-filled)
}

function buildOffsetTransform(cfg: OffsetStyleConfig): (input: string) => string {
  return (input: string) => {
    let out = '';
    for (const ch of input) {
      const code = ch.codePointAt(0)!;
      if (code >= 65 && code <= 90) {
        // A-Z
        const letter = ch;
        if (cfg.upperExceptions && cfg.upperExceptions[letter] !== undefined) {
          out += String.fromCodePoint(cfg.upperExceptions[letter]);
        } else if (cfg.upperBase !== undefined) {
          out += String.fromCodePoint(cfg.upperBase + (code - 65));
        } else {
          out += ch;
        }
      } else if (code >= 97 && code <= 122) {
        // a-z
        const letter = ch;
        const upperEquivalent = ch.toUpperCase();
        if (cfg.lowerExceptions && cfg.lowerExceptions[letter] !== undefined) {
          out += String.fromCodePoint(cfg.lowerExceptions[letter]);
        } else if (cfg.reuseUpperForLower && cfg.upperBase !== undefined) {
          if (cfg.upperExceptions && cfg.upperExceptions[upperEquivalent] !== undefined) {
            out += String.fromCodePoint(cfg.upperExceptions[upperEquivalent]);
          } else {
            out += String.fromCodePoint(cfg.upperBase + (code - 97));
          }
        } else if (cfg.lowerBase !== undefined) {
          out += String.fromCodePoint(cfg.lowerBase + (code - 97));
        } else {
          out += ch;
        }
      } else if (code >= 48 && code <= 57 && cfg.digitBase !== undefined) {
        // 0-9
        out += String.fromCodePoint(cfg.digitBase + (code - 48));
      } else {
        out += ch;
      }
    }
    return out;
  };
}

function circledDigit(d: number): string {
  if (d === 0) return '\u24EA';
  return String.fromCodePoint(0x2460 + (d - 1));
}

function circledFilledDigit(d: number): string {
  if (d === 0) return '\u24FF';
  return String.fromCodePoint(0x2776 + (d - 1));
}

function buildCircledTransform(): (input: string) => string {
  return (input: string) => {
    let out = '';
    for (const ch of input) {
      const code = ch.codePointAt(0)!;
      if (code >= 65 && code <= 90) out += String.fromCodePoint(0x24b6 + (code - 65));
      else if (code >= 97 && code <= 122) out += String.fromCodePoint(0x24d0 + (code - 97));
      else if (code >= 48 && code <= 57) out += circledDigit(code - 48);
      else out += ch;
    }
    return out;
  };
}

function buildCircledFilledTransform(): (input: string) => string {
  return (input: string) => {
    let out = '';
    for (const ch of input) {
      const code = ch.codePointAt(0)!;
      if (code >= 65 && code <= 90) out += String.fromCodePoint(0x1f150 + (code - 65));
      else if (code >= 97 && code <= 122) out += String.fromCodePoint(0x1f150 + (code - 97));
      else if (code >= 48 && code <= 57) out += circledFilledDigit(code - 48);
      else out += ch;
    }
    return out;
  };
}

function buildSquaredTransform(): (input: string) => string {
  return (input: string) => {
    let out = '';
    for (const ch of input) {
      const code = ch.codePointAt(0)!;
      if (code >= 65 && code <= 90) out += String.fromCodePoint(0x1f170 + (code - 65));
      else if (code >= 97 && code <= 122) out += String.fromCodePoint(0x1f170 + (code - 97));
      else out += ch;
    }
    return out;
  };
}

const SMALL_CAPS_MAP: Record<string, string> = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ',
  k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 'ꜱ', t: 'ᴛ',
  u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ'
};

function smallCaps(input: string): string {
  let out = '';
  for (const ch of input) {
    const lower = ch.toLowerCase();
    out += SMALL_CAPS_MAP[lower] || ch;
  }
  return out;
}

const UPSIDE_DOWN_MAP: Record<string, string> = {
  a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ı', j: 'ɾ',
  k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ',
  u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z',
  '0': '0', '1': 'Ɩ', '2': 'ᄅ', '3': 'Ɛ', '4': 'ㄣ', '5': '5', '6': '9', '7': 'ㄥ', '8': '8', '9': '6',
  '.': '˙', ',': "'", '?': '¿', '!': '¡', "'": ',', '"': ',,', '(': ')', ')': '('
};

function upsideDown(input: string): string {
  let out = '';
  for (const ch of input) {
    const lower = ch.toLowerCase();
    out += UPSIDE_DOWN_MAP[lower] || UPSIDE_DOWN_MAP[ch] || ch;
  }
  return out.split('').reverse().join('');
}

function strikethrough(input: string): string {
  let out = '';
  for (const ch of input) out += ch + '\u0336';
  return out;
}

function underline(input: string): string {
  let out = '';
  for (const ch of input) out += ch + '\u0332';
  return out;
}

const ZALGO_MARKS = [
  '\u0300', '\u0301', '\u0302', '\u0303', '\u0304', '\u0306', '\u0307', '\u0308',
  '\u030a', '\u030c', '\u0315', '\u031b', '\u0321', '\u0322', '\u0327', '\u0328',
  '\u0330', '\u0331', '\u0332', '\u0333'
];

function zalgo(input: string): string {
  let out = '';
  for (const ch of input) {
    out += ch;
    if (ch === ' ') continue;
    const markCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < markCount; i++) {
      out += ZALGO_MARKS[Math.floor(Math.random() * ZALGO_MARKS.length)];
    }
  }
  return out;
}

export const TEXT_STYLES: TextStyle[] = [
  { id: 'bold', label: 'Bold', category: 'Bold & Italic', apply: buildOffsetTransform({ upperBase: 0x1d400, lowerBase: 0x1d41a, digitBase: 0x1d7ce }) },
  {
    id: 'italic',
    label: 'Italic',
    category: 'Bold & Italic',
    apply: buildOffsetTransform({ upperBase: 0x1d434, lowerBase: 0x1d44e, lowerExceptions: { h: 0x210e } })
  },
  { id: 'bold-italic', label: 'Bold Italic', category: 'Bold & Italic', apply: buildOffsetTransform({ upperBase: 0x1d468, lowerBase: 0x1d482 }) },
  {
    id: 'script',
    label: 'Script / Cursive',
    category: 'Script & Fraktur',
    apply: buildOffsetTransform({
      upperBase: 0x1d49c,
      lowerBase: 0x1d4b6,
      upperExceptions: { B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211b },
      lowerExceptions: { e: 0x212f, g: 0x210a, o: 0x2134 }
    })
  },
  { id: 'bold-script', label: 'Bold Script', category: 'Script & Fraktur', apply: buildOffsetTransform({ upperBase: 0x1d4d0, lowerBase: 0x1d4ea }) },
  {
    id: 'fraktur',
    label: 'Gothic / Fraktur',
    category: 'Script & Fraktur',
    apply: buildOffsetTransform({
      upperBase: 0x1d504,
      lowerBase: 0x1d51e,
      upperExceptions: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 }
    })
  },
  { id: 'bold-fraktur', label: 'Bold Gothic', category: 'Script & Fraktur', apply: buildOffsetTransform({ upperBase: 0x1d56c, lowerBase: 0x1d586 }) },
  {
    id: 'double-struck',
    label: 'Double-Struck',
    category: 'Script & Fraktur',
    apply: buildOffsetTransform({
      upperBase: 0x1d538,
      lowerBase: 0x1d552,
      digitBase: 0x1d7d8,
      upperExceptions: { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 }
    })
  },
  { id: 'sans', label: 'Sans-Serif', category: 'Sans & Mono', apply: buildOffsetTransform({ upperBase: 0x1d5a0, lowerBase: 0x1d5ba, digitBase: 0x1d7e2 }) },
  { id: 'sans-bold', label: 'Sans-Serif Bold', category: 'Sans & Mono', apply: buildOffsetTransform({ upperBase: 0x1d5d4, lowerBase: 0x1d5ee, digitBase: 0x1d7ec }) },
  { id: 'sans-italic', label: 'Sans-Serif Italic', category: 'Sans & Mono', apply: buildOffsetTransform({ upperBase: 0x1d608, lowerBase: 0x1d622 }) },
  { id: 'sans-bold-italic', label: 'Sans-Serif Bold Italic', category: 'Sans & Mono', apply: buildOffsetTransform({ upperBase: 0x1d63c, lowerBase: 0x1d656 }) },
  { id: 'monospace', label: 'Monospace', category: 'Sans & Mono', apply: buildOffsetTransform({ upperBase: 0x1d670, lowerBase: 0x1d68a, digitBase: 0x1d7f6 }) },
  { id: 'circled', label: 'Bubble (Circled)', category: 'Bubble & Box', apply: buildCircledTransform() },
  { id: 'circled-filled', label: 'Bubble Filled', category: 'Bubble & Box', apply: buildCircledFilledTransform() },
  { id: 'squared', label: 'Squared', category: 'Bubble & Box', apply: buildSquaredTransform() },
  { id: 'fullwidth', label: 'Vaporwave (Fullwidth)', category: 'Bubble & Box', apply: buildOffsetTransform({ upperBase: 0xff21, lowerBase: 0xff41, digitBase: 0xff10 }) },
  { id: 'small-caps', label: 'Small Caps', category: 'Fun & Meme', apply: smallCaps },
  { id: 'upside-down', label: 'Upside Down', category: 'Fun & Meme', apply: upsideDown },
  { id: 'strikethrough', label: 'Strikethrough', category: 'Fun & Meme', apply: strikethrough },
  { id: 'underline', label: 'Underline', category: 'Fun & Meme', apply: underline },
  { id: 'zalgo', label: 'Glitch / Zalgo', category: 'Fun & Meme', apply: zalgo }
];
