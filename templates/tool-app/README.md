# Tool App Template Contract

Every new 1 Hub Apps tool should:

- Export its page from `index.ts` and be registered through `scripts/install-app.mjs`.
- Use `ToolAppHeader` and `LocalProcessingBadge` where applicable.
- Use shared UI primitives (`Card`, `Panel`, `Button`, `Input`, `Select`, `Textarea`, `FileUpload`) and `tool-*` classes/tokens before adding app-local UI CSS.
- Keep processing functions outside the page component so UI buttons and chat actions call the same reusable logic.
- Export `chatModule` from `chatActions.ts`; do not build a second chat UI.
- Keep app-local CSS only for genuinely unique editors, canvases, timelines, previews, or domain-specific layouts.
- Keep browser-only/local processing honest about permission and platform limitations.
