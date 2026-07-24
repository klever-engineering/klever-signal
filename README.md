# Klever Signal

A local, privacy-preserving CLI for finding efficiency and prompt-engineering patterns in coding-agent sessions.

The first adapter reads Codex JSONL homes passed explicitly with `--codex-home`. Klever Signal does not require a fixed machine path, copy transcripts, upload data, or retain raw prompt text. Reports contain only derived metrics, source-relative paths, and one-way prompt fingerprints.

## Why a CLI first?

The durable product is a CLI: it can run in cron or CI and produce machine-readable reports. A future agent skill can be a thin interpretation layer that invokes this command and explains the highest-value findings.

## Install

```bash
npx @klever-engineering/klever-signal --help
```

For development, Node.js 20+ is the only requirement:

```bash
npm test
```

## Usage

```bash
npx @klever-engineering/klever-signal --codex-home ./my-codex-home
npx @klever-engineering/klever-signal --codex-home ./my-codex-home --format html --output report.html
npx @klever-engineering/klever-signal --codex-home ./my-codex-home --format json --output report.json
```

## Initial Codex adapter

- sessions, turns, compactions, user messages, and tool calls;
- final reported token totals and cache ratio inputs;
- repeated actionable-prompt fingerprints across sessions;
- source-relative session locations for review.

Markdown and HTML reports add prioritized optimization findings, evidence, recommended actions, and a ranked review queue. They flag patterns such as retry-prone repeated prompts, oversized control sessions, dense compaction, and weak cache reuse. Thresholds are prompts for review, never claims of causality.

The first release deliberately separates deterministic collection from interpretation. It does not claim that a compaction or a long session was harmful without reviewing the relevant evidence. Claude and other coding-agent adapters are future capabilities, not current claims.

## Privacy model

- Source transcripts remain in place and are read only.
- Prompt text is not included in reports.
- No network requests are made.
- Authentication files are not read.

## Release checklist

1. Run the test command and a real audit against a disposable fixture home.
2. Review `CHANGELOG.md`, package metadata, and the MIT license.
3. Create the public GitHub repository under `klever-engineering` and push `main`.
4. Enable the included CI workflow and publish to npm only after package metadata is reviewed.
