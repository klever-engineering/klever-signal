# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and releases use [Semantic Versioning](https://semver.org/).

## [Unreleased]

Changes after the latest release will be recorded here under `Added`,
`Changed`, `Fixed`, `Security`, or `Breaking` as appropriate.

## [0.1.0] - 2026-08-10

The first public release of Klever Signal. This is intentionally a small,
local-only foundation for evidence-based coding-agent improvement.

### Added

- A dependency-free Node.js ESM CLI for auditing explicitly supplied Codex JSONL
  session homes.
- Deterministic session, turn, compaction, tool-call, user-message, token, cache,
  and repeated-actionable-prompt metrics.
- Stable optimization rules `KS001` through `KS005` for retry loops, context
  sprawl, context churn, cache instability, and tool-loop hotspots.
- Markdown, HTML, JSON, and rule-specific remediation reports.
- A privacy-preserving output contract: reports contain derived metrics,
  source-relative paths, and one-way prompt fingerprints, not raw prompts or
  copied transcripts.
- Synthetic-fixture tests and a CI workflow for the CLI and adapter.
- Open-source documentation covering architecture, rules, contribution,
  security reporting, and release operations.

### Known limitations

- Only the Codex JSONL adapter is included; other coding-agent formats are not
  yet supported.
- Rules are deterministic review signals, not causal diagnoses or quality
  scores.
- The package is not yet published to npm. Use the GitHub `npx` form or clone
  the repository until publication is complete.

[Unreleased]: https://github.com/klever-engineering/klever-signal/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/klever-engineering/klever-signal/releases/tag/v0.1.0
