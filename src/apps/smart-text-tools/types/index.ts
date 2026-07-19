export type TextTool =
  | 'clean' | 'case' | 'duplicates' | 'sort' | 'find-replace'
  | 'prefix-suffix' | 'extract' | 'compare' | 'json' | 'encode'

export type CaseMode =
  | 'uppercase' | 'lowercase' | 'title' | 'sentence' | 'camel' | 'kebab' | 'snake'

export type ExtractMode = 'emails' | 'urls' | 'numbers'
export type EncodeMode = 'base64-encode' | 'base64-decode' | 'url-encode' | 'url-decode'

export interface TextStats {
  characters: number
  charactersNoSpaces: number
  words: number
  lines: number
  sentences: number
  bytes: number
}

export interface CompareLine {
  kind: 'same' | 'added' | 'removed' | 'changed'
  left: string
  right: string
  lineNumber: number
}
