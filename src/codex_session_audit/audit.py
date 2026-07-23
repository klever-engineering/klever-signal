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
    return {
        "schema_version": 1,
        "codex_home": str(home),
        "session_count": len(audits),
        "totals": {
            "turns": sum(audit.turns for audit in audits),
            "compactions": sum(audit.compactions for audit in audits),
            "tool_calls": sum(audit.tool_calls for audit in audits),
            "input_tokens": sum(audit.total_input_tokens for audit in audits),
            "cached_input_tokens": sum(audit.cached_input_tokens for audit in audits),
            "output_tokens": sum(audit.output_tokens for audit in audits),
        },
        "repeated_prompt_groups": [
            {"fingerprint": fingerprint, "session_count": count}
            for fingerprint, count in fingerprint_counts.most_common()
            if count > 1
        ],
        "sessions": [audit.as_dict() for audit in audits],
        "privacy": {
            "raw_prompt_text_stored": False,
            "raw_transcripts_copied": False,
            "prompt_fingerprints": "sha256 prefix of first actionable user prompt",
        },
    }
