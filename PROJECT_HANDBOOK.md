# 1 Hub Apps — Master Project Handbook

> **Purpose of this document:** This is the permanent technical and workflow reference for the **1 Hub Apps** project.  
> Any developer or AI assistant working on this repository should read this file before creating, installing, modifying, or publishing an app.

---

# 1. Project Vision

**1 Hub Apps** is a scalable collection of browser-based utility web apps built on one shared platform.

The goal is to continuously add new tools without repeatedly rebuilding:

- authentication
- routing
- homepage integration
- themes
- layouts
- headers
- cards
- buttons
- inputs
- file utilities
- download utilities
- local-processing indicators
- chat integration
- deployment infrastructure

The long-term workflow should remain:

```text
Create app ZIP
      ↓
Extract/copy app folder into src/apps/
      ↓
Run install-app.mjs
      ↓
Run publish-app.sh
      ↓
GitHub push
      ↓
Vercel automatic deployment
      ↓
App is live
```

The architecture must remain scalable even when the repository contains hundreds or thousands of apps.

---

# 2. Core Technology Stack

Current primary stack:

- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Supabase
- GitHub
- Vercel
- GitHub Codespaces / Termux-compatible development workflow

Important libraries currently available include:

- `pdf-lib`
- `pdfjs-dist`
- `jszip`
- `tesseract.js`
- `qrcode`
- `jsbarcode`
- `@zxing/browser`
- `@zxing/library`
- `cropperjs`
- `@ffmpeg/ffmpeg`
- `@ffmpeg/util`
- `@dnd-kit/core`
- `@dnd-kit/sortable`

Do not add a new dependency when an existing dependency or browser-native API can cleanly solve the problem.

---

# 3. Core Architecture Principle

The most important architecture rule is:

> **Each app owns its unique functionality. Shared platform behavior belongs in shared/core infrastructure.**

Apps must NOT independently reinvent common platform elements.

Examples of things that should generally remain shared:

- Tool header
- Local-processing badge
- Global theme
- Common page styling
- Common cards/panels
- Buttons
- Inputs
- Upload patterns
- Download helpers
- File helpers
- Responsive behavior
- Global chat UI
- Chat execution infrastructure
- App registration
- Lazy route registration

An individual app should primarily contain:

```text
Unique app UI
Unique app components
Unique processing/business logic
App-specific types
App-specific chat actions
```

This keeps future global changes manageable.

If a common UI element needs a design change, the preferred architecture is that changing the shared component updates every app using it.

Do not copy common components into every new app.

---

# 4. Important Project Directories

Main structure:

```text
src/
├── apps/
│   ├── smart-image-tools/
│   ├── smart-pdf-tools/
│   ├── qr-barcode-studio/
│   ├── smart-text-tools/
│   ├── smart-data-tools/
│   ├── smart-calculator-converter/
│   ├── smart-file-tools/
│   ├── smart-document-scanner-ocr/
│   ├── smart-audio-tools/
│   └── smart-video-tools/
│
├── core/
│   ├── apps/
│   │   ├── appRegistry.ts
│   │   └── appLoaders.ts
│   │
│   └── chat/
│       ├── appChatModules.ts
│       ├── chatExecutor.ts
│       ├── chatRegistry.ts
│       ├── defaultChatActions.ts
│       ├── types.ts
│       └── useAppChatCommands.ts
│
└── shared/
    ├── components/
    │   ├── chat/
    │   │   └── GlobalToolChat.tsx
    │   ├── tools/
    │   │   ├── ToolAppHeader.tsx
    │   │   └── LocalProcessingBadge.tsx
    │   ├── ui/
    │   ├── upload/
    │   └── layout/
    │
    └── utils/
        ├── downloads.ts
        └── files.ts

scripts/
├── install-app.mjs
└── publish-app.sh
```

---

# 5. Shared UI Foundation

Future apps should reuse shared infrastructure wherever applicable.

Important shared components currently include:

