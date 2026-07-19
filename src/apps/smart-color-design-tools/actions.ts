export type ColorDesignToolAction = {
  id: string;
  title: string;
  description: string;
  keywords: string[];
};

export const colorDesignToolActions: ColorDesignToolAction[] = [
  {
    id: 'extract-image-palette',
    title: 'Extract image color palette',
    description: 'Extract dominant colors from an uploaded image locally in the browser.',
    keywords: ['extract colors', 'image palette', 'dominant colors', 'color palette'],
  },
  {
    id: 'check-color-contrast',
    title: 'Check color contrast',
    description: 'Calculate contrast ratio and WCAG AA/AAA pass status for two colors.',
    keywords: ['contrast checker', 'wcag', 'accessibility colors', 'text contrast'],
  },
  {
    id: 'generate-css-gradient',
    title: 'Generate CSS gradient',
    description: 'Create and copy a two-color linear CSS gradient.',
    keywords: ['gradient generator', 'css gradient', 'linear gradient'],
  },
  {
    id: 'generate-color-harmony',
    title: 'Generate color harmony',
    description: 'Generate complementary, analogous or triadic colors from a base color.',
    keywords: ['complementary color', 'analogous colors', 'triadic colors', 'color harmony'],
  },
];
