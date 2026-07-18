#!/data/data/com.termux/files/usr/bin/bash
set -e

MESSAGE="${1:-Add new app}"

echo "🔍 Running TypeScript check..."
npx tsc -b --pretty false

echo "📦 Staging changes..."
git add src/core/apps src/core/chat src/apps scripts .gitignore package.json package-lock.json vite.config.ts vite.config.js vercel.json src/main.tsx

echo "💾 Committing..."
if git diff --cached --quiet; then
  echo "ℹ️ Nothing new to commit."
else
  git commit -m "$MESSAGE"
fi

echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Done! Vercel will deploy automatically."
