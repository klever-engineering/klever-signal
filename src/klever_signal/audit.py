from __future__ import annotations

import hashlib
import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator


@dataclass(frozen=True)
class SessionAudit:
    source: str
    session_id: str | None
    turns: int
    compactions: int
    user_messages: int
    tool_calls: int
    total_input_tokens: int
    cached_input_tokens: int
    output_tokens: int
    prompt_fingerprint: str | None

    def as_dict(self) -> dict[str, Any]:
        result = self.__dict__.copy()
        result["uncached_input_tokens"] = max(0, self.total_input_tokens - self.cached_input_tokens)
        return result


def session_files(codex_home: Path) -> list[Path]:
    sessions = codex_home / "sessions"
    if not sessions.is_dir():
        raise ValueError(f"Not a Codex home: missing sessions directory at {sessions}")
    return sorted(sessions.rglob("rollout-*.jsonl"))


def _records(path: Path) -> Iterator[dict[str, Any]]:
    with path.open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, start=1):
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(record, dict):
                continue
            yield record


def _user_text(record: dict[str, Any]) -> str | None:
    payload = record.get("payload", {})
    if record.get("type") != "response_item" or payload.get("type") != "message" or payload.get("role") != "user":
        return None
    content = payload.get("content", [])
    if not isinstance(content, list):
        return None
    parts = [item.get("text", "") for item in content if isinstance(item, dict) and item.get("type") == "input_text"]
    text = "\n".join(part for part in parts if isinstance(part, str)).strip()
    if not text or text.startswith("<recommended_plugins>") or "<environment_context>" in text:
        return None
    return text


def audit_session(path: Path, home: Path) -> SessionAudit:
    turns = compactions = user_messages = tool_calls = 0
    session_id: str | None = None
    latest_usage: dict[str, Any] = {}
    first_user_prompt: str | None = None

    for record in _records(path):
        kind = record.get("type")
        payload = record.get("payload", {})
        if kind == "session_meta":
            session_id = payload.get("session_id") or payload.get("id")
        elif kind == "turn_context":
            turns += 1
        elif kind == "compacted":
            compactions += 1
        elif kind == "response_item":
            if payload.get("type") in {"function_call", "custom_tool_call"}:
                tool_calls += 1
            prompt = _user_text(record)
            if prompt is not None:
                user_messages += 1
                if first_user_prompt is None:
                    first_user_prompt = prompt
        elif kind == "event_msg" and payload.get("type") == "token_count":
            info = payload.get("info")
            if isinstance(info, dict):
                usage = info.get("total_token_usage")
                if isinstance(usage, dict):
                    latest_usage = usage

    fingerprint = None
    if first_user_prompt:
        fingerprint = hashlib.sha256(first_user_prompt.encode("utf-8")).hexdigest()[:16]
    return SessionAudit(
        source=str(path.relative_to(home)),
        session_id=session_id,
        turns=turns,
        compactions=compactions,
        user_messages=user_messages,
        tool_calls=tool_calls,
        total_input_tokens=int(latest_usage.get("input_tokens", 0)),
        cached_input_tokens=int(latest_usage.get("cached_input_tokens", 0)),
        output_tokens=int(latest_usage.get("output_tokens", 0)),
        prompt_fingerprint=fingerprint,
    )


