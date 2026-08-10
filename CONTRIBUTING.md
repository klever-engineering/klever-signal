# Contributing to Klever Signal

Thank you for helping improve Klever Signal. Contributions should make coding-agent work easier to understand, verify, and improve while preserving the privacy of the sessions being analyzed.

## Before you start

- Read the [README](README.md), [architecture guide](docs/architecture.md), and [rule guide](docs/rules.md).
- Check existing issues before opening a new one.
- Do not include raw prompts, transcripts, credentials, or personal session paths in issues, pull requests, fixtures, screenshots, or tests.

## Development setup

Requirements:

- Node.js 20 or newer
- npm

```bash
git clone https://github.com/klever-engineering/klever-signal.git
cd klever-signal
npm test
npm run smoke
```

The project has no runtime dependencies. Keep it that way unless a dependency materially improves correctness or reliability and the trade-off is documented.

## Making a change

1. Define the behavior and its privacy boundary before editing code.
2. Add or update a synthetic JSONL fixture test for adapter behavior.
3. Keep raw-session parsing deterministic and output derived data only.
4. Update the relevant documentation and `CHANGELOG.md` under `Unreleased`.
5. Run `npm test`, `npm run smoke`, and a package dry run with `npm pack --dry-run`.
6. For report changes, inspect both Markdown and HTML output and include a sanitized fixture-based example when useful.

## Adding a rule

Rules are intentionally explicit. A new rule should include:

- a stable identifier and short title;
- a deterministic detection condition;
- evidence and an explanation of why the pattern merits review;
- a bounded intervention at the skill, technique, harness, or workflow layer;
- a repeatable verification procedure; and
- a named outcome metric.

Add the rule to `docs/rules.md`, the README rule table, the implementation, and tests. A threshold must prioritize human review; it must not claim causality or automatically change a user’s operating environment.

## Pull requests

Describe the problem, the behavior changed, the privacy implications, and the verification run. Keep pull requests focused. Maintainers may ask for a smaller slice when a change combines collection, interpretation, and intervention behavior without a clear boundary.

## Commit and release conventions

Use concise conventional-style subjects such as `feat: add ...`, `fix: prevent ...`, or `docs: clarify ...`. Release preparation follows [docs/releasing.md](docs/releasing.md); publishing to npm and creating GitHub releases are maintainer actions.
