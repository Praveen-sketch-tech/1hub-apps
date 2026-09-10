"""OCR Benchmark API — FastAPI entrypoint."""
from __future__ import annotations

import json
import shutil
import time
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from .core.config import CORS_ORIGINS, TEMP_DIR, JOB_TIMEOUT_SEC
from .ocr.registry import get_registry, list_engine_ids, PRESETS
from .ocr.runner import run_job
from .utils.files import create_job_dir, validate_upload, cleanup_job

app = FastAPI(
    title="OCR Benchmark & Comparison",
    description="Upload a document once, run multiple server-side OCR engines, compare real outputs, times, and accuracy (when ground truth is provided).",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store (production: Redis / DB)
JOBS: dict = {}


@app.get("/api/health")
def health():
    return {"status": "ok", "time": time.time()}


@app.get("/api/engines")
def engines():
    return get_registry()


@app.get("/api/presets")
def presets():
    return PRESETS


@app.post("/api/jobs")
async def create_job(
    files: List[UploadFile] = File(...),
    engines: str = Form("tesseract"),
    ground_truth: str = Form(""),
    preprocess: str = Form("false"),
    preset: str = Form(""),
):
    if not files:
        raise HTTPException(400, "No file uploaded")

    # first file only for simplicity (multi-file can be extended)
    up = files[0]
    content = await up.read()
    ok, reason = validate_upload(up.filename or "upload.bin", len(content))
    if not ok:
        raise HTTPException(400, reason)

    job_id, job_dir = create_job_dir()
    suffix = Path(up.filename or "upload").suffix.lower() or ".bin"
    input_path = job_dir / f"input{suffix}"
    input_path.write_bytes(content)

    # resolve engine list
    engine_ids: List[str]
    if preset and preset in PRESETS:
        engine_ids = list(PRESETS[preset])
    elif engines.strip().lower() == "all":
        engine_ids = list_engine_ids()
    else:
        engine_ids = [e.strip() for e in engines.split(",") if e.strip()]
        if not engine_ids:
            engine_ids = ["tesseract"]

    known = set(list_engine_ids())
    engine_ids = [e for e in engine_ids if e in known]
    if not engine_ids:
        raise HTTPException(400, "No valid engines selected")

    do_pre = str(preprocess).lower() in ("1", "true", "yes", "on")

    JOBS[job_id] = {
        "id": job_id,
        "status": "running",
        "created": time.time(),
        "filename": up.filename,
        "engines": engine_ids,
        "ground_truth_provided": bool(ground_truth and ground_truth.strip()),
    }

    try:
        result = run_job(
            str(input_path),
            job_dir,
            engine_ids,
            ground_truth=ground_truth or None,
            preprocess=do_pre,
            timeout_sec=JOB_TIMEOUT_SEC,
        )
        JOBS[job_id].update(
            {
                "status": "completed",
                "result": result,
                "finished": time.time(),
            }
        )
    except Exception as e:
        JOBS[job_id].update({"status": "failed", "error": str(e)})
        raise HTTPException(500, f"Job failed: {e}")

    return {
        "job_id": job_id,
        "status": JOBS[job_id]["status"],
        "engines": engine_ids,
        "result": JOBS[job_id].get("result"),
    }


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@app.get("/api/jobs/{job_id}/export")
def export_job(job_id: str, format: str = "json"):
    job = JOBS.get(job_id)
    if not job or "result" not in job:
        raise HTTPException(404, "Job not found or incomplete")

    result = job["result"]
    export = {
        "job_id": job_id,
        "filename": job.get("filename"),
        "created": job.get("created"),
        "finished": job.get("finished"),
        "engines": job.get("engines"),
        "ground_truth_provided": job.get("ground_truth_provided"),
        "page_count": result.get("page_count"),
        "total_time_ms": result.get("total_time_ms"),
        "preprocess": result.get("preprocess"),
        "results": result.get("results"),
        "rankings": result.get("rankings"),
    }

    if format == "json":
        return JSONResponse(export)

    if format == "txt":
        lines = [
            f"OCR Benchmark Report — {job_id}",
            f"File: {job.get('filename')}",
            f"Ground truth: {job.get('ground_truth_provided')}",
            "",
        ]
        for r in result.get("results", []):
            lines.append(f"=== {r.get('engine_name')} ({r.get('status')}) ===")
            lines.append(f"Time: {r.get('processing_time_ms'):.1f} ms")
            if r.get("accuracy") is not None:
                lines.append(f"Accuracy: {r.get('accuracy'):.2f}%  CER: {r.get('cer')}  WER: {r.get('wer')}")
            lines.append(r.get("text") or r.get("error") or "")
            lines.append("")
        return JSONResponse({"text": "\n".join(lines)})

    if format == "csv":
        rows = ["engine_id,name,status,time_ms,accuracy,cer,wer,confidence"]
        for r in result.get("results", []):
            rows.append(
                ",".join(
                    [
                        str(r.get("engine_id", "")),
                        str(r.get("engine_name", "")).replace(",", " "),
                        str(r.get("status", "")),
                        f"{r.get('processing_time_ms') or 0:.1f}",
                        f"{r.get('accuracy')}" if r.get("accuracy") is not None else "",
                        f"{r.get('cer')}" if r.get("cer") is not None else "",
                        f"{r.get('wer')}" if r.get("wer") is not None else "",
                        f"{r.get('confidence')}" if r.get("confidence") is not None else "",
                    ]
                )
            )
        return JSONResponse({"csv": "\n".join(rows)})

    raise HTTPException(400, "format must be json, txt, or csv")


@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: str):
    job = JOBS.pop(job_id, None)
    if job:
        cleanup_job(TEMP_DIR / job_id)
    return {"deleted": job_id}


# Serve frontend if built
FRONTEND_DIST = Path(__file__).resolve().parents[2].parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
else:
    @app.get("/")
    def root():
        # fallback minimal page pointing to /static or instruct to open frontend
        return HTMLResponse(
            """
<!DOCTYPE html>
<html><head><title>OCR Benchmark</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:system-ui,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;background:#0f172a;color:#e2e8f0}
a{color:#38bdf8}
.card{background:#1e293b;padding:1.5rem;border-radius:12px;margin:1rem 0}
code{background:#334155;padding:2px 6px;border-radius:4px}
</style></head>
<body>
<h1>OCR Benchmark API</h1>
<div class="card">
<p>Backend is running. Open the frontend or use the API.</p>
<ul>
<li><a href="/api/engines">/api/engines</a> — registry + health</li>
<li><a href="/api/health">/api/health</a></li>
<li>POST /api/jobs — upload + run</li>
</ul>
<p>Frontend: open <code>frontend/index.html</code> or build with Vite and place in <code>frontend/dist</code>.</p>
</div>
</body></html>
"""
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
