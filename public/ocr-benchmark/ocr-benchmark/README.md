# OCR Benchmark & Comparison

Upload **one** image or PDF and run it through multiple **server-side** OCR engines. Compare real text output, processing time, confidence, and (when you provide ground truth) **CER / WER / accuracy**.

No fake accuracy numbers. Engines that are not installed report `INSTALLATION_REQUIRED` with the reason.

## Features

- Modular OCR adapters (common interface)
- Central engine registry (frontend cards generated from API)
- Real Tesseract integration (works out of the box if `tesseract` is installed)
- Optional EasyOCR, RapidOCR, PaddleOCR, docTR adapters
- Optional image preprocessing
- Ground-truth CER / WER / character accuracy
- Speed & accuracy rankings
- Side-by-side results, simple word-level diff
- JSON / TXT / CSV export
- PDF page rasterization via `pdftoppm`
- Health checks per engine

## Quick start

### 1. System packages

```bash
# Debian/Ubuntu
sudo apt update
sudo apt install -y tesseract-ocr tesseract-ocr-eng poppler-utils

# Optional Hindi
sudo apt install -y tesseract-ocr-hin
```

### 2. Python backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Run API

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Frontend

Open `frontend/index.html` in a browser (or serve it):

```bash
# simple static server from project root
python3 -m http.server 5500 --directory frontend
```

Then open http://127.0.0.1:5500 and ensure the page can reach the API at http://127.0.0.1:8000 (CORS is open).

If you open the HTML as `file://`, set in the browser console:

```js
window.OCR_API = "http://127.0.0.1:8000"
```

Or serve both behind the same origin.

## Optional engines

```bash
pip install easyocr
pip install rapidocr-onnxruntime
# PaddleOCR (choose correct paddlepaddle wheel for your platform)
pip install paddlepaddle paddleocr
pip install "python-doctr[torch]"
```

After install, restart the API. `/api/engines` will show `READY` when the import succeeds.

## Architecture

```
backend/app/ocr/
  base.py          # BaseOCREngine + OCRResult
  registry.py      # Central registry + presets
  runner.py        # Job orchestration
  metrics.py       # Real CER/WER
  preprocessing.py
  engines/
    tesseract/adapter.py
    easyocr/adapter.py
    rapidocr/adapter.py
    paddleocr/adapter.py
    doctr/adapter.py
```

Adding a new engine:

1. Create `engines/<name>/adapter.py` implementing `BaseOCREngine`
2. Register it in `registry.py`
3. Install its dependency
4. Hit `/api/engines` — health check decides READY vs INSTALLATION_REQUIRED

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness |
| GET | `/api/engines` | Registry + health |
| GET | `/api/presets` | Named engine sets |
| POST | `/api/jobs` | Upload + run (multipart) |
| GET | `/api/jobs/{id}` | Job status / result |
| GET | `/api/jobs/{id}/export?format=json\|txt\|csv` | Export |

### POST `/api/jobs` fields

- `files` — image or PDF
- `engines` — comma list or `all`
- `preset` — `quick` \| `full` \| `speed` \| …
- `ground_truth` — optional expected text
- `preprocess` — `true` / `false`

## Accuracy rules

- If **no** ground truth → Accuracy = **Not benchmarked** (no invented %).
- If ground truth is provided → CER, WER, character accuracy are computed with `editdistance`.

## License

Application code: MIT (or as you prefer).  
Underlying OCR engines keep their own licenses (Apache-2.0 for Tesseract, PaddleOCR, EasyOCR, docTR, RapidOCR, etc.).
