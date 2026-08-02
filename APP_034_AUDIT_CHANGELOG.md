# App #034 (AI App Importer) — Audit Changelog

This archive contains only the files that changed during the App #034 audit.
Extract it into the root of your 1Hub Apps repository — every path below is
relative to the repo root, and file locations are preserved so extraction
will overwrite the matching files in place.

## Files in this archive

- `src/apps/ai-app-importer/index.tsx`
- `src/apps/ai-app-importer/components/Preview.tsx`
- `src/apps/ai-app-importer/services/deployment.ts`
- `src/apps/ai-app-importer/services/generator.ts`
- `src/apps/ai-app-importer/services/github.ts`
- `src/apps/ai-app-importer/services/validator.ts`
- `src/apps/ai-app-importer/utils/parser.ts`

No other files in the repo needed changes. In particular, `src/core/apps/appRegistry.ts`
and `src/core/apps/appLoaders.ts` already correctly registered App #034 and were
left untouched — the importer now reads those two files at build time (via Vite
`?raw` imports) to decide whether a *newly imported* app needs to be auto-registered.

## What changed and why

1. **Broken GitHub/Vercel URLs fixed** (`services/github.ts`, `services/deployment.ts`)
   Every REST call was templated as `` `[https://...](https://...)`{owner}` `` — a
   markdown-link artifact that silently broke variable interpolation, so pushes and
   deploy-hook calls never hit the right endpoint. Replaced with correct template
   literals.

2. **"Generate Local" now really generates a boilerplate** (`services/generator.ts`, `index.tsx`)
   `autoFillBoilerplate()` detects the app slug from the pasted files, fills in a
   missing `manifest.json` (auto-assigning the next free App # from the live
   registry), a default `index.tsx` with a `<Name>Page` export, and an optional
   `chatActions.ts` scaffold. `buildLocalPackageZip()` zips everything (using the
   same JSZip pattern already used elsewhere in the codebase) plus an
   `AI_APP_IMPORTER_INSTALL.md` with instructions, and `index.tsx` now triggers a
   real browser download of `<slug>-boilerplate.zip` instead of only setting a
   status message.

3. **Auto-registration, without hardcoding anything**
   If the detected app slug isn't already in `appRegistry.ts`/`appLoaders.ts`,
   updated versions of both files are included in the generated zip so the
   person can drop them in (or merge by hand). App numbers are computed from the
   live registry, never hardcoded.

4. **GitHub/Vercel credentials are fully optional**
   The credentials panel in `index.tsx` is now collapsed by default, explicitly
   labeled "Optional," and does not gate Parse, Validate, or Generate Local in
   any way. It's only referenced when the person clicks "Push & Deploy."

5. **Registry-aware validation** (`services/validator.ts`, `index.tsx`)
   `validateParsedFiles` is now typed against the real `AppDefinition` shape and
   is called with the live `APP_REGISTRY`, so duplicate app slugs/numbers are
   caught against real data instead of never being checked.

6. **Lint/type fixes**
   - `utils/parser.ts`: removed an unnecessary regex escape (`no-useless-escape`).
   - `services/generator.ts`: `const` instead of `let` for a never-reassigned
     binding (`prefer-const`).
   - `services/validator.ts`: removed an `any[]` parameter in favor of the real
     `AppDefinition[]` type.

## Build verification

Run from the repo root after extracting:

```
npm install
npx tsc -b
npm run build
```

Both commands complete with zero errors. `npx eslint src/apps/ai-app-importer --ext .ts,.tsx`
also reports zero problems.

Note: a full-repo `npx eslint . --ext .ts,.tsx` surfaces pre-existing warnings/errors
in unrelated apps (e.g. `smart-multi-document-ocr-pdf-builder`, `smart-password-generator`,
`website-structure-feature-analyzer`, `core/runtime/demoRuntime.ts`, several context
providers). These predate this audit and were intentionally left alone, since the
brief was scoped to App #034 only ("Do not rewrite unrelated apps").
