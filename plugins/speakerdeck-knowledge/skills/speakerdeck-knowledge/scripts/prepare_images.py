"""Prepare bounded local slide previews; print paths, never image data.

Requires Pillow. Originals are preserved. Preparing an image does not mean it
has been visually reviewed. Exit codes: 0 success, 1 input/image/output error.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

from fetch_deck import selection


def crop_box(value):
    try:
        box = tuple(float(part) for part in value.split(","))
        if len(box) != 4 or not (0 <= box[0] < box[2] <= 1
                                 and 0 <= box[1] < box[3] <= 1):
            raise ValueError
        return box
    except ValueError:
        raise argparse.ArgumentTypeError("--crop expects left,top,right,bottom in 0..1")


def selected_sources(deck_file, pages):
    deck = json.loads(deck_file.read_text(encoding="utf-8"))
    chosen = selection(pages, deck["page_count"], "--pages")
    if not chosen or pages == "all":
        raise ValueError("--pages requires explicit page numbers or ranges, not all")
    indexed = {page["page"]: page for page in deck["pages"]}
    sources = []
    root = deck_file.parent.resolve()
    for number in sorted(chosen):
        page = indexed.get(number, {})
        filename = page.get("image_file", "")
        path = (root / filename).resolve()
        if (page.get("image_status") != "downloaded" or path.parent != root
                or not filename or not path.is_file()):
            raise ValueError(f"Page {number}: acquire its image with fetch_deck.py --images first")
        sources.append((number, path))
    return sources


def open_image(path, crop, edge):
    from PIL import Image, ImageOps

    with Image.open(path) as original:
        image = ImageOps.exif_transpose(original)
        if crop:
            width, height = image.size
            box = tuple(round(value * (width if i % 2 == 0 else height))
                        for i, value in enumerate(crop))
            if box[0] >= box[2] or box[1] >= box[3]:
                raise ValueError("--crop is smaller than one source pixel")
            image = image.crop(box)
        image.thumbnail((edge, edge), Image.Resampling.LANCZOS)
        # Flatten transparent slides onto white so labels and diagrams stay legible.
        rgba = image.convert("RGBA")
        result = Image.new("RGB", image.size, "white")
        result.paste(rgba, mask=rgba.getchannel("A"))
        return result


def make_sheet(sources, edge):
    from PIL import Image, ImageDraw

    columns = min(2, len(sources))
    rows = (len(sources) + columns - 1) // columns
    cell = edge // max(columns, rows)
    label_height, padding = 24, 8
    images = [open_image(path, None, cell - 2 * padding - label_height)
              for _, path in sources]
    cell_height = max(image.height for image in images) + label_height + padding
    sheet = Image.new("RGB", (columns * cell, rows * cell_height), "white")
    draw = ImageDraw.Draw(sheet)
    for index, ((number, _), image) in enumerate(zip(sources, images)):
        x, y = (index % columns) * cell, (index // columns) * cell_height
        sheet.paste(image, (x + (cell - image.width) // 2, y + label_height))
        draw.text((x + padding, y + 5), f"Page {number}", fill="black")
        image.close()
    return sheet


def prepare(sources, output, mode, crop, edge):
    from PIL import Image

    output.mkdir(parents=True, exist_ok=True)
    batch_size = 6 if mode == "sheet" else 1
    results = []
    for offset in range(0, len(sources), batch_size):
        group = sources[offset:offset + batch_size]
        numbers = [number for number, _ in group]
        digest = hashlib.sha256(json.dumps([1, mode, crop, edge, numbers]).encode())
        for _, path in group:
            digest.update(hashlib.sha256(path.read_bytes()).digest())
        name = f"{mode}-{'-'.join(str(n) for n in numbers)}-{digest.hexdigest()[:16]}.jpg"
        target = output / name
        if not target.exists():
            image = (make_sheet(group, edge) if mode == "sheet"
                     else open_image(group[0][1], crop, edge))
            image.save(target, quality=90)
            image.close()
        with Image.open(target) as image:
            results.append({"path": str(target.resolve()), "pages": numbers,
                            "width": image.width, "height": image.height})
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--deck", required=True, type=Path, help="Local deck.json")
    parser.add_argument("--pages", required=True, help="Explicit pages, e.g. 5-12,19")
    parser.add_argument("--mode", choices=("preview", "sheet"), default="preview")
    parser.add_argument("--crop", type=crop_box, help="Normalized left,top,right,bottom; one page only")
    parser.add_argument("--max-edge", type=int, default=1280, help="Longest output edge: 256..2048 pixels")
    args = parser.parse_args()
    try:
        if not 256 <= args.max_edge <= 2048:
            raise ValueError("--max-edge must be between 256 and 2048")
        sources = selected_sources(args.deck, args.pages)
        if args.crop and (args.mode != "preview" or len(sources) != 1):
            raise ValueError("--crop requires one page in preview mode")
        results = prepare(sources, args.deck.parent / "reading-images",
                          args.mode, args.crop, args.max_edge)
        print(json.dumps({"images": results}, ensure_ascii=False))
        return 0
    except ImportError:
        print("Error: Pillow is required; run in a Python environment with Pillow installed.", file=sys.stderr)
        return 1
    except (ValueError, OSError, KeyError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
