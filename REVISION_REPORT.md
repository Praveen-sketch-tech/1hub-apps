# 1 Hub Apps revised source

This source revision performs a real all-app theme migration pass rather than adding per-app imports only.

- All 27 tool roots participate in `.tool-page`.
- The shared contract is loaded once from `src/index.css`.
- Legacy theme variables are mapped to canonical `--tool-*` tokens.
- App #026/#027 white-card fallbacks are removed explicitly.
- App CSS keeps unique layout/visualization rules; common theme values resolve through the shared contract.
- `npm run audit:theme` checks key regressions.

Browser permission limitations remain: mobile browsers without `getDisplayMedia` cannot perform real screen/tab capture. The UI/runtime must represent this as an unsupported or waiting checkpoint, not fake success.
