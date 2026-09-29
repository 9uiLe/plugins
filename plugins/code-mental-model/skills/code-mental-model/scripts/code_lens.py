"""Build short, source-backed evidence excerpts without doing I/O."""

from __future__ import annotations

from collections.abc import Mapping

from domain import CodeLens, CodeLine, CodeRange, LineNumber, SourceLocation, SourcePath


def build_code_lens(source: SourceLocation | None,
                    contents: Mapping[SourcePath, str]) -> CodeLens | None:
    if source is None:
        return None
    if source.path not in contents:
        raise ValueError(f"source not listed in targets: {source.path}")
    lines = contents[source.path].splitlines()
    if source.end_line > len(lines):
        raise ValueError(f"source line exceeds file: {source.path}:{source.end_line}")
    start = max(1, source.start_line - 2)
    end = min(len(lines), source.end_line + 3)
    return CodeLens(CodeRange(source.path, LineNumber(start), LineNumber(end)), source,
                    tuple(CodeLine(LineNumber(number), lines[number - 1])
                          for number in range(start, end + 1)))
