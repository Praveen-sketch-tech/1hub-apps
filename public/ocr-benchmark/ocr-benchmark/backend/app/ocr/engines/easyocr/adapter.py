"""EasyOCR adapter. Reports real availability; runs only when installed."""
from __future__ import annotations

import time
from typing import Any, Dict, List

from ...base import BaseOCREngine, EngineStatus, OCRResult

_reader = None


class EasyOCREngine(BaseOCREngine):
    id = "easyocr"
    name = "EasyOCR"
    version = "1.7.x"
    category = "deep-learning"
    technology = "CRNN + CRAFT"
    license = "Apache-2.0"
    languages = ["en", "hi", "80+"]
    supports_hindi = True
    supports_english = True
    supports_pdf = True
    supports_image = True
    supports_table = False
    supports_handwriting = True
    supports_layout = False
    requires_gpu = False
    requires_cpu = True

    def health_check(self) -> Dict[str, Any]:
        try:
            import easyocr  # noqa: F401
            return {
                "status": EngineStatus.READY,
                "reason": "easyocr package found (models download on first use)",
            }
        except ImportError:
            return {
                "status": EngineStatus.INSTALLATION_REQUIRED,
                "reason": "pip install easyocr  (downloads ~500MB+ models on first run)",
            }

    def initialize(self) -> None:
        global _reader
        import easyocr
        # English + Hindi if available; keep light for demo
        _reader = easyocr.Reader(["en"], gpu=False, verbose=False)
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
            global _reader
            texts = []
            confs = []
            for path in image_paths:
                results = _reader.readtext(path, detail=1, paragraph=False)
                page_texts = []
                page_confs = []
                for bbox, text, conf in results:
                    page_texts.append(text)
                    page_confs.append(float(conf))
                texts.append("\n".join(page_texts))
                if page_confs:
                    confs.append(sum(page_confs) / len(page_confs))
            total = "\n\n".join(texts).strip()
            avg_conf = sum(confs) / len(confs) if confs else None
            return OCRResult(
                engine_id=self.id,
                engine_name=self.name,
                engine_version="1.7.x",
                status=EngineStatus.SUCCESS,
                text=total,
                confidence=avg_conf,
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
