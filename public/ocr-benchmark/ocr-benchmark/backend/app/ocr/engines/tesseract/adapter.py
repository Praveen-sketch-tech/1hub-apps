"""Tesseract OCR adapter — real execution via pytesseract."""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from PIL import Image

from ...base import BaseOCREngine, EngineStatus, OCRResult

try:
    import pytesseract
except ImportError:
    pytesseract = None


class TesseractEngine(BaseOCREngine):
    id = "tesseract"
    name = "Tesseract"
    version = "5.x"
    category = "classical"
    technology = "LSTM"
    license = "Apache-2.0"
    languages = ["eng", "hin", "many via tessdata"]
    supports_hindi = True  # if hin.traineddata installed
    supports_english = True
    supports_pdf = True
    supports_image = True
    supports_table = False
    supports_handwriting = False
    supports_layout = False
    requires_gpu = False
    requires_cpu = True

    def health_check(self) -> Dict[str, Any]:
        if pytesseract is None:
            return {
                "status": EngineStatus.INSTALLATION_REQUIRED,
                "reason": "pytesseract package not installed",
            }
        try:
            v = str(pytesseract.get_tesseract_version())
            langs = []
            try:
                langs = pytesseract.get_languages(config="")
            except Exception:
                pass
            return {
                "status": EngineStatus.READY,
                "reason": f"Tesseract {v} available",
                "version": v,
                "languages": langs,
            }
        except Exception as e:
            return {
                "status": EngineStatus.INSTALLATION_REQUIRED,
                "reason": f"Tesseract binary missing or broken: {e}",
            }

    def initialize(self) -> None:
        if pytesseract is None:
            raise RuntimeError("pytesseract not installed")
        # force a version call to confirm binary
        _ = pytesseract.get_tesseract_version()
        self._initialized = True

    def process(
        self,
        image_paths: List[str],
        lang: str = "eng",
        psm: int = 3,
        **kwargs,
    ) -> OCRResult:
        start = time.perf_counter()
        init_ms = getattr(self, "_last_init_ms", 0.0)

        if pytesseract is None:
            return OCRResult(
                engine_id=self.id,
                engine_name=self.name,
                engine_version="",
                status=EngineStatus.INSTALLATION_REQUIRED,
                error="pytesseract not installed",
                processing_time_ms=0,
            )

        try:
            self.ensure_initialized()
        except Exception as e:
            return OCRResult(
                engine_id=self.id,
                engine_name=self.name,
                engine_version="",
                status=EngineStatus.ERROR,
                error=str(e),
                processing_time_ms=(time.perf_counter() - start) * 1000,
            )

        texts: List[str] = []
        confidences: List[float] = []
        pages: List[Dict] = []
        config = f"--psm {psm}"

        try:
            version = str(pytesseract.get_tesseract_version())
            for idx, path in enumerate(image_paths):
                page_start = time.perf_counter()
                img = Image.open(path)
                # full string
                text = pytesseract.image_to_string(img, lang=lang, config=config)
                texts.append(text)
                # confidence from data
                try:
                    data = pytesseract.image_to_data(
                        img, lang=lang, config=config, output_type=pytesseract.Output.DICT
                    )
                    word_confs = [
                        int(c)
                        for c, t in zip(data["conf"], data["text"])
                        if str(t).strip() and int(c) >= 0
                    ]
                    page_conf = (
                        sum(word_confs) / len(word_confs) / 100.0 if word_confs else None
                    )
                    if page_conf is not None:
                        confidences.append(page_conf)
                except Exception:
                    page_conf = None

                pages.append(
                    {
                        "page": idx + 1,
                        "text": text,
                        "confidence": page_conf,
                        "time_ms": (time.perf_counter() - page_start) * 1000,
                    }
                )

            total_text = "\n\n".join(t.strip() for t in texts if t).strip()
            avg_conf = sum(confidences) / len(confidences) if confidences else None
            elapsed = (time.perf_counter() - start) * 1000

            return OCRResult(
                engine_id=self.id,
                engine_name=self.name,
                engine_version=version,
                status=EngineStatus.SUCCESS,
                text=total_text,
                confidence=avg_conf,
                language=lang,
                processing_time_ms=elapsed,
                init_time_ms=init_ms,
                pages=pages,
                metadata={"psm": psm, "lang": lang},
            )
        except Exception as e:
            return OCRResult(
                engine_id=self.id,
                engine_name=self.name,
                engine_version="",
                status=EngineStatus.ERROR,
                error=str(e),
                processing_time_ms=(time.perf_counter() - start) * 1000,
                init_time_ms=init_ms,
            )
