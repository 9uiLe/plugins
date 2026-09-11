#!/usr/bin/env python3
"""Collect page-ordered SpeakerDeck text and images for knowledge extraction.

The --out directory holds source.html, deck.json, transcript.md and requested
images as reading evidence. The calling skill chooses the separate directory
for knowledge.md and guide.html, interprets the evidence and writes those files.
Exit codes: 0 complete, 1 input/source error, 2 partial image acquisition.
"""
import argparse
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


def deck_url(value):
    u = urlsplit(value)
    if (u.scheme != "https" or u.netloc != "speakerdeck.com"
            or not re.fullmatch(r"/[^/]+/[^/]+/?", u.path)):
        raise ValueError("Expected https://speakerdeck.com/author/deck")
    query = urlencode([(k, v) for k, v in parse_qsl(u.query) if k != "slide"])
    return urlunsplit((u.scheme, u.netloc, u.path.rstrip("/"), query, ""))


def page_url(url, page):
    u = urlsplit(url)
    query = urlencode([(k, v) for k, v in parse_qsl(u.query) if k != "slide"]
                      + [("slide", page)])
    return urlunsplit((u.scheme, u.netloc, u.path, query, ""))


class DeckParser(HTMLParser):
    """Read metadata and transcript blocks belonging to the selected deck."""

    def __init__(self):
        super().__init__()
        self.meta, self.blocks, self.slides = {}, [], []
        self.script = None
        self.depth = 0
        self.current = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "meta":
            self.meta[a.get("property", a.get("name", ""))] = a.get("content", "")
        if tag == "script" and a.get("type") == "application/ld+json":
            self.script = []
        if tag == "div":
            if self.current is not None:
                self.depth += 1
            elif "slide-transcript" in a.get("class", "").split():
                self.depth = 1
                self.current = {"chunks": [], "image_url": None, "placeholder_link": False}
        if tag == "a" and self.current is not None:
            href = a.get("href", "")
            if urlsplit(href).netloc == "files.speakerdeck.com":
                self.current["image_url"] = href
                if {"text-muted", "font-italic"} <= set(a.get("class", "").split()):
                    self.current["placeholder_link"] = True

    def handle_data(self, data):
        if self.script is not None:
            self.script.append(data)
        if self.current is not None:
            self.current["chunks"].append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.script is not None:
            try:
                self.blocks.append(json.loads("".join(self.script)))
            except json.JSONDecodeError:
                pass
            self.script = None
        if tag == "div" and self.current is not None:
            self.depth -= 1
            if self.depth == 0:
                self.finish_transcript()

    def finish_transcript(self):
        """Keep image-only pages; only the site's missing-text link is a sentinel."""
        text = " ".join(" ".join(self.current["chunks"]).split())
        if self.current["placeholder_link"] and text == "None":
            text = ""
        self.slides.append({"text": text, "image_url": self.current["image_url"]})
        self.current = None


def objects(value):
    if isinstance(value, list):
        for item in value:
            yield from objects(item)
    elif isinstance(value, dict):
        yield value
        yield from objects(value.get("@graph", []))


def index_structured_pages(parts):
    """Validate one-based structured page positions before joining image links."""
    indexed = {}
    for item in parts:
        position = item.get("position")
        if isinstance(position, int) and not isinstance(position, bool) and position > 0:
            if position in indexed:
                raise ValueError("Duplicate page positions in source")
            indexed[position] = item.get("text", "")
    if indexed and sorted(indexed) != list(range(1, max(indexed) + 1)):
        raise ValueError("Source page positions are incomplete")
    return indexed


def parse_deck(html, url):
    """Join source metadata, page text and image links without interpreting slides."""
    parser = DeckParser()
    parser.feed(html)
    canonical = parser.meta.get("og:url")
    if canonical and deck_url(canonical) != deck_url(url):
        raise ValueError("Saved HTML belongs to a different deck")

    metadata = next((item for item in objects(parser.blocks) if "hasPart" in item), {})
    indexed = index_structured_pages(metadata.get("hasPart", []))
    if indexed and parser.slides and len(indexed) != len(parser.slides):
        raise ValueError("Transcript and structured page counts disagree")
    count = len(indexed) or len(parser.slides)
    if not count:
        raise ValueError("No slide evidence found; use public images/PDF or request source files")
    pages = []
    for number in range(1, count + 1):
        transcript = parser.slides[number - 1] if parser.slides else {}
        pages.append({
            "page": number,
            "url": page_url(url, number),
            "text": indexed.get(number, transcript.get("text", "")).strip(),
            "image_url": transcript.get("image_url"),
            "image_status": "not_requested",
        })
    author = metadata.get("author") or parser.meta.get("og:author", "")
    return {
        "url": url,
        "title": metadata.get("name") or parser.meta.get("og:title", ""),
        "author": author.get("name", "") if isinstance(author, dict) else author,
        "published": metadata.get("datePublished", ""),
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "page_count": count,
        "count_basis": "hasPart" if indexed else "transcript_blocks",
        "pdf_url": metadata.get("associatedMedia", {}).get("contentUrl"),
        "pages": pages,
    }


