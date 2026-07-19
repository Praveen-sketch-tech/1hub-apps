export type ScreenshotToolAction = {
  id: string;
  title: string;
  description: string;
  keywords: string[];
};

export const screenshotToolActions: ScreenshotToolAction[] = [
  {
    id: 'stitch-screenshots',
    title: 'Stitch screenshots',
    description: 'Combine multiple screenshots vertically into one long image.',
    keywords: ['stitch screenshots', 'long screenshot', 'combine screenshots', 'merge screenshots'],
  },
  {
    id: 'annotate-screenshot',
    title: 'Annotate screenshot',
    description: 'Add arrows, rectangles, highlights and text to a screenshot.',
    keywords: ['annotate screenshot', 'add arrow', 'highlight screenshot', 'mark screenshot'],
  },
  {
    id: 'blur-screenshot-area',
    title: 'Blur sensitive area',
    description: 'Blur private or sensitive areas of a screenshot locally in the browser.',
    keywords: ['blur screenshot', 'hide sensitive info', 'redact screenshot'],
  },
];
