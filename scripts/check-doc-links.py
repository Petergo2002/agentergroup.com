#!/usr/bin/env python3
"""Validate relative links and heading anchors across docs/.

Run from the repository root:

    python3 scripts/check-doc-links.py

Exits non-zero if any link points at a missing file or a heading that does not
exist, so it can be wired into CI. A trailing ``:123`` line reference is
stripped before resolution — those are pointers into source, not paths.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"

LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")
HEADING_RE = re.compile(r"^#{1,6}\s+(.*)")
LINE_SUFFIX_RE = re.compile(r":\d+$")


def slugify(heading: str) -> str:
    """Approximate GitHub's heading-to-anchor rule."""
    text = re.sub(r"`|\*|_", "", heading.strip().lower())
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"\s+", "-", text).strip("-")


_anchor_cache: dict[pathlib.Path, set[str]] = {}


def anchors_of(path: pathlib.Path) -> set[str]:
    if path not in _anchor_cache:
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            _anchor_cache[path] = set()
        else:
            _anchor_cache[path] = {
                slugify(m.group(1))
                for m in (HEADING_RE.match(line) for line in text.splitlines())
                if m
            }
    return _anchor_cache[path]


def main() -> int:
    broken: list[str] = []
    absolute: list[str] = []
    checked = 0

    files = sorted(DOCS.rglob("*.md"))
    for md in files:
        rel = md.relative_to(ROOT)
        for label, raw_target in LINK_RE.findall(md.read_text(encoding="utf-8")):
            target = raw_target.strip()
            if target.startswith(("http://", "https://", "mailto:")):
                continue

            checked += 1

            if target.startswith("#"):
                if slugify(target[1:]) not in anchors_of(md):
                    broken.append(f"{rel}: no such heading '{target}' (link text: {label})")
                continue

            path_part, _, anchor = target.partition("#")
            path_part = LINE_SUFFIX_RE.sub("", path_part)

            if path_part.startswith("/"):
                absolute.append(f"{rel}: absolute machine path -> {target}")
                continue

            resolved = (md.parent / path_part).resolve()
            if not resolved.exists():
                broken.append(f"{rel}: missing file -> {target} (link text: {label})")
            elif anchor and resolved.suffix == ".md":
                if slugify(anchor) not in anchors_of(resolved):
                    broken.append(f"{rel}: missing anchor -> {target} (link text: {label})")

    print(f"Checked {checked} links across {len(files)} files in docs/.")

    if absolute:
        print(f"\n{len(absolute)} absolute machine-local path(s) — portable only on one machine:")
        for item in absolute:
            print(f"  - {item}")

    if broken:
        print(f"\n{len(broken)} BROKEN link(s):")
        for item in broken:
            print(f"  - {item}")
        return 1

    print("\nAll links resolve.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
