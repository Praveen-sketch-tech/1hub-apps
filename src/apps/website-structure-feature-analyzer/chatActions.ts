import type { AppChatModule } from '@core/chat/types'
import { analyzeHtml, probeUrlAccessibility, summarizeFeatureMap } from './lib/analyzer'

const appId = 'website-structure-feature-analyzer'

function extractHtml(input: string) {
  const fenced = input.match(/```(?:html)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  const start = input.search(/<!doctype|<html|<body|<main|<div|<form/i)
  return start >= 0 ? input.slice(start).trim() : ''
}

function extractUrl(input: string) {
  return input.match(/https?:\/\/[^\s<>"']+/i)?.[0] || ''
}

export const chatModule: AppChatModule = {
  appId,
  actions: [
    {
      id: 'analyze-html-structure', appId,
      label: 'Analyze HTML page structure',
      description: 'Analyze pasted accessible HTML and generate a structured Page Map / Feature Map for downstream demo workflows.',
      keywords: ['analyze html', 'page structure', 'feature map', 'page map', 'detect controls'],
      canHandle: ({ input }) => /(analy[sz]e|inspect|map).*(html|page source|page structure|feature map)/i.test(input) || /```html/i.test(input),
      execute: async ({ input }) => {
        const html = extractHtml(input)
        if (!html) return { text: 'Paste the HTML/page source in your message so I can analyze it without pretending to access a restricted cross-origin DOM.' }
        try {
          const map = analyzeHtml(html)
          return { text: `${summarizeFeatureMap(map)}\n\n${JSON.stringify(map, null, 2)}` }
        } catch (error) {
          return { text: error instanceof Error ? error.message : 'Could not analyze the HTML.' }
        }
      },
    },
    {
      id: 'probe-website-analysis-access', appId,
      label: 'Check website analysis accessibility',
      description: 'Try a browser-safe URL fetch and report whether HTML is accessible for rules-based analysis or a fallback is required.',
      keywords: ['analyze url', 'website analyzer', 'check cors', 'website structure'],
      canHandle: ({ input }) => /(analy[sz]e|inspect|check).*(website|url|page)/i.test(input) && /https?:\/\//i.test(input),
      execute: async ({ input }) => {
        const url = extractUrl(input)
        if (!url) return { text: 'Include a full http:// or https:// URL.' }
        const map = await probeUrlAccessibility(url)
        if (!map.access.sourceAvailable) return { text: `${map.access.reason} No security boundary was bypassed. Recommended next mode: ${map.access.nextBestMode || 'paste-html'}.` }
        return { text: `${summarizeFeatureMap(map)}\n\n${JSON.stringify(map, null, 2)}` }
      },
    },
  ],
}