```text
src/shared/components/tools/ToolAppHeader.tsx
src/shared/components/tools/LocalProcessingBadge.tsx

src/shared/components/ui/Avatar.tsx
src/shared/components/ui/Badge.tsx
src/shared/components/ui/Button.tsx
src/shared/components/ui/Card.tsx
src/shared/components/ui/EmptyState.tsx
src/shared/components/ui/Input.tsx
src/shared/components/ui/Modal.tsx
src/shared/components/ui/Spinner.tsx

src/shared/components/upload/FileUpload.tsx

src/shared/components/layout/AppLayout.tsx
src/shared/components/layout/PageContainer.tsx
```

Shared utilities include:

```text
src/shared/utils/downloads.ts
src/shared/utils/files.ts
```

Before creating a new button, card, input, upload component, header, badge, file helper, or download helper, check whether a shared implementation already exists.

If it does, reuse it.

---

# 6. Theme and Visual Rules

Apps must respect the global light/dark theme.

Important requirements:

- Dark-theme page titles must remain readable.
- Descriptions must have sufficient contrast.
- Cards and panels must use shared theme tokens.
- Do not create isolated app-level theme systems unless technically necessary.
- Responsive behavior should work on mobile and desktop.
- Common UI styling should remain visually consistent across apps.

---

# 7. Local Processing Philosophy

Whenever technically practical, utility tools should process user files locally in the browser.

Benefits:

- Better privacy
- No unnecessary file uploads
- Reduced server costs
- Faster deployment
- Easier scaling

For browser/local-only tools, use the shared `LocalProcessingBadge` consistently.

Do not falsely claim local processing if a feature sends files or content to an external server/API.

---

# 8. Existing Apps

## #001 — Smart Image Tools
Route: `/apps/smart-image-tools`

Core capabilities:
- Compress
- Resize
- Convert
- Crop

Chat-accessible functionality currently includes image compression.

## #002 — Smart PDF Tools
Route: `/apps/smart-pdf-tools`

Core capabilities:
- Images to PDF
- Merge
- Split
- Extract
- Reorder
- Rotate
- Delete pages
- Compress
- Download generated PDFs

Chat-accessible functionality currently includes PDF compression.

## #003 — QR & Barcode Studio
Route: `/apps/qr-barcode-studio`

Core capabilities:
- QR generation
- Barcode generation
- Scanning
- Wi-Fi QR workflows

Chat actions include QR and barcode generation.

## #004 — Smart Text Tools
Route: `/apps/smart-text-tools`

Chat actions include:
- Clean text
- Convert case
- Remove duplicate lines
- Sort lines
- Extract useful values
- JSON tools

## #005 — Smart Data Tools
Route: `/apps/smart-data-tools`

Core capabilities:
- CSV
- JSON
- Data cleaning
- Conversion
- Filtering/export workflows

Chat actions include data cleaning and JSON-to-CSV conversion.

## #006 — Smart Calculator & Converter
Route: `/apps/smart-calculator-converter`

Core capabilities:
- EMI
- GST
- Everyday calculations
- Unit conversions

Chat actions include EMI calculation and unit conversion.

## #007 — Smart File Tools
Route: `/apps/smart-file-tools`

Registry ID currently:
`app-007-smart-file-tools`

Core capabilities:
- Bulk rename
- SHA-256
- Duplicate detection
- ZIP tools
- File splitting
- Chunk merging

Chat-accessible functionality currently includes SHA-256 hashing.

## #008 — Smart Document Scanner & OCR
Route: `/apps/smart-document-scanner-ocr`

Core capabilities:
- Document scanning
- OCR
- Perspective correction
- Deskew
- Scan enhancement
- PDF export

Chat-accessible functionality includes OCR text extraction from attached document images.

## #009 — Smart Audio Tools
Route: `/apps/smart-audio-tools`

Core capabilities:
- Trim
- Merge
- Volume adjustment
- Fade
- Speed
- WAV export

