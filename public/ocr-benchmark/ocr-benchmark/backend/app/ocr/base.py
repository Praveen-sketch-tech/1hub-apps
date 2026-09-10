"""Common OCR engine interface and result types."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, List, Optional
import time


class EngineStatus(str, Enum):
    READY = "READY"
    INSTALLATION_REQUIRED = "INSTALLATION_REQUIRED"
    MODEL_REQUIRED = "MODEL_REQUIRED"
    GPU_REQUIRED = "GPU_REQUIRED"
    NOT_SUPPORTED = "NOT_SUPPORTED"
    FAILED = "FAILED"
    DISABLED = "DISABLED"
    PROCESSING = "PROCESSING"
    SUCCESS = "SUCCESS"
    TIMEOUT = "TIMEOUT"
    ERROR = "ERROR"
    NOT_AVAILABLE = "NOT_AVAILABLE"


@dataclass
class OCRResult:
    engine_id: str
    engine_name: str
    engine_version: str
    status: EngineStatus
    text: str = ""
    confidence: Optional[float] = None
    language: Optional[str] = None
    processing_time_ms: float = 0.0
    init_time_ms: float = 0.0
    pages: List[Dict[str, Any]] = field(default_factory=list)
    raw: Any = None
    error: Optional[str] = None
    boxes: Optional[List] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    cer: Optional[float] = None
    wer: Optional[float] = None
    accuracy: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["status"] = self.status.value if isinstance(self.status, EngineStatus) else str(self.status)
        # raw can be non-serializable
        if d.get("raw") is not None:
            d["raw"] = str(type(d["raw"]))
        return d


class BaseOCREngine(ABC):
    """Every OCR adapter must implement this interface."""

    id: str = "base"
    name: str = "Base"
    version: str = "0.0"
    category: str = "unknown"
    technology: str = "unknown"
    license: str = "unknown"
    languages: List[str] = []
    supports_hindi: bool = False
    supports_english: bool = True
    supports_pdf: bool = True
    supports_image: bool = True
    supports_table: bool = False
    supports_handwriting: bool = False
    supports_layout: bool = False
    requires_gpu: bool = False
    requires_cpu: bool = True

    def __init__(self) -> None:
        self._initialized = False
        self._init_error: Optional[str] = None

    @abstractmethod
    def health_check(self) -> Dict[str, Any]:
        """Return dict with status (EngineStatus) and reason."""
        ...

    @abstractmethod
    def initialize(self) -> None:
        """Lazy-load models. Raise on failure."""
        ...

    @abstractmethod
    def process(self, image_paths: List[str], **kwargs) -> OCRResult:
        """Run OCR on one or more image file paths (pages)."""
        ...

    def normalize_result(self, raw: Any) -> str:
        return str(raw) if raw is not None else ""

    def cleanup(self) -> None:
        """Release resources if possible."""
        pass

    def ensure_initialized(self) -> None:
        if not self._initialized:
            t0 = time.perf_counter()
            try:
                self.initialize()
                self._initialized = True
                self._init_error = None
            except Exception as e:
                self._init_error = str(e)
                raise
            finally:
                self._last_init_ms = (time.perf_counter() - t0) * 1000
