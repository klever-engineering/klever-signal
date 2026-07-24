# Klever Signal Agent Policy

- Keep the CLI dependency-free unless a dependency materially improves reliability.
- Never copy, upload, print, or persist raw session content by default.
- Every session source must be supplied explicitly through its adapter parameter; the initial Codex adapter uses `--codex-home`.
- Keep raw-session parsing deterministic and test it with synthetic JSONL fixtures.
- Do not hardcode local paths in source code or documentation.
- Before handoff run `npm test` and `npm run smoke`.
