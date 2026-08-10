# Security Policy

## Scope

Klever Signal reads local coding-agent session artifacts. Its primary security and privacy promise is that source transcripts remain in place and reports do not contain raw prompt text or copied transcript content.

## Supported versions

Only the latest release on the `main` branch is actively maintained while the project is below 1.0.0.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability or accidental disclosure. Report it privately through the security contact configured for the GitHub repository, or use GitHub's private security advisory flow.

Include:

- the affected version or commit;
- a concise description of the issue and impact;
- safe reproduction steps using synthetic data; and
- any suggested mitigation.

Please redact prompts, tokens, credentials, personal paths, and transcript content from the report. We will acknowledge valid reports, investigate them, and coordinate a fix or mitigation before public disclosure.

## Safe handling guidance

- Pass session homes explicitly with `--codex-home`.
- Write reports to a controlled local or CI artifact directory.
- Review generated reports before sharing them; derived paths and metrics may still reveal operational details.
- Never commit session homes, raw JSONL files, authentication files, or generated audit data.
