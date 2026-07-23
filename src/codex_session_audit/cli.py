from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from .audit import audit_home


def _markdown(report: dict[str, Any]) -> str:
    totals = report["totals"]
    cached = totals["cached_input_tokens"]
    input_tokens = totals["input_tokens"]
    cache_rate = (cached / input_tokens * 100) if input_tokens else 0
    lines = [
        "# Codex Session Audit",
        "",
        f"- Sessions: {report['session_count']}",
        f"- Turns: {totals['turns']}",
        f"- Compactions: {totals['compactions']}",
        f"- Tool calls: {totals['tool_calls']}",
        f"- Input tokens: {input_tokens}",
        f"- Cache rate: {cache_rate:.1f}%",
        "",
        "## Repeated prompt groups",
        "",
    ]
    groups = report["repeated_prompt_groups"]
    lines.extend([f"- `{group['fingerprint']}`: {group['session_count']} sessions" for group in groups] or ["- None"])
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Analyze a Codex session home without copying raw transcripts.")
    parser.add_argument("--codex-home", required=True, type=Path, help="Path to the Codex home containing sessions/")
    parser.add_argument("--format", choices=("json", "markdown"), default="json")
    parser.add_argument("--output", type=Path, help="Write the report to this path instead of stdout")
    args = parser.parse_args(argv)
    try:
        report = audit_home(args.codex_home)
    except ValueError as error:
        parser.error(str(error))
    rendered = json.dumps(report, indent=2) + "\n" if args.format == "json" else _markdown(report)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    else:
        sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
