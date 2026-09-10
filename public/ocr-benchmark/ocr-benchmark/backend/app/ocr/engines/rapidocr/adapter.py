"""RapidOCR (ONNX) adapter — lightweight modern alternative."""
from __future__ import annotations

import time
from typing import Any, Dict, List

from ...base import BaseOCREngine, EngineStatus, OCRResult


class RapidOCREngine(BaseOCREngine):
    id = "rapidocr"
    name = "RapidOCR"
    version = "1.x / 2.x"
    category = "deep-learning"
    technology = "ONNX (PaddleOCR models)"
    license = "Apache-2.0"
    languages = ["ch", "en", "multi"]
    supports_hindi = False
    supports_english = True
    supports_pdf = True
    supports_image = True
    supports_table = False
    supports_handwriting = False
    supports_layout = False
    requires_gpu = False
    requires_cpu = True

    def health_check(self) -> Dict[str, Any]:
        try:
            from rapidocr_onnxruntime import RapidOCR  # noqa: F401
            return {
                "status": EngineStatus.READY,
                "reason": "rapidocr-onnxruntime available",
            }
        except ImportError:
            try:
                from rapidocr import RapidOCR  # noqa: F401
                return {
                    "status": EngineStatus.READY,
                    "reason": "rapidocr package available",
                }
            except ImportError:
                return {
                    "status": EngineStatus.INSTALLATION_REQUIRED,
                    "reason": "pip install rapidocr-onnxruntime  (or rapidocr)",
                }

    def initialize(self) -> None:
        try:
            from rapidocr_onnxruntime import RapidOCR
            self._engine = RapidOCR()
        except ImportError:
            from rapidocr import RapidOCR
            self._engine = RapidOCR()
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
                result, _ = self._engine(path)
                if result is None:
                    texts.append("")
                    continue
                page_lines = []
                page_confs = []
                for item in result:
                    # item typically [box, text, score]
                    if len(item) >= 3:
                        page_lines.append(str(item[1]))
                        try:
                            page_confs.append(float(item[2]))
                        except Exception:
                            pass
                    elif len(item) >= 2:
                        page_lines.append(str(item[1]))
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