Chat-accessible functionality currently includes audio-to-WAV conversion.

## #010 — Smart Video Tools
Route: `/apps/smart-video-tools`

Core capabilities:
- Trim
- Resize
- Compress
- Rotate
- Mute
- Extract audio

Chat-accessible functionality currently includes extracting audio from video.

---

# 9. App Registry

Homepage/application metadata is maintained in:

`src/core/apps/appRegistry.ts`

Example:

```ts
{
  id: 'smart-example',
  number: '011',
  name: 'Smart Example',
  description: 'Example description.',
  path: '/apps/smart-example',
  tags: ['Tool One', 'Tool Two'],
}
```

Do not manually create duplicate homepage cards.

---

# 10. Lazy App Loading

Lazy-loaded routes are maintained in:

`src/core/apps/appLoaders.ts`

Every new app should be lazy-loaded.

Do NOT eagerly import hundreds of apps into the main bundle.

---

# 11. Standard Future App ZIP Structure

A future app ZIP should ideally contain one self-contained app folder.

Example:

```text
smart-example/
├── SmartExamplePage.tsx
├── index.ts
├── chatActions.ts
├── components/
│   └── ...
├── lib/
│   └── ...
├── types/
│   └── ...
└── styles/
    └── ...
```

Required expectations:

1. The app must have an `index.ts`.
2. The main page component must be exported from `index.ts`.
3. Unique processing logic should live inside the app.
4. Shared/common logic should reuse `src/shared`.
5. Chat-accessible operations belong in `chatActions.ts`.
6. The app should not manually edit global routing when the installer can do it.
7. The app should be lazy-load compatible.
8. Browser-only apps should not introduce unnecessary backend dependencies.

---

# 12. Creating an App ZIP

When an AI assistant is asked to generate a future app ZIP, it should:

1. Understand the app requirements.
2. Build only the app-specific folder.
3. Follow existing project conventions.
4. Reuse shared components/utilities.
5. Export the main page from `index.ts`.
6. Include app-owned processing logic.
7. Include `chatActions.ts`.
8. Avoid duplicating global infrastructure.
9. Avoid modifying unrelated existing apps.
10. Keep TypeScript compatible with the project build.

The ZIP should normally be ready to copy into:

`src/apps/<folder>`

---

# 13. Installing a New App

Installer:

`scripts/install-app.mjs`

Usage:

```bash
node scripts/install-app.mjs \
<folder> \
<number> \
"<name>" \
<route> \
"<description>" \
<exportName> \
"<tagsCsv>"
```

Example:

```bash
node scripts/install-app.mjs \
smart-example \
011 \
"Smart Example" \
/apps/smart-example \
"Example app description." \
SmartExamplePage \
"Tool One,Tool Two,Tool Three"
```

The installer currently handles:

- Verifying the app folder exists
- Verifying `index.ts`
- Verifying the requested page export exists
- Creating `chatActions.ts` scaffold if missing
- Adding the app to `APP_REGISTRY`
- Adding lazy loading to `APP_LOADERS`
- Registering the app's chat module

---

# 14. Chat Architecture

Global chat UI:

`src/shared/components/chat/GlobalToolChat.tsx`

Core chat infrastructure:

```text
src/core/chat/appChatModules.ts
src/core/chat/chatExecutor.ts
src/core/chat/types.ts
```

The architecture is app-owned.

Each app owns:

`chatActions.ts`

Flow:

```text
Global Chat
    ↓
Chat Executor
    ↓
Registered App Chat Modules
    ↓
App's chatActions.ts
    ↓
App's existing processing logic
```

---

# 15. Critical Chat Rule

> **Do not duplicate processing logic inside chat actions.**

The UI and chat should reuse the same underlying app processing functions whenever possible.

```text
App UI ──────┐
             ├──> app/lib/processing.ts
Chat Action ─┘
```

---

# 16. App Chat Module Pattern

