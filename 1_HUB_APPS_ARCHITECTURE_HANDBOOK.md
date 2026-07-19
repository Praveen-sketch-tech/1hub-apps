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
