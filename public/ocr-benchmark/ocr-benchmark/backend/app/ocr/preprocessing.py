"""Optional image preprocessing pipeline."""
from __future__ import annotations

from pathlib import Path
from typing import List, Optional
import cv2
import numpy as np


def load_image(path: str) -> np.ndarray:
    img = cv2.imread(path)
    if img is None:
        raise ValueError(f"Cannot read image: {path}")
    return img


def to_grayscale(img: np.ndarray) -> np.ndarray:
    if len(img.shape) == 2:
        return img
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def enhance_contrast(img: np.ndarray) -> np.ndarray:
    if len(img.shape) == 3:
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(img)


def denoise(img: np.ndarray) -> np.ndarray:
    if len(img.shape) == 3:
        return cv2.fastNlMeansDenoisingColored(img, None, 10, 10, 7, 21)
    return cv2.fastNlMeansDenoising(img, None, 10, 7, 21)


def sharpen(img: np.ndarray) -> np.ndarray:
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    return cv2.filter2D(img, -1, kernel)


def adaptive_threshold(img: np.ndarray) -> np.ndarray:
    gray = to_grayscale(img)
    return cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )


def deskew(img: np.ndarray) -> np.ndarray:
    gray = to_grayscale(img)
    gray = cv2.bitwise_not(gray)
    coords = np.column_stack(np.where(gray > 0))
    if coords.size == 0:
        return img
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
    if abs(angle) < 0.5:
        return img
    (h, w) = img.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(
        img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    )


def resize_if_large(img: np.ndarray, max_side: int = 2500) -> np.ndarray:
    h, w = img.shape[:2]
    longest = max(h, w)
    if longest <= max_side:
        return img
    scale = max_side / float(longest)
    return cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)


def apply_pipeline(
    image_path: str,
    out_path: str,
    steps: Optional[List[str]] = None,
) -> str:
    """
    Apply selected preprocessing steps and write result.
    steps examples: ["grayscale", "contrast", "denoise", "sharpen", "deskew", "threshold"]
    """
    if steps is None:
        steps = ["resize", "grayscale", "contrast", "denoise"]
    img = load_image(image_path)
    for step in steps:
        step = step.lower().strip()
        if step == "resize":
            img = resize_if_large(img)
        elif step == "grayscale":
            img = to_grayscale(img)
            if len(img.shape) == 2:
                img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        elif step in ("contrast", "clahe"):
            img = enhance_contrast(img)
        elif step == "denoise":
            img = denoise(img)
        elif step == "sharpen":
            img = sharpen(img)
        elif step in ("threshold", "adaptive_threshold"):
            img = adaptive_threshold(img)
            if len(img.shape) == 2:
                img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        elif step == "deskew":
            img = deskew(img)
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(out_path, img)
    return out_path
