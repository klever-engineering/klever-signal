# Architecture

Klever Signal is a local pipeline with four deliberately separated stages:

```text
explicit session home
        ↓
deterministic adapter
        ↓
derived audit model
        ↓
Markdown / HTML / JSON / remediation report
```

## Collection boundary

The initial adapter accepts a Codex home through `--codex-home` and reads only `sessions/**/rollout-*.jsonl`. It extracts session metadata, turn and compaction counts, tool-call counts, user-message counts, token usage, and a one-way fingerprint of the first actionable user message.

The adapter must not copy raw prompts or transcripts into its returned model. Session source paths are made relative to the supplied home. This boundary lets the rest of the system operate on useful signals without requiring transcript distribution.

## Analysis boundary

The adapter computes deterministic findings from aggregate metrics and session summaries. Rules are policy-shaped functions: they produce a stable identifier, category, priority, definition, observed evidence, interpretation boundary, recommendation, intervention backlog, verification procedure, and metric.

Rules do not mutate the session home, rewrite prompts, launch an agent, or claim that a correlation caused an outcome. They select evidence for human review and produce a bounded remediation brief.

## Report boundary

Report renderers consume the audit model and do not re-parse session files. This keeps output formats replaceable and makes it possible to add another renderer without changing collection or rule behavior.

- Markdown is suitable for commits, reviews, and handoffs.
- HTML is a self-contained visual report for local inspection.
- JSON is the machine-readable contract for automation.
- `resume --rule KS00X` is a focused handoff for one finding.

## Extension points

Future work should extend one boundary at a time:

- **Adapters:** add another coding-agent session format without changing rule semantics.
- **Rules:** add a deterministic review signal with a verification and metric contract.
- **Renderers:** add a consumer without leaking raw session data.
- **Integrations:** connect reports to CI or a review workflow only after the local privacy and provenance boundaries remain explicit.

Keep collection, interpretation, and intervention separate. That separation makes failures diagnosable: a missing signal is different from a bad rule, and a good finding is different from a verified improvement.
