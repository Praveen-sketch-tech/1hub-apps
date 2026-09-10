"""PDF page extraction (scanned or mixed)."""
from __future__ import annotations

from pathlib import Path
from typing import List
import subprocess
import shutil


def pdf_to_images(pdf_path: str, out_dir: str, dpi: int = 200, max_pages: int = 30) -> List[str]:
    """
    Convert PDF pages to PNG images using pdftoppm (poppler).
    Returns ordered list of image paths.
    """
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    prefix = out / "page"

    if not shutil.which("pdftoppm"):
        raise RuntimeError("pdftoppm (poppler-utils) not found. Install poppler.")

    # -png -r dpi -l max_pages
    cmd = [
        "pdftoppm",
        "-png",
        "-r",
        str(dpi),
        "-l",
        str(max_pages),
        str(pdf_path),
        str(prefix),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if proc.returncode != 0:
        raise RuntimeError(f"pdftoppm failed: {proc.stderr or proc.stdout}")

    pages = sorted(out.glob("page-*.png"))
    if not pages:
        # some versions use page-1.png vs page-01.png
        pages = sorted(out.glob("page*.png"))
    return [str(p) for p in pages]


def try_extract_text_layer(pdf_path: str) -> str | None:
    """Best-effort text layer extraction (for text PDFs). Returns None if empty."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(pdf_path)
        parts = []
        for page in reader.pages[:30]:
            t = page.extract_text() or ""
            if t.strip():
                parts.append(t)
        text = "\n\n".join(parts).strip()
        return text if text else None
    except Exception:
        return None
