import { AICredentials, AIConnectionResult, AIProvider } from '../types';

const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  google: 'Google Gemini'
};

export function getProviderLabel(provider: AIProvider): string {
  return PROVIDER_LABELS[provider] || provider;
}

// The model asked to produce output is instructed to use the exact same
// "===== FILE: path =====" block format that services/parser.ts already
// parses, so the generated output can be fed straight into the existing
// parsing/validation/generation pipeline with zero changes to that pipeline.
const SYSTEM_PROMPT = `You generate complete, self-contained apps for the "1Hub Apps" React + TypeScript + Tailwind CSS repository.

Output ONLY file blocks in exactly this format, one per file, with no extra commentary before, between, or after them:

===== FILE: src/apps/<kebab-case-app-slug>/manifest.json =====
<file content>
===== END FILE =====

Rules you must follow:
- Always output these three files at minimum, all under the same "src/apps/<slug>/" directory:
  1. manifest.json — valid JSON with fields: id, number ("000"), name, description, path ("/apps/<slug>"), icon, category.
  2. index.tsx — a React functional component. It MUST contain both "export default function ComponentName()" AND a named export "export const ComponentNamePage = ComponentName;" where ComponentName is the PascalCase version of the slug.
  3. chatActions.ts — export a "chatModule" of type AppChatModule (imported from '@core/chat/types') with appId set to the slug and an empty or minimal actions array.
- <kebab-case-app-slug> must be a short, descriptive, lowercase, hyphenated slug derived from the request (e.g. "calculator-app").
- Style index.tsx using Tailwind utility classes matching a dark theme (bg-slate-950, text-white, rounded-xl, border border-slate-800, accent colors like indigo/emerald/purple-600), consistent with a small self-contained browser tool.
- Do not use any external network calls or server-side code — everything must run entirely client-side in the browser.
- Do not wrap the whole answer in a single markdown code fence. Do not include any explanation, preamble, or summary outside the FILE blocks.`;

/**
 * Lightweight ping to confirm the provider/key combination actually
 * authenticates. The key is sent directly to the provider's own API from
 * the browser — never to any 1Hub server — and is only ever persisted to
 * the browser's localStorage by the caller.
 */
export async function validateAIConnection({ provider, apiKey }: AICredentials): Promise<AIConnectionResult> {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: 'Enter an API key first.' };
  }

  try {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!res.ok) return { success: false, error: `OpenAI rejected the key (${res.status} ${res.statusText}).` };
      return { success: true };
    }

    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }]
        })
      });
      if (res.status === 401 || res.status === 403) {
        return { success: false, error: 'Anthropic rejected the API key.' };
      }
      // Any other response (including a 400 on this minimal payload) still
      // means the key itself authenticated successfully.
      return { success: true };
    }

    if (provider === 'google') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
      if (!res.ok) return { success: false, error: `Google rejected the key (${res.status} ${res.statusText}).` };
      return { success: true };
    }

    return { success: false, error: 'Unknown provider.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed';
    return { success: false, error: message };
  }
}

/**
 * Calls the configured LLM with the person's plain-language app description
 * and returns raw text. That raw text is intentionally in the same format
 * "Paste AI Output" already accepts, so the caller can hand it straight to
 * parsePromptText() from services/parser.ts — no new parsing logic needed.
 */
export async function generateAppFilesFromPrompt(
  { provider, apiKey }: AICredentials,
  description: string
): Promise<string> {
  const userPrompt = `Build this app: ${description}`;

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ]
      })
    });
    if (!res.ok) throw new Error(`OpenAI generation failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text || !String(text).trim()) throw new Error('OpenAI returned an empty response.');
    return text;
  }

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    if (!res.ok) throw new Error(`Anthropic generation failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    const text = (data?.content || []).map((block: { text?: string }) => block.text || '').join('\n');
    if (!text.trim()) throw new Error('Anthropic returned an empty response.');
    return text;
  }

  if (provider === 'google') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
        })
      }
    );
    if (!res.ok) throw new Error(`Google generation failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map((part: { text?: string }) => part.text || '')
      .join('\n');
    if (!text.trim()) throw new Error('Google returned an empty response.');
    return text;
  }

  throw new Error('Unknown provider.');
}
