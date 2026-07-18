# App #011 — Smart Password Generator

Small browser-only test app for the 1 Hub Apps ZIP → install → publish workflow.

## Install

Copy the `smart-password-generator` folder into `src/apps/`, then run:

```bash
node scripts/install-app.mjs smart-password-generator 011 "Smart Password Generator" /apps/smart-password-generator "Generate strong, random passwords locally in your browser." SmartPasswordGeneratorPage "Password Generator,Strong Password,Random Password,Security"
```

Then publish:

```bash
bash scripts/publish-app.sh "feat: add app 011 smart password generator"
```
