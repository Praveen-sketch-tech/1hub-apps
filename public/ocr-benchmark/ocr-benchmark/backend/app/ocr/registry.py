"""Central OCR engine registry. Frontend reads this."""
from __future__ import annotations

from typing import Dict, Type, List, Any

from .base import BaseOCREngine, EngineStatus
from .engines.tesseract.adapter import TesseractEngine
from .engines.easyocr.adapter import EasyOCREngine
from .engines.rapidocr.adapter import RapidOCREngine
from .engines.paddleocr.adapter import PaddleOCREngine
from .engines.doctr.adapter import DocTREngine

ENGINE_CLASSES: Dict[str, Type[BaseOCREngine]] = {
    "tesseract": TesseractEngine,
    "easyocr": EasyOCREngine,
    "rapidocr": RapidOCREngine,
    "paddleocr": PaddleOCREngine,
    "doctr": DocTREngine,
}

# Cache instances lightly
_instances: Dict[str, BaseOCREngine] = {}


def get_engine(engine_id: str) -> BaseOCREngine:
    if engine_id not in ENGINE_CLASSES:
        raise KeyError(f"Unknown engine: {engine_id}")
    if engine_id not in _instances:
        _instances[engine_id] = ENGINE_CLASSES[engine_id]()
    return _instances[engine_id]


def get_registry() -> Dict[str, Any]:
    """Full registry consumed by frontend."""
    registry: Dict[str, Any] = {}
    for eid, cls in ENGINE_CLASSES.items():
        eng = get_engine(eid)
        hc = eng.health_check()
        status = hc.get("status")
        if isinstance(status, EngineStatus):
            status_val = status.value
        else:
            status_val = str(status)
        registry[eid] = {
            "id": eng.id,
            "name": eng.name,
            "version": eng.version,
            "category": eng.category,
            "technology": eng.technology,
            "license": eng.license,
            "languages": eng.languages,
            "hindi_support": eng.supports_hindi,
            "english_support": eng.supports_english,
            "pdf_support": eng.supports_pdf,
            "image_support": eng.supports_image,
            "table_support": eng.supports_table,
            "handwriting_support": eng.supports_handwriting,
            "layout_support": eng.supports_layout,
            "gpu_requirement": eng.requires_gpu,
            "cpu_support": eng.requires_cpu,
            "status": status_val,
            "status_reason": hc.get("reason", ""),
            "adapter": f"ocr.engines.{eid}.adapter",
        }
    return registry


def list_engine_ids() -> List[str]:
    return list(ENGINE_CLASSES.keys())


PRESETS = {
    "quick": ["tesseract", "rapidocr"],
    "full": list(ENGINE_CLASSES.keys()),
    "hindi": ["tesseract", "easyocr", "paddleocr"],
    "speed": ["tesseract", "rapidocr"],
    "accuracy": list(ENGINE_CLASSES.keys()),
    "document": ["tesseract", "paddleocr", "doctr"],
    "table": ["paddleocr", "doctr"],
    "handwriting": ["easyocr", "paddleocr"],
}
