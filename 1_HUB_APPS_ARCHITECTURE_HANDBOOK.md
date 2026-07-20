# 1 Hub Apps Architecture Handbook

## Locked foundation

1. React + TypeScript + Vite; app pages are lazy-loaded through `APP_LOADERS` and metadata lives in `APP_REGISTRY`.
2. New apps are registered with `scripts/install-app.mjs`; Vercel SPA rewrites stay enabled; PWA/service worker stays disabled unless intentionally reintroduced.
3. Shared UI is the default: `ToolAppHeader`, `LocalProcessingBadge`, `Card`, `Panel`, `Button`, `Input`, `Select`, `Textarea`, `FileUpload`, shared file/download utilities, and global `tool-*` theme/layout classes.
4. App CSS is allowed only for unique domain UI. Do not recreate generic cards, buttons, inputs, selects, textareas, dropzones, page backgrounds, or dark-theme systems per app.
5. UI and processing logic remain separate. The same reusable processing function must be callable from the app UI and the global chat/action layer.
6. Every app gets a `chatActions.ts` module registered by the installer. Global chat is shared; apps do not create separate chat interfaces.
7. Browser/local tools must state real capability limits and permission checkpoints. Never fake successful execution.
8. Apps #017–#027 form the reusable demo workflow chain. #026 orchestrates registered capabilities; #027 is the final UX. Screen/tab capture depends on browser support and user permission.
9. Before publishing: run `npx tsc -b --pretty false`, `npm run build`, then `scripts/publish-app.sh`.
10. New app numbering must use the latest current project count, never an old remembered count.

## New app acceptance checklist

- Lazy route and registry entry work.
- Shared header/theme/UI primitives used.
- Mobile and dark/light layouts remain readable.
- Processing is reusable and not embedded only in click handlers.
- Chat action registration exists and calls reusable processing.
- Downloads/file handling use shared utilities where applicable.
- TypeScript and production build pass.
- Root page element carries the `tool-page` class (see rule 11).
- `npm run audit` passes.

## Canonical `--tool-*` theme tokens

These are the **only** custom-property names an app is allowed to reference
as `var(--tool-...)`. They are defined once in `src/index.css` for `:root`
and `.dark`, and already resolve correctly for both themes:

`--tool-page-bg`, `--tool-surface`, `--tool-surface-soft`,
`--tool-surface-text`, `--tool-surface-muted`, `--tool-text`, `--tool-muted`,
`--tool-border`, `--tool-accent`, `--tool-accent-text`, `--tool-input-bg`.

Do not invent app-local names like `--tool-primary`, `--tool-card`,
`--tool-card-bg`, or `--tool-input` — none of those are defined anywhere, so
`var()` silently falls back to whatever hardcoded default sits next to it,
in every theme. `scripts/audit-theme-contract.mjs` rejects any
`var(--tool-*)` name outside this list.

## 11. `tool-page` is mandatory, and lessons from the 2026-07 consolidated pass

A full audit of apps #001–#027 found that **17 of 28 registered apps never
carried the `tool-page` class on their root element**, which meant the
shared theme contract (`src/index.css`, `src/shared/styles/*.css`) never
applied to them at all — no amount of correct `--tool-*` token usage inside
those apps could fix their contrast, because the base contract that makes
those tokens actually paint the page never ran. Every new `*Page.tsx` must
have `className="tool-page <app-prefix>-page"` (or equivalent) on its
outermost element. `scripts/audit-theme-contract.mjs` enforces this for
every app registered in `APP_REGISTRY`.

The same audit found four other recurring bug patterns, all now caught by
`scripts/audit-theme-contract.mjs` — if you hit one of these while editing
an app, it is not a new mistake, it is a known failure mode:

- **`var(--tool-border))` (double closing paren).** A stray extra `)` after
  a `var(--tool-*)` call is invalid CSS; the browser silently drops that
  whole declaration. This shipped in 11 files across ~44 declarations and
  mostly manifested as missing card/input borders.
- **`var(--card-bg, rgba(255,255,255,.96))`, `var(--button-bg, ...)`,
  `var(--text-color, inherit)`.** These custom properties were never
  defined anywhere in the codebase, so every one of them silently resolved
  to its hardcoded fallback — a near-solid white card — in every theme,
  including dark. This is the root cause of the white-card/invisible-text
  reports on apps #014, #015, #022–#027. Bind directly to `--tool-surface`,
  `--tool-surface-soft`, and `--tool-surface-text` instead of introducing a
  new custom property with a color literal as its fallback.
- **A stray orphaned `.dark` selector line** (e.g. `.dark` on its own line,
  followed by blank lines, followed by an unrelated rule). CSS treats
  adjacent selectors separated only by whitespace as a descendant
  combinator, so the next rule silently becomes scoped to `.dark <rule>` —
  this broke `.qbs-tabs` layout in light mode and `.spt-visually-hidden`
  accessibility hiding in light mode. This is leftover debris from an
  earlier automated find/replace pass; if you see an orphaned `.dark` line
  with nothing else on it, delete it.
- **App-local `.dark` overrides or `@media (prefers-color-scheme: dark)`
  blocks re-deciding surface/border/text colors.** The app should never
  re-decide its own dark palette — it inherits dark values automatically
  through `--tool-*` tokens, which are already dark-aware. The only
  sanctioned exception is a narrow, single-property semantic tweak (e.g.
  softening one status-badge color) that does not touch
  surface/border/text tokens; anything broader belongs in the shared
  contract, not the app.

Run `npm run audit` (theme contract + app foundation) before publishing;
`npm run build:termux` runs the theme audit automatically as a gate.
