import json
from pathlib import Path
import unittest

from codex_session_audit.audit import audit_home
from codex_session_audit.cli import _html, _markdown


def write_records(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True)
    path.write_text("".join(json.dumps(record) + "\n" for record in records), encoding="utf-8")


class AuditTests(unittest.TestCase):
    def test_audits_session_without_storing_prompt_text(self) -> None:
        import tempfile
        with tempfile.TemporaryDirectory() as directory, self.subTest("fixture"):
            home = Path(directory) / "factory-codex-home"
            write_records(home / "sessions/2026/07/23/rollout-one.jsonl", [
                {"type": "session_meta", "payload": {"session_id": "session-1"}},
                {"type": "turn_context", "payload": {}},
                {"type": "compacted", "payload": {}},
                {"type": "response_item", "payload": {"type": "message", "role": "user", "content": [{"type": "input_text", "text": "Implement FCP-030 only."}]}},
                {"type": "response_item", "payload": {"type": "function_call"}},
                {"type": "event_msg", "payload": {"type": "token_count", "info": {"total_token_usage": {"input_tokens": 100, "cached_input_tokens": 70, "output_tokens": 10}}}},
                {"type": "event_msg", "payload": {"type": "token_count", "info": None}},
            ])

            report = audit_home(home)

            self.assertEqual(report["session_count"], 1)
            self.assertEqual(report["totals"]["compactions"], 1)
            self.assertTrue(report["sessions"][0]["prompt_fingerprint"])
            self.assertNotIn("Implement FCP-030 only.", json.dumps(report))
            self.assertFalse(report["privacy"]["raw_transcripts_copied"])
            self.assertIn("Optimization assessment", _markdown(report))
            self.assertIn("Prioritized optimizations", _html(report))