```ts
import type { AppChatModule } from '@core/chat/types'

export const chatModule: AppChatModule = {
  appId: 'smart-example',
  actions: [
    {
      id: 'example-action',
      appId: 'smart-example',
      label: 'Example action',
      description: 'Run the example operation.',
      keywords: ['example'],
      canHandle: ({ input }) => /example/i.test(input),
      execute: async ({ input, file }) => {
        return {
          text: 'Completed successfully.',
        }
      },
    },
  ],
}
```

File-based actions may return text, Blob, and download filename.

---

# 17. Dynamic Chat Capability Help

Users can ask:

- `What can you do?`
- `Tum kya kya kar sakte ho?`
- `Help`
- `Available tools`

The response should be generated from currently registered chat actions.

Future apps that correctly register `chatActions.ts` should automatically become part of the dynamic capability system.

---

# 18. Two-Step App Publishing Workflow

Once a prepared app folder is copied/extracted into:

`src/apps/<folder>`

the intended workflow is essentially two commands.

## Command 1 — Install/Register

```bash
node scripts/install-app.mjs \
smart-example \
011 \
"Smart Example" \
/apps/smart-example \
"Example description." \
SmartExamplePage \
"Feature One,Feature Two"
```

## Command 2 — Publish

```bash
bash scripts/publish-app.sh "feat: add app 011 smart example"
```

Practical pipeline:

```text
ZIP ready
→ copy/extract
→ install command
→ publish command
→ live
```

---

# 19. Production Validation

Standard check:

```bash
npx tsc -b --pretty false
```

Production build:

```bash
npm run build
```

Termux-specific build:

```bash
npm run build:termux
```

A Vite chunk-size warning is not automatically a failed build.

---

# 20. Publishing Script

Current publishing helper:

`scripts/publish-app.sh`

Usage:

```bash
bash scripts/publish-app.sh "commit message"
```

The script:

1. Runs TypeScript validation.
2. Stages project/app changes.
3. Commits if changes exist.
4. Pushes `main` to GitHub.
5. Vercel deploys automatically.

---

# 21. Vercel and SPA Deep Links

The project uses SPA rewrites through `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Do not remove this rewrite without equivalent SPA routing support.

---

# 22. PWA / Service Worker Rule

The project previously experienced refresh/offline issues related to PWA/service-worker behavior.

Current rule:

> Do not reintroduce or enable PWA/service-worker behavior casually.

Although `vite-plugin-pwa` may still exist as a dependency, service-worker behavior should remain disabled unless intentionally redesigned and tested.

---

# 23. Supabase/Base Platform

The base platform includes:

- Authentication
- Signup/Login/Logout
- Session handling
- User profiles
- Password changes
- Feedback
- Analytics
- Admin access
- RLS/security
- Theme handling

Utility apps should not duplicate this infrastructure.

Never commit real secret API keys or sensitive `.env` credentials.

---

# 24. Rules for AI Assistants

## DO

- Read this README first.
- Inspect shared components before creating common UI.
- Preserve `APP_REGISTRY`.
- Preserve `APP_LOADERS`.
- Preserve lazy loading.
- Use `install-app.mjs`.
- Use `publish-app.sh`.
- Keep app-specific logic inside its app folder.
- Keep reusable logic shared.
- Reuse app processing logic for chat actions.
- Keep chat actions app-owned.
- Run TypeScript checks.
- Preserve Vercel SPA rewrites.
- Keep local processing local whenever practical.
- Maintain mobile responsiveness.
- Maintain light/dark theme compatibility.

## DO NOT

- Hardcode every future app into one giant route component.
- Hardcode every chat action into `chatExecutor.ts`.
- Duplicate global headers inside every app.
- Duplicate shared download/file utilities.
- Create independent theme systems for every app.
- Add unnecessary servers for browser-native operations.
- Add API keys to source code.
- Reintroduce service workers casually.
- Break deep-link refresh.
- Modify unrelated apps while adding a new one.
- Eagerly load every app into the main bundle.
- Create duplicate homepage cards manually.
- Rewrite the architecture for every new app.

---

# 25. When Global Changes Are Needed

If a requirement affects all apps, first determine whether it belongs in:

`src/shared/`

or:

`src/core/`

Examples:

```text
Change all tool headers
→ shared ToolAppHeader

