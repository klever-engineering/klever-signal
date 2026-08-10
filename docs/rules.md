# Rule Reference

Rules are deterministic prompts for review. They are not quality scores, automatic policy decisions, or proof of causality.

## Rule contract

Every rule must provide:

1. a stable `KS` identifier and title;
2. a category and priority;
3. a plain-language definition;
4. detection evidence from derived metrics;
5. an explanation of why the signal matters;
6. a recommendation;
7. one or more interventions with a layer (`skill`, `technique`, `harness`, or `workflow`);
8. repeatable verification; and
9. a named outcome metric.

## Current rules

| ID | Name | Detection | Primary intervention |
| --- | --- | --- | --- |
| KS001 | Retry loop | A materially identical actionable prompt occurs in multiple sessions | Require a retry-admission card with the changed evidence or strategy |
| KS002 | Context sprawl | A session reaches 15 or more turns | Split at a goal or work-mode boundary and create a structured handoff |
| KS003 | Context churn | At least two compactions, or compaction density reaches 15% | Preserve outcome, decisions, non-goals, verification, and blockers |
| KS004 | Cache instability | Cached input is below 30% of reported input | Keep durable prompt material in a stable prefix |
| KS005 | Tool-loop hotspot | Tool calls reach three times the session average, with a minimum threshold of 50 | Require a decision or verification checkpoint after bounded tool batches |

## Interpreting a finding

Use the chain:

```text
signal → risk hypothesis → intervention → verification → metric
```

The signal tells you where to look. Read the representative session, inspect the workspace evidence, and decide whether the hypothesis fits. Adopt one bounded intervention, verify it with a fixture or review, and compare the named metric before and after. If the metric does not improve, record that result rather than treating the original rule as proven.
