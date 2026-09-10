"""docTR adapter (Mindee)."""
from __future__ import annotations

import time
from typing import Any, Dict, List

from ...base import BaseOCREngine, EngineStatus, OCRResult


class DocTREngine(BaseOCREngine):
    id = "doctr"
    name = "docTR"
    version = "0.8+"
    category = "deep-learning"
    technology = "DBNet + CRNN / Transformer"
    license = "Apache-2.0"
    languages = ["en", "fr", "multi"]
    supports_hindi = False
    supports_english = True
    supports_pdf = True
    supports_image = True
    supports_table = True
    supports_handwriting = False
    supports_layout = True
    requires_gpu = False
    requires_cpu = True

    def health_check(self) -> Dict[str, Any]:
        try:
            import doctr  # noqa: F401
            from doctr.models import ocr_predictor  # noqa: F401
            return {
                "status": EngineStatus.READY,
                "reason": "python-doctr available",
            }
        except ImportError:
            return {
                "status": EngineStatus.INSTALLATION_REQUIRED,
                "reason": "pip install python-doctr[torch]  (or [tf])",
            }

    def initialize(self) -> None:
        from doctr.models import ocr_predictor
        self._predictor = ocr_predictor(pretrained=True)
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
            from doctr.io import DocumentFile

            texts = []
            for path in image_paths:
                doc = DocumentFile.from_images(path)
                result = self._predictor(doc)
                # export plain text
                page_text = result.render()
                texts.append(page_text)
            total = "\n\n".join(texts).strip()
            return OCRResult(
                engine_id=self.id,
                engine_name=self.name,
                engine_version=self.version,
                status=EngineStatus.SUCCESS,
                text=total,
                confidence=None,
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
