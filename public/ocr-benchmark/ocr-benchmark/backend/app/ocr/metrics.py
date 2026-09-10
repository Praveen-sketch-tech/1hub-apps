"""Real CER / WER / accuracy metrics. Never invent numbers."""
from __future__ import annotations

from typing import Optional, Tuple
import re

try:
    import editdistance
except ImportError:
    editdistance = None


def _normalize_text(text: str) -> str:
    """Light normalization for fair comparison."""
    if not text:
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def cer(hypothesis: str, reference: str) -> float:
    """Character Error Rate (0.0 = perfect, 1.0 = total error)."""
    hyp = _normalize_text(hypothesis)
    ref = _normalize_text(reference)
    if not ref:
        return 0.0 if not hyp else 1.0
    if editdistance is None:
        # fallback simple ratio
        if hyp == ref:
            return 0.0
        return 1.0
    dist = editdistance.eval(hyp, ref)
    return dist / max(len(ref), 1)


def wer(hypothesis: str, reference: str) -> float:
    """Word Error Rate."""
    hyp_words = _normalize_text(hypothesis).split()
    ref_words = _normalize_text(reference).split()
    if not ref_words:
        return 0.0 if not hyp_words else 1.0
    if editdistance is None:
        return 0.0 if hyp_words == ref_words else 1.0
    dist = editdistance.eval(hyp_words, ref_words)
    return dist / len(ref_words)


def accuracy_from_cer(cer_value: float) -> float:
    """Character accuracy percentage (0-100)."""
    return max(0.0, (1.0 - cer_value) * 100.0)


def exact_match(hypothesis: str, reference: str) -> bool:
    return _normalize_text(hypothesis) == _normalize_text(reference)


def compute_metrics(
    hypothesis: str, reference: Optional[str]
) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    """
    Returns (cer, wer, accuracy_percent).
    All None when no ground truth is supplied.
    """
    if reference is None or reference.strip() == "":
        return None, None, None
    c = cer(hypothesis, reference)
    w = wer(hypothesis, reference)
    acc = accuracy_from_cer(c)
    return c, w, acc
