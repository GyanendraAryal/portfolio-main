"""
Resume chunker — extracts text from PDF bytes and splits into
semantically meaningful chunks (one per section / experience entry / project).

Uses pypdf (pure Python, no external binary dependency).
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from typing import Iterator

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover
    raise ImportError("pypdf is required: pip install pypdf")


# Section heading patterns (case-insensitive).
# Order matters — more specific patterns first.
_SECTION_PATTERNS = [
    re.compile(r"^\s*(summary|profile|objective)\s*$", re.I),
    re.compile(r"^\s*(experience|work\s+experience|employment|work\s+history)\s*$", re.I),
    re.compile(r"^\s*(education|academic|qualifications)\s*$", re.I),
    re.compile(r"^\s*(skills?|technical\s+skills?|core\s+competenc(ies|y))\s*$", re.I),
    re.compile(r"^\s*(projects?|personal\s+projects?|side\s+projects?)\s*$", re.I),
    re.compile(r"^\s*(certifications?|licenses?|credentials?)\s*$", re.I),
    re.compile(r"^\s*(awards?|honors?|achievements?)\s*$", re.I),
    re.compile(r"^\s*(publications?|research)\s*$", re.I),
    re.compile(r"^\s*(languages?)\s*$", re.I),
    re.compile(r"^\s*(interests?|hobbies|activities)\s*$", re.I),
    re.compile(r"^\s*(contact|references?)\s*$", re.I),
    re.compile(r"^\s*(volunteer|community)\s*$", re.I),
]


def _is_section_heading(line: str) -> bool:
    stripped = line.strip()
    if not stripped or len(stripped) > 60:
        return False
    return any(p.match(stripped) for p in _SECTION_PATTERNS)


@dataclass
class ResumeChunk:
    section: str
    text: str
    index: int          # position within section (0-based)
    metadata: dict = field(default_factory=dict)


def extract_text_from_pdf(content: bytes) -> str:
    """Extract plain text from PDF bytes using pypdf."""
    reader = PdfReader(io.BytesIO(content))
    pages = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(text)
    return "\n".join(pages)


def chunk_resume(content: bytes, resume_version: str) -> list[ResumeChunk]:
    """
    Parse raw PDF bytes into a list of ResumeChunks.

    Strategy:
    - Extract all text from the PDF.
    - Split into lines; detect section headings.
    - Accumulate lines into sections.
    - Within 'experience' and 'projects' sections, further split on
      date-range patterns to isolate individual entries.
    - Skip chunks that are too short to be meaningful (< 30 chars).
    """
    raw_text = extract_text_from_pdf(content)
    lines = raw_text.splitlines()

    sections: dict[str, list[str]] = {}
    current_section = "header"

    for line in lines:
        if _is_section_heading(line):
            current_section = line.strip().lower()
            if current_section not in sections:
                sections[current_section] = []
        else:
            if current_section not in sections:
                sections[current_section] = []
            sections[current_section].append(line)

    chunks: list[ResumeChunk] = []
    for section_name, section_lines in sections.items():
        sub_chunks = _split_section(section_name, section_lines)
        for idx, text in enumerate(sub_chunks):
            text = text.strip()
            if len(text) < 30:
                continue
            chunks.append(ResumeChunk(
                section=section_name,
                text=text,
                index=idx,
                metadata={"resume_version": resume_version, "section": section_name},
            ))

    return chunks


# Date-range pattern: e.g. "Jan 2021 – Present", "2019 - 2022", "03/2020 – 06/2021"
_DATE_RANGE = re.compile(
    r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})[^\n]{0,30}"
    r"(–|-|to)\s*(present|\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)",
    re.I,
)


def _split_section(section_name: str, lines: list[str]) -> list[str]:
    """
    For experience / project sections, split on date-range lines to isolate entries.
    For other sections, return the whole section as one chunk (possibly split by blank lines).
    """
    text = "\n".join(lines)

    if any(kw in section_name for kw in ("experience", "employment", "history", "project")):
        return _split_on_dates(text)

    # Split on double blank lines to separate subsections
    parts = re.split(r"\n{2,}", text)
    return [p.strip() for p in parts if p.strip()]


def _split_on_dates(text: str) -> list[str]:
    """Split a block of text at each occurrence of a date-range pattern."""
    lines = text.splitlines()
    entries: list[list[str]] = []
    current: list[str] = []

    for line in lines:
        if _DATE_RANGE.search(line) and current:
            entries.append(current)
            current = [line]
        else:
            current.append(line)

    if current:
        entries.append(current)

    return ["\n".join(e).strip() for e in entries if "\n".join(e).strip()]
