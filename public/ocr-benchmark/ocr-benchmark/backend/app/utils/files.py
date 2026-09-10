"""File validation, temp dirs, cleanup."""
from __future__ import annotations

import os
import shutil
import tempfile
import uuid
from pathlib import Path
from typing import List, Tuple

ALLOWED_IMAGE = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp", ".gif"}
ALLOWED_PDF = {".pdf"}
ALLOWED = ALLOWED_IMAGE | ALLOWED_PDF
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
MAX_PAGES = 30


def ensure_workdir(base: str | None = None) -> Path:
    root = Path(base or os.environ.get("OCR_TEMP", tempfile.gettempdir())) / "ocr_benchmark"
    root.mkdir(parents=True, exist_ok=True)
    return root


def create_job_dir(job_id: str | None = None) -> Tuple[str, Path]:
    jid = job_id or str(uuid.uuid4())
    path = ensure_workdir() / jid
    path.mkdir(parents=True, exist_ok=True)
    return jid, path


def validate_upload(filename: str, size: int) -> Tuple[bool, str]:
    if size > MAX_FILE_SIZE:
        return False, f"File too large (max {MAX_FILE_SIZE // (1024*1024)} MB)"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED:
        return False, f"Unsupported format: {ext}. Allowed: {sorted(ALLOWED)}"
    return True, ""


def is_pdf(path: str | Path) -> bool:
    return Path(path).suffix.lower() == ".pdf"


def cleanup_job(job_dir: Path) -> None:
    try:
        if job_dir.exists() and job_dir.is_dir():
            shutil.rmtree(job_dir, ignore_errors=True)
    except Exception:
        pass
