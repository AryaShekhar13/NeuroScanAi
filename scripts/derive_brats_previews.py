"""Derive web-safe MRI sprite previews from NIfTI-1 float volumes.

Raw source NIfTI files remain outside the web project and are never copied to static assets.
"""
from __future__ import annotations

import gzip
import json
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image

INPUTS = {
    "flair": "BRATS_001_FLAIR.nii.gz",
    "t1": "BRATS_001_T1.nii.gz",
    "t1ce": "BRATS_001_T1ce.nii.gz",
    "t2": "BRATS_001_T2.nii.gz",
}


def read_volume(path: Path) -> tuple[np.ndarray, tuple[int, int, int]]:
    with gzip.open(path, "rb") as archive:
        raw = archive.read()
    if len(raw) < 352 or struct.unpack_from("<i", raw, 0)[0] != 348 or raw[344:347] != b"n+1":
        raise ValueError(f"{path.name} is not a supported little-endian NIfTI-1 single-file volume")
    x, y, z = struct.unpack_from("<hhh", raw, 42)
    datatype, bitpix = struct.unpack_from("<hh", raw, 70)
    offset = int(struct.unpack_from("<f", raw, 108)[0])
    if datatype != 16 or bitpix != 32 or min(x, y, z) <= 0:
        raise ValueError(f"{path.name} does not contain a supported float32 3D volume")
    values = np.frombuffer(raw, dtype="<f4", count=x * y * z, offset=offset)
    if values.size != x * y * z:
        raise ValueError(f"{path.name} volume bytes are incomplete")
    return values.reshape((z, y, x)), (x, y, z)


def normalise(values: np.ndarray) -> np.ndarray:
    foreground = values[np.isfinite(values) & (values != 0)]
    if foreground.size == 0:
        return np.zeros(values.shape, dtype=np.uint8)
    low, high = np.percentile(foreground, [0.5, 99.5])
    if not np.isfinite(low) or not np.isfinite(high) or high <= low:
        low, high = float(foreground.min()), float(foreground.max())
    scaled = np.clip((values - low) / max(high - low, 1e-6), 0, 1)
    return np.asarray(np.power(scaled, 0.8) * 255, dtype=np.uint8)


def write_sprite(modality: str, volume: np.ndarray, output: Path) -> dict[str, object]:
    depth, height, width = volume.shape
    columns = 5
    rows = (depth + columns - 1) // columns
    canvas = Image.new("L", (width * columns, height * rows), 0)
    normalized = normalise(volume)
    for index in range(depth):
        image = Image.fromarray(normalized[index], mode="L")
        canvas.paste(image, ((index % columns) * width, (index // columns) * height))
    target = output / f"brats-001-{modality}-axial-sprite.webp"
    canvas.save(target, "WEBP", quality=88, method=6)
    return {"modality": modality, "file": target.name, "totalSlices": depth, "columns": columns, "rows": rows, "tileWidth": width, "tileHeight": height, "representativeSlice": depth // 2}


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: derive_brats_previews.py <source-directory> <output-directory>")
    source, output = Path(sys.argv[1]), Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)
    entries = []
    source_dimensions = None
    for modality, file_name in INPUTS.items():
        volume, dimensions = read_volume(source / file_name)
        if source_dimensions is None:
            source_dimensions = dimensions
        elif dimensions != source_dimensions:
            raise ValueError("All modalities must share dimensions for synchronized reference previews")
        entries.append(write_sprite(modality, volume, output))
    manifest = {"studyLabel": "BraTS 001 reference MRI", "sourceDimensions": source_dimensions, "orientation": "axial", "volumes": entries}
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest))


if __name__ == "__main__":
    main()
