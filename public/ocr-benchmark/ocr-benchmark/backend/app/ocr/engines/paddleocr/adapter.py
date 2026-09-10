"""PaddleOCR adapter — real when installed; otherwise reports status clearly."""
from __future__ import annotations

import time
from typing import Any, Dict, List

from ...base import BaseOCREngine, EngineStatus, OCRResult


class PaddleOCREngine(BaseOCREngine):
    id = "paddleocr"
    name = "PaddleOCR"
    version = "2.x / 3.x"
    category = "deep-learning"
    technology = "PP-OCR"
    license = "Apache-2.0"
    languages = ["en", "ch", "hi", "100+"]
    supports_hindi = True
    supports_english = True
    supports_pdf = True
    supports_image = True
    supports_table = True
    supports_handwriting = True
    supports_layout = True
    requires_gpu = False  # optional
    requires_cpu = True

    def health_check(self) -> Dict[str, Any]:
        try:
            from paddleocr import PaddleOCR  # noqa: F401
            return {
                "status": EngineStatus.READY,
                "reason": "paddleocr package found",
            }
        except ImportError:
            return {
                "status": EngineStatus.INSTALLATION_REQUIRED,
                "reason": "pip install paddlepaddle paddleocr  (large download; prefer CPU wheel first)",
            }

    def initialize(self) -> None:
        from paddleocr import PaddleOCR
        # use_angle_cls for rotated text; lang=en for English focus
        self._ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        self._initialized = True

    def process(self, image_paths: List[str], **kwargs) -> OCRResult:
        start = time.perf_counter()
        hc = self.health_check()
        if hc["status"] != EngineStatus.READY:
            return OCRResult(
                engine_id=self.id,
                engine_name=self.name,
                engine_version="",
                status=EngineStatus(hc["status"]),
                error=hc.get("reason"),
            )
        try:
            self.ensure_initialized()
            texts = []
            confs = []
            for path in image_paths:
                result = self._ocr.ocr(path, cls=True)
                page_lines = []
                page_confs = []
                if result and result[0]:
                    for line in result[0]:
                        if line and len(line) >= 2:
                            txt = line[1][0]
                            conf = float(line[1][1])
                            page_lines.append(txt)
                            page_confs.append(conf)
                texts.append("\n".join(page_lines))
                if page_confs:
                    confs.append(sum(page_confs) / len(page_confs))
            total = "\n\n".join(texts).strip()
            avg = sum(confs) / len(confs) if confs else None
            return OCRResult(
                engine_id=self.id,
                engine_name=self.name,
                engine_version=self.version,
                status=EngineStatus.SUCCESS,
                text=total,
                confidence=avg,
                language="en",
                processing_time_ms=(time.perf_counter() - start) * 1000,
                init_time_ms=getattr(self, "_last_init_ms", 0),
            )
        except Exception as e:
            return OCRResult(
                engine_id=self.id,
                engine_name=self.name,
                engine_version="",
                status=EngineStatus.ERROR,
                error=str(e),
                processing_time_ms=(time.perf_counter() - start) * 1000,
            )
