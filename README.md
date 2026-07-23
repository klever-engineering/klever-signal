# codex-session-audit

A local, privacy-preserving CLI for finding efficiency and prompt-engineering patterns in Codex JSONL session homes.

It reads an existing home passed explicitly with `--codex-home`; it does not require a fixed machine path, copy transcripts, upload data, or retain raw prompt text. Reports contain only derived metrics, source-relative paths, and one-way prompt fingerprints.

## Why a CLI first?

The durable product is a CLI: it can run on any Codex home, in cron or CI, and produce machine-readable reports. A future agent skill can be a thin interpretation layer that invokes this command and explains the highest-value findings.

## Install

```bash
pipx install .
```

For development, use the standard library only:

```bash
python -m unittest discover -s tests
```

## Usage

```bash
codex-session-audit --codex-home ./my-codex-home
codex-session-audit --codex-home ./my-codex-home --format markdown
codex-session-audit --codex-home ./my-codex-home --output report.json
```

## Current metrics

- sessions, turns, compactions, user messages, and tool calls;
- final reported token totals and cache ratio inputs;
- repeated actionable-prompt fingerprints across sessions;
- source-relative session locations for review.

The first release deliberately separates deterministic collection from interpretation. It does not claim that a compaction or a long session was harmful without reviewing the relevant evidence.

## Privacy model

- Source transcripts remain in place and are read only.
- Prompt text is not included in reports.
- No network requests are made.
- Authentication files are not read.

## Release checklist

1. Run the test command and a real audit against a disposable fixture home.
2. Review `CHANGELOG.md`, package metadata, and the MIT license.
3. Create the public GitHub repository under `klever-engineering` and push `main`.
4. Enable the included CI workflow and publish to PyPI only after package metadata is reviewed.
