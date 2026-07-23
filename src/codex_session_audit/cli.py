from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path
from typing import Any

from .audit import audit_home


def _markdown(report: dict[str, Any]) -> str:
    totals = report["totals"]
    analysis = report["analysis"]
    input_tokens = totals["input_tokens"]
    cache_rate = analysis["cache_rate"] * 100
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
        "## Optimization assessment",
        "",
    ]
    for finding in analysis["findings"]:
        lines.extend([
            f"### {finding['priority'].upper()}: {finding['title']}",
            "",
            f"**Evidence:** {finding['evidence']}",
            "",
            f"**Recommended optimization:** {finding['recommendation']}",
            "",
        ])
    lines.extend(["## Repeated prompt groups", ""])
    groups = report["repeated_prompt_groups"]
    lines.extend([f"- `{group['fingerprint']}`: {group['session_count']} sessions" for group in groups] or ["- None"])
    lines.extend(["", "## Sessions to review", "", "| Session source | Turns | Compactions | Tool calls | Uncached input |", "| --- | ---: | ---: | ---: | ---: |"])
    for session in analysis["review_candidates"]:
        lines.append(f"| `{session['source']}` | {session['turns']} | {session['compactions']} | {session['tool_calls']} | {session['uncached_input_tokens']} |")
    lines.extend([
        "",
        "## Operating model",
        "",
        "1. Use one bounded goal per worker session and define an explicit verification command.",
        "2. Run campaign waves with a stop condition rather than an unbounded continuation instruction.",
        "3. Start a fresh control session after a phase change; carry forward a structured handoff.",
        "4. Use this report to select transcripts for qualitative review; thresholds identify signals, not root causes.",
    ])
    return "\n".join(lines) + "\n"


def _html(report: dict[str, Any]) -> str:
    totals = report["totals"]
    analysis = report["analysis"]
    finding_html = "".join(
        f"<article class='finding {html.escape(finding['priority'])}'><h3>{html.escape(finding['priority'].upper())}: {html.escape(finding['title'])}</h3><p><strong>Evidence:</strong> {html.escape(finding['evidence'])}</p><p><strong>Recommended optimization:</strong> {html.escape(finding['recommendation'])}</p></article>"
        for finding in analysis["findings"]
    )
    rows = "".join(
        f"<tr><td><code>{html.escape(session['source'])}</code></td><td>{session['turns']}</td><td>{session['compactions']}</td><td>{session['tool_calls']}</td><td>{session['uncached_input_tokens']}</td></tr>"
        for session in analysis["review_candidates"]
    )
    return f"""<!doctype html>
<html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<title>Codex Session Audit</title><style>
body{{font:16px/1.5 system-ui,sans-serif;max-width:1050px;margin:2rem auto;padding:0 1rem;color:#172033;background:#fbfcfe}} h1,h2{{color:#102a43}} .metrics{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem}} .metric,article{{background:white;border:1px solid #d9e2ec;border-radius:10px;padding:1rem}} .metric b{{display:block;font-size:1.5rem}} article.high{{border-left:5px solid #d64545}} article.medium{{border-left:5px solid #d99a00}} article.low{{border-left:5px solid #2f855a}} table{{width:100%;border-collapse:collapse;background:white}} td,th{{padding:.6rem;border:1px solid #d9e2ec;text-align:left}} code{{font-size:.85em}} </style></head>
<body><h1>Codex Session Audit</h1><p>Deterministic optimization signals. No raw prompts or transcript copies are included.</p>
<section class='metrics'><div class='metric'><span>Sessions</span><b>{report['session_count']}</b></div><div class='metric'><span>Turns</span><b>{totals['turns']}</b></div><div class='metric'><span>Compactions</span><b>{totals['compactions']}</b></div><div class='metric'><span>Tool calls</span><b>{totals['tool_calls']}</b></div><div class='metric'><span>Cache rate</span><b>{analysis['cache_rate']:.1%}</b></div></section>
<h2>Prioritized optimizations</h2>{finding_html}<h2>Sessions to review</h2><table><thead><tr><th>Session source</th><th>Turns</th><th>Compactions</th><th>Tool calls</th><th>Uncached input</th></tr></thead><tbody>{rows}</tbody></table>
<h2>Interpretation boundary</h2><p>These thresholds prioritize human review. They do not establish that a compaction, long session, or repeated prompt caused an outcome.</p></body></html>"""


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Analyze a Codex session home without copying raw transcripts.")
    parser.add_argument("--codex-home", required=True, type=Path, help="Path to the Codex home containing sessions/")
    parser.add_argument("--format", choices=("json", "markdown", "html"), default="markdown")
    parser.add_argument("--output", type=Path, help="Write the report to this path instead of stdout")
    args = parser.parse_args(argv)
    try:
        report = audit_home(args.codex_home)
    except ValueError as error:
        parser.error(str(error))
    rendered = json.dumps(report, indent=2) + "\n" if args.format == "json" else _markdown(report) if args.format == "markdown" else _html(report)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    else:
        sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