Change local-processing badge
→ shared LocalProcessingBadge

Change generic button behavior
→ shared Button

Change global chat routing
→ core chat infrastructure

Change app discovery
→ appRegistry / appLoaders / installer

Change generic downloads
→ shared utils/downloads
```

The goal is one global fix rather than editing hundreds of apps.

---

# 26. Future Scalability

The architecture is intended to support a large number of apps through:

- Central app metadata
- Lazy-loaded routes
- App-owned feature code
- Shared UI
- Shared utilities
- App-owned chat actions
- Dynamic chat registration
- Automated installation
- Automated publishing

As the app count grows, periodically review:

- bundle sizes
- build times
- route loading
- dependency duplication
- chat action matching performance
- registry organization
- search/discovery UX

Optimize infrastructure centrally.

---

# 27. Recommended Workflow for Every Future App

```text
[ ] Decide app number and name
[ ] Define features
[ ] Check browser-local feasibility
[ ] Check existing dependencies
[ ] Check shared components/utilities
[ ] Build self-contained app folder
[ ] Export main page from index.ts
[ ] Add/reuse processing functions
[ ] Add app-owned chatActions.ts
[ ] Copy app folder to src/apps/
[ ] Run install-app.mjs
[ ] Run TypeScript/build checks
[ ] Test UI
[ ] Test mobile
[ ] Test light/dark theme
[ ] Test local-processing claims
[ ] Test chat actions
[ ] Test "What can you do?"
[ ] Run publish-app.sh
[ ] Verify GitHub push
[ ] Verify Vercel deployment
[ ] Verify live deep-link refresh
```

---

# 28. Quick Reference — New App

Example for App #011:

```bash
node scripts/install-app.mjs \
smart-example \
011 \
"Smart Example" \
/apps/smart-example \
"Example browser-based utility." \
SmartExamplePage \
"Feature One,Feature Two,Feature Three"
```

Then:

```bash
bash scripts/publish-app.sh "feat: add app 011 smart example"
```

---

# 29. Current Project State

At the time this handbook was created:

- Base platform is operational.
- Apps #001–#010 are registered.
- Apps use central `APP_REGISTRY`.
- Apps use lazy `APP_LOADERS`.
- Shared tool UI infrastructure exists.
- Shared download/file utilities exist.
- Global chat infrastructure exists.
- Existing apps have app-owned `chatActions.ts`.
- Dynamic chat capability discovery exists.
- New-app installer handles registry, loader, and chat-module registration.
- Publishing helper performs TypeScript validation and GitHub push.
- Vercel handles automatic deployment.
- SPA deep-link rewrite is configured.
- PWA/service-worker functionality should not be casually reintroduced.

---

# 30. Golden Rule

When adding a new app, ask:

> **What is unique to this app?**

Put that inside the app.

Then ask:

> **What will many apps need?**

Reuse or improve shared/core infrastructure.

The target is:

```text
Build feature once.
Reuse common infrastructure everywhere.
Install automatically.
Publish automatically.
Deploy automatically.
```

---

## Final Note for Future AI Sessions

If you are an AI assistant continuing this project:

1. Read this README.
2. Do not redesign working architecture without a concrete reason.
3. Inspect the relevant existing implementation before making structural changes.
4. Prefer small, safe, backwards-compatible changes.
5. When generating a new app, produce a ZIP/folder compatible with the existing installer.
6. Keep unique logic inside the app.
7. Reuse shared UI and utilities.
8. Give the app its own chat actions.
9. Validate TypeScript/build before publishing.
10. Keep the simple **ZIP → Install → Publish → Live** workflow intact.
