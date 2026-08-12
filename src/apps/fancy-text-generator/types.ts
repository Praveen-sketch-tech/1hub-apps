export type StyleCategory = 'Bold & Italic' | 'Script & Fraktur' | 'Sans & Mono' | 'Bubble & Box' | 'Fun & Meme';

export interface TextStyle {
  id: string;
  label: string;
  category: StyleCategory;
  apply: (input: string) => string;
}