def audit_home(codex_home: Path) -> dict[str, Any]:
    home = codex_home.expanduser().resolve()
    audits = [audit_session(path, home) for path in session_files(home)]
    fingerprint_counts = Counter(audit.prompt_fingerprint for audit in audits if audit.prompt_fingerprint)
    sessions = [audit.as_dict() for audit in audits]
    totals = {
        "turns": sum(audit.turns for audit in audits),
        "compactions": sum(audit.compactions for audit in audits),
        "tool_calls": sum(audit.tool_calls for audit in audits),
        "input_tokens": sum(audit.total_input_tokens for audit in audits),
        "cached_input_tokens": sum(audit.cached_input_tokens for audit in audits),
        "output_tokens": sum(audit.output_tokens for audit in audits),
    }
    repeated_prompt_groups = [
        {"fingerprint": fingerprint, "session_count": count}
        for fingerprint, count in fingerprint_counts.most_common()
        if count > 1
    ]
    return {
        "schema_version": 1,
        "codex_home": str(home),
        "session_count": len(audits),
        "totals": totals,
        "repeated_prompt_groups": repeated_prompt_groups,
        "sessions": sessions,
        "analysis": build_analysis(totals, sessions, repeated_prompt_groups),
        "privacy": {
            "raw_prompt_text_stored": False,
            "raw_transcripts_copied": False,
            "prompt_fingerprints": "sha256 prefix of first actionable user prompt",
        },
    }


def build_analysis(
    totals: dict[str, int],
    sessions: list[dict[str, Any]],
    repeated_prompt_groups: list[dict[str, Any]],
) -> dict[str, Any]:
    """Return transparent, deterministic optimization signals, not causal claims."""
    findings: list[dict[str, str]] = []
    cache_rate = totals["cached_input_tokens"] / totals["input_tokens"] if totals["input_tokens"] else 0
    if repeated_prompt_groups:
        repeated_sessions = sum(group["session_count"] for group in repeated_prompt_groups)
        findings.append({
            "priority": "high",
            "title": "Add retry admission gates for repeated prompts",
            "evidence": f"{repeated_sessions} sessions belong to {len(repeated_prompt_groups)} repeated actionable-prompt groups.",
            "recommendation": "Before retrying a goal, require a changed failure signature, a workspace change, or explicit approval."
        })
    long_sessions = [session for session in sessions if session["turns"] >= 15]
    if long_sessions:
        findings.append({
            "priority": "high",
            "title": "Split long control sessions at phase boundaries",
            "evidence": f"{len(long_sessions)} sessions reached 15 or more turns.",
            "recommendation": "After a goal-family or work-mode change, start a new session with a short handoff: outcome, non-goals, evidence, and next stop condition."
        })
    compaction_heavy = [session for session in sessions if session["compactions"] >= 2 or (session["turns"] and session["compactions"] / session["turns"] >= 0.15)]
    if compaction_heavy:
        findings.append({
            "priority": "medium",
            "title": "Review compaction-trigger policy and handoff quality",
            "evidence": f"{len(compaction_heavy)} sessions have multiple or dense compactions.",
            "recommendation": "Keep compaction summaries structured around active outcome, decisions, non-goals, verification state, and blockers; do not treat compaction count alone as a failure."
        })
    if totals["input_tokens"] and cache_rate < 0.30:
        findings.append({
            "priority": "medium",
            "title": "Stabilize repeated prompt prefixes for caching",
            "evidence": f"Cached input is only {cache_rate:.1%} of reported input tokens.",
            "recommendation": "Keep durable instructions and tool contracts in a stable prefix; inject goal-specific details after it."
        })
    if not findings:
        findings.append({
            "priority": "low",
            "title": "No threshold-based optimization signal detected",
            "evidence": "The deterministic rules did not flag retries, long sessions, dense compaction, or low cache reuse.",
            "recommendation": "Review the highest-cost sessions qualitatively before changing prompt or runtime policy."
        })

    def review_score(session: dict[str, Any]) -> int:
        return session["turns"] * 3 + session["compactions"] * 25 + session["tool_calls"] // 4 + session["uncached_input_tokens"] // 10_000

    review_candidates = sorted(sessions, key=review_score, reverse=True)[:10]
    return {
        "cache_rate": cache_rate,
        "findings": findings,
        "review_candidates": review_candidates,
        "thresholds": {
            "long_session_turns": 15,
            "compaction_density": 0.15,
            "low_cache_rate": 0.30,
        },
    }
