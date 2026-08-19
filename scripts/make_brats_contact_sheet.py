from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: make_brats_contact_sheet.py <preview-directory> <output-image>")
    directory, target = Path(sys.argv[1]), Path(sys.argv[2])
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    entries = sorted(manifest["volumes"], key=lambda entry: ["t1", "t1ce", "t2", "flair"].index(entry["modality"]))
    card_size, padding, label_height = 240, 20, 38
    sheet = Image.new("RGB", (card_size * 2 + padding * 3, (card_size + label_height) * 2 + padding * 3), "black")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, entry in enumerate(entries):
        sprite = Image.open(directory / entry["file"]).convert("L")
        slice_index = entry["representativeSlice"]
        column = slice_index % entry["columns"]
        row = slice_index // entry["columns"]
        tile = sprite.crop((column * entry["tileWidth"], row * entry["tileHeight"], (column + 1) * entry["tileWidth"], (row + 1) * entry["tileHeight"])).convert("RGB")
        x = padding + (index % 2) * (card_size + padding)
        y = padding + (index // 2) * (card_size + label_height + padding)
        sheet.paste(tile, (x, y))
        draw.text((x, y + card_size + 12), f"{entry['modality'].upper()} · axial slice {slice_index + 1}/{entry['totalSlices']}", fill=(255, 184, 41), font=font)
    sheet.save(target, "WEBP", quality=92, method=6)


if __name__ == "__main__":
    main()
