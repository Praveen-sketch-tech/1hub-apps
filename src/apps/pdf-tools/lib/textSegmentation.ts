export type Script = 'devanagari' | 'latin'

export interface ScriptRun {
  text: string
  script: Script
}

const DEVANAGARI_RANGE = /[\u0900-\u097F]/

function scriptOf(char: string): Script {
  return DEVANAGARI_RANGE.test(char) ? 'devanagari' : 'latin'
}

/**
 * Splits a string into consecutive runs of the same script (Devanagari vs
 * everything else), so a mixed Hindi+English sentence can be drawn with the
 * correct font per run instead of one font for the whole line.
 *
 * ASCII punctuation (comma, period, etc.) always classifies as 'latin' —
 * the embedded Devanagari font is a Devanagari-only glyph subset and has no
 * comma/period glyphs, so attaching punctuation to a Devanagari run would
 * render as a missing-glyph box. Devanagari's own punctuation (।, ॥) is
 * inside the Unicode block itself, so it's unaffected by this rule.
 */
export function splitByScript(text: string): ScriptRun[] {
  if (!text) return []
  const runs: ScriptRun[] = []
  let currentScript: Script = scriptOf(text[0])
  let currentText = text[0]

  for (let i = 1; i < text.length; i++) {
    const char = text[i]
    const charScript = scriptOf(char)

    if (charScript === currentScript) {
      currentText += char
    } else {
      runs.push({ text: currentText, script: currentScript })
      currentScript = charScript
      currentText = char
    }
  }
  runs.push({ text: currentText, script: currentScript })
  return runs
}
