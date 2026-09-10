import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
TEMP_DIR = Path(os.environ.get("OCR_TEMP", "/tmp/ocr_benchmark"))
TEMP_DIR.mkdir(parents=True, exist_ok=True)
MAX_UPLOAD_MB = 50
JOB_TIMEOUT_SEC = 180
CORS_ORIGINS = ["*"]
