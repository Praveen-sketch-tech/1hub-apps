"""Job runner: preprocess, dispatch engines, metrics, ranking."""
from __future__ import annotations

import concurrent.futures
import time
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional

from .base import EngineStatus, OCRResult
from .registry import get_engine, PRESETS
from .metrics import compute_metrics
from .preprocessing import apply_pipeline
from ..utils.files import is_pdf, MAX_PAGES
from ..utils.pdf import pdf_to_images


def _run_one(
    engine_id: str,
    image_paths: List[str],
    timeout_sec: float = 120.0,
) -> OCRResult:
    try:
        eng = get_engine(engine_id)
        # health first
        hc = eng.health_check()
        status = hc.get("status")
        if status != EngineStatus.READY and str(status) != "READY":
            return OCRResult(
                engine_id=engine_id,
                engine_name=getattr(eng, "name", engine_id),
                engine_version=getattr(eng, "version", ""),
                status=EngineStatus(status) if not isinstance(status, EngineStatus) else status,
                error=hc.get("reason", "Not available"),
            )
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            fut = ex.submit(eng.process, image_paths)
            return fut.result(timeout=timeout_sec)
    except concurrent.futures.TimeoutError:
        return OCRResult(
            engine_id=engine_id,
            engine_name=engine_id,
            engine_version="",
            status=EngineStatus.TIMEOUT,
            error=f"Timed out after {timeout_sec}s",
        )
    except Exception as e:
        return OCRResult(
            engine_id=engine_id,
            engine_name=engine_id,
            engine_version="",
            status=EngineStatus.ERROR,
            error=f"{e}\n{traceback.format_exc()[-500:]}",
        )


def prepare_images(
    input_path: str,
    work_dir: Path,
    preprocess: bool = False,
    preprocess_steps: Optional[List[str]] = None,
) -> List[str]:
    """Return list of image paths ready for OCR."""
    work_dir.mkdir(parents=True, exist_ok=True)
    if is_pdf(input_path):
        pages_dir = work_dir / "pages"
        pages_dir.mkdir(exist_ok=True)
        images = pdf_to_images(input_path, str(pages_dir), dpi=200, max_pages=MAX_PAGES)
    else:
        images = [input_path]

    if not preprocess:
        return images

    processed = []
    for i, img in enumerate(images):
        out = work_dir / "preprocessed" / f"page_{i+1:03d}.png"
        out.parent.mkdir(parents=True, exist_ok=True)
        apply_pipeline(img, str(out), steps=preprocess_steps)
        processed.append(str(out))
    return processed


def rank_results(results: List[Dict[str, Any]], has_gt: bool) -> Dict[str, List]:
    """Produce accuracy / speed / overall rankings."""
    success = [r for r in results if r.get("status") == "SUCCESS"]

    speed = sorted(success, key=lambda r: r.get("processing_time_ms") or 1e12)
    speed_rank = [
        {"rank": i + 1, "engine_id": r["engine_id"], "name": r["engine_name"], "time_ms": r.get("processing_time_ms")}
        for i, r in enumerate(speed)
    ]

    acc_rank = []
    if has_gt:
        with_acc = [r for r in success if r.get("accuracy") is not None]
        with_acc = sorted(with_acc, key=lambda r: r.get("accuracy") or 0, reverse=True)
        acc_rank = [
            {
                "rank": i + 1,
                "engine_id": r["engine_id"],
                "name": r["engine_name"],
                "accuracy": r.get("accuracy"),
                "cer": r.get("cer"),
                "wer": r.get("wer"),
            }
            for i, r in enumerate(with_acc)
        ]

    # simple overall: prefer accuracy when available, else speed
    if has_gt and acc_rank:
        overall = acc_rank
    else:
        overall = speed_rank

    return {"accuracy": acc_rank, "speed": speed_rank, "overall": overall}


def run_job(
    input_path: str,
    work_dir: Path,
    engine_ids: List[str],
    ground_truth: Optional[str] = None,
    preprocess: bool = False,
    timeout_sec: float = 120.0,
) -> Dict[str, Any]:
    t0 = time.perf_counter()
    image_paths = prepare_images(input_path, work_dir, preprocess=preprocess)

    results: List[OCRResult] = []
    # sequential for stability with heavy models; can parallelize light ones
    for eid in engine_ids:
        results.append(_run_one(eid, image_paths, timeout_sec=timeout_sec))

    has_gt = bool(ground_truth and ground_truth.strip())
    out_list = []
    for r in results:
        if has_gt and r.status == EngineStatus.SUCCESS:
            c, w, acc = compute_metrics(r.text, ground_truth)
            r.cer = c
            r.wer = w
            r.accuracy = acc
        out_list.append(r.to_dict())

    rankings = rank_results(out_list, has_gt)
    total_ms = (time.perf_counter() - t0) * 1000

    return {
        "images": image_paths,
        "results": out_list,
        "rankings": rankings,
        "ground_truth_provided": has_gt,
        "preprocess": preprocess,
        "total_time_ms": total_ms,
        "page_count": len(image_paths),
    }
