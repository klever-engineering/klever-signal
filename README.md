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
npx @klever-engineering/klever-signal resume --codex-home ./my-codex-home --rule KS001
```

## Initial Codex adapter

- sessions, turns, compactions, user messages, and tool calls;
- final reported token totals and cache ratio inputs;
- repeated actionable-prompt fingerprints across sessions;
- source-relative session locations for review.

Markdown and HTML reports use stable, Sonar-style rules (`KS001`, `KS002`, and so on) rather than anonymous threshold warnings. Each rule has a category, priority, detection evidence, why it matters, a remediation backlog, a verification procedure, and an outcome metric. The HTML report also visualizes session-turn and compaction distributions plus the path from signal to measurable improvement. Rules flag patterns such as retry-prone repeated prompts, oversized control sessions, dense compaction, weak cache reuse, and tool-loop hotspots. Thresholds are prompts for review, never claims of causality.

Every rule includes an immediate remediation prompt. It is an implementation-ready brief for creating the relevant skill, technique, or harness improvement, including verification and metric requirements. `resume` prints that prompt together with a representative source-relative session example and derived metrics. It deliberately does not print raw prompts or transcript content.

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
