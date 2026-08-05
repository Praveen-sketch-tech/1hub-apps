export type PreviewMode = 'desktop' | 'tablet' | 'mobile';
export type LayoutMode = 'split-v' | 'split-h' | 'editor-only' | 'preview-only';
export type Theme = 'light' | 'dark';
export interface RecentFile {
name: string;
content: string;
date: string;
}
export interface ValidationIssue {
type: 'error' | 'warning' | 'success';
message: string;
}
export interface DOMStats {
lines: number;
chars: number;
words: number;
tags: number;
images: number;
links: number;
scripts: number;
styles: number;
}