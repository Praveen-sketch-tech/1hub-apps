#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> System packages (Debian/Ubuntu)"
if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y tesseract-ocr tesseract-ocr-eng poppler-utils
fi

echo "==> Python venv"
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "==> Health check"
PYTHONPATH=. python3 -c "from app.ocr.registry import get_registry; import json; print(json.dumps({k:v['status'] for k,v in get_registry().items()}, indent=2))"

echo ""
echo "Done. Start API with:"
echo "  cd backend && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
echo "Open frontend/index.html (or serve it) and point to the API."
