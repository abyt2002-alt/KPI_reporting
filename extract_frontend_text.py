from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

from openpyxl import Workbook


ROOT = Path(__file__).resolve().parent
SRC_DIR = ROOT / "src"
OUTPUT_FILE = ROOT / "frontend_visible_text.xlsx"


JSX_TEXT_RE = re.compile(r">([^<>{}\n][^<>{}]*)<")
ATTR_RE = re.compile(
    r"""\b(placeholder|title|aria-label|alt|label)\s*=\s*["']([^"']+)["']""",
    re.IGNORECASE,
)
HTML_TITLE_RE = re.compile(r"<title>([^<]+)</title>", re.IGNORECASE)


def clean_text(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    return value


def looks_visible(text: str) -> bool:
    if len(text) < 2:
        return False
    if not re.search(r"[A-Za-z]", text):
        return False

    blocked_fragments = (
        "http://",
        "https://",
        "import ",
        "export ",
        "className",
        "onClick",
        "useState",
        ".tsx",
        ".ts",
        "localhost",
        "px",
        "rem",
        "rgba",
        "rgb(",
        "hsl(",
        "calc(",
        "translate(",
        "<svg",
        "M ",
    )
    lowered = text.lower()
    if any(fragment.lower() in lowered for fragment in blocked_fragments):
        return False

    if text.startswith(("/", ".", "#")):
        return False

    if "{" in text or "}" in text or "${" in text:
        return False

    if re.fullmatch(r"[A-Za-z0-9_-]+", text) and text.lower() in {
        "true",
        "false",
        "null",
        "undefined",
        "button",
        "div",
        "span",
    }:
        return False

    return True


def file_candidates(path: Path) -> Iterable[tuple[str, str]]:
    content = path.read_text(encoding="utf-8", errors="ignore")
    ext = path.suffix.lower()

    for match in JSX_TEXT_RE.findall(content):
        text = clean_text(match)
        if looks_visible(text):
            yield ("jsx_text", text)

    for attr, value in ATTR_RE.findall(content):
        text = clean_text(value)
        if looks_visible(text):
            yield (f"attr:{attr}", text)

    if ext == ".html":
        for value in HTML_TITLE_RE.findall(content):
            text = clean_text(value)
            if looks_visible(text):
                yield ("html:title", text)


def classify_section(path: str) -> tuple[str, str]:
    file_name = Path(path).name
    if file_name.endswith("Page.tsx"):
        return ("Pages", file_name.replace(".tsx", ""))
    if "Modal" in file_name:
        return ("Modals", file_name.replace(".tsx", ""))
    return ("Shared UI", file_name.replace(".tsx", ""))


def collect_rows() -> list[tuple[str, str, str, str, str]]:
    rows: list[tuple[str, str, str, str, str]] = []
    seen: set[tuple[str, str]] = set()

    targets = list(SRC_DIR.rglob("*.tsx")) + [ROOT / "index.html"]
    for file_path in sorted(targets):
        if not file_path.exists():
            continue
        rel_path = file_path.relative_to(ROOT).as_posix()
        sheet, section = classify_section(rel_path) if file_path.suffix == ".tsx" else ("Shared UI", "index.html")
        for source_type, text in file_candidates(file_path):
            key = (rel_path, text)
            if key in seen:
                continue
            seen.add(key)
            rows.append((sheet, section, text, rel_path, source_type))

    rows.sort(key=lambda row: (row[0], row[1], row[3], row[2].lower()))
    return rows


def write_sheet(wb: Workbook, title: str, rows: list[tuple[str, str, str, str, str]]) -> None:
    ws = wb.create_sheet(title=title)
    ws.append(["Section", "Text", "Edited Text", "File", "Source Type"])
    for _, section, text, file_path, source_type in rows:
        ws.append([section, text, "", file_path, source_type])

    ws.column_dimensions["A"].width = 28
    ws.column_dimensions["B"].width = 72
    ws.column_dimensions["C"].width = 72
    ws.column_dimensions["D"].width = 46
    ws.column_dimensions["E"].width = 20


def write_excel(rows: list[tuple[str, str, str, str, str]]) -> None:
    wb = Workbook()
    wb.remove(wb.active)

    for sheet_name in ("Pages", "Modals", "Shared UI"):
        sheet_rows = [row for row in rows if row[0] == sheet_name]
        write_sheet(wb, sheet_name, sheet_rows)

    wb.save(OUTPUT_FILE)


def main() -> None:
    rows = collect_rows()
    write_excel(rows)
    print(f"Wrote {len(rows)} rows to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