def selection(spec, count, option="--images"):
    if spec == "all":
        return set(range(1, count + 1))
    if not spec:
        return set()
    result = set()
    for part in spec.split(","):
        if not re.fullmatch(r"\d+(?:-\d+)?", part):
            raise ValueError(f"{option} expects page ranges such as 5-12,19")
        bounds = [int(x) for x in part.split("-")]
        lo, hi = bounds[0], bounds[-1]
        if not 1 <= lo <= hi <= count:
            raise ValueError("Image page range is outside the deck")
        result.update(range(lo, hi + 1))
    return result


def fetch(url):
    u = urlsplit(url)
    if u.scheme != "https" or u.netloc not in {"speakerdeck.com", "files.speakerdeck.com"}:
        raise ValueError("Unsupported source host")
    # Do not follow redirects to login pages or unrelated hosts; surface them instead.
    result = subprocess.run(["curl", "--silent", "--show-error", "--fail", "--max-time", "45",
                             "--proto", "=https", "--user-agent", "Mozilla/5.0",
                             "--write-out", "\n%{http_code}", url], capture_output=True)
    body, _, status = result.stdout.rpartition(b"\n")
    if result.returncode or status != b"200":
        raise ValueError(f"Fetch failed (HTTP {status.decode(errors='replace')}): "
                         + result.stderr.decode(errors="replace")[:300])
    return body


def prepare_evidence_directory(directory, url):
    """Keep evidence from different decks in separate directories."""
    directory.mkdir(parents=True, exist_ok=True)
    metadata = directory / "deck.json"
    if metadata.exists():
        previous = json.loads(metadata.read_text(encoding="utf-8"))
        if previous.get("url") != url:
            raise ValueError("Output directory contains a different deck; choose a new directory")
        return previous
    return {}

def reuse_images(pages, previous, directory):
    """Preserve matching acquisition state across text-first, incremental reads."""
    indexed = {page["page"]: page for page in previous.get("pages", [])}
    for page in pages:
        old = indexed.get(page["page"], {})
        if not page["image_url"] or old.get("image_url") != page["image_url"]:
            continue
        filename = old.get("image_file", "")
        if (old.get("image_status") == "downloaded"
                and re.fullmatch(rf"slide-{page['page']:03d}\.(jpg|png)", filename)
                and (directory / filename).is_file()
                and (directory / filename).stat().st_size > 0):
            page.update(image_status="downloaded", image_file=filename)
        elif old.get("image_status") == "failed":
            page.update(image_status="failed", image_error=old.get("image_error", ""))


def download_images(pages, chosen, directory):
    """Record each requested image's result while retaining successful pages."""
    failed = []
    for page in pages:
        if page["page"] not in chosen:
            continue
        if page["image_status"] == "downloaded":
            continue
        try:
            if not page["image_url"]:
                raise ValueError("No image URL in source")
            data = fetch(page["image_url"])
            if data.startswith(b"\xff\xd8\xff"):
                suffix = "jpg"
            elif data.startswith(b"\x89PNG\r\n\x1a\n"):
                suffix = "png"
            else:
                raise ValueError("Response is not a JPEG/PNG image")
            filename = f"slide-{page['page']:03d}.{suffix}"
            (directory / filename).write_bytes(data)
            page.update(image_status="downloaded", image_file=filename)
            page.pop("image_error", None)
        except (ValueError, OSError) as exc:
            page.update(image_status="failed", image_error=str(exc))
            failed.append(page["page"])
    return failed


def write_evidence(deck, directory):
    """Save acquisition state and a page-by-page reading document in UTF-8."""
    (directory / "deck.json").write_text(
        json.dumps(deck, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    transcript = [
        f"# {deck['title']}",
        f"Source: {deck['url']}",
        "Raw extraction for reading; downloaded does not mean visually reviewed.",
    ]
    for page in deck["pages"]:
        transcript.extend([f"\n## Page {page['page']}", page["url"], page["text"] or "[No text]"])
    (directory / "transcript.md").write_text("\n\n".join(transcript) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="Public https://speakerdeck.com/author/deck URL")
    parser.add_argument("--out", required=True, type=Path,
                        help="Temporary evidence directory; separate from final knowledge output")
    parser.add_argument("--html-file", type=Path, help="Parse HTML saved from the same deck")
    parser.add_argument("--images", default="", help="all or page ranges such as 5-12,19")
    args = parser.parse_args()
    try:
        url = deck_url(args.url)
        raw = args.html_file.read_bytes() if args.html_file else fetch(url)
        deck = parse_deck(raw.decode("utf-8"), url)
        chosen = selection(args.images, deck["page_count"])
        previous = prepare_evidence_directory(args.out, url)
        reuse_images(deck["pages"], previous, args.out)
        (args.out / "source.html").write_bytes(raw)
        failed = download_images(deck["pages"], chosen, args.out)
        write_evidence(deck, args.out)
        print(json.dumps({"pages": deck["page_count"], "images_requested": len(chosen),
                          "images_failed": failed, "out": str(args.out)}, ensure_ascii=False))
        return 2 if failed else 0
    except (ValueError, OSError, UnicodeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
