import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { auditCodexHome, htmlReport, markdownReport } from "../src/index.js";

test("audits a Codex home without emitting raw prompt text", () => {
  const home = mkdtempSync(path.join(os.tmpdir(), "klever-signal-"));
  const file = path.join(home, "sessions/2026/07/24/rollout-fixture.jsonl");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, [
    { type: "session_meta", payload: { session_id: "fixture" } },
    { type: "turn_context", payload: {} }, { type: "compacted", payload: {} },
    { type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "Implement a private feature." }] } },
    { type: "response_item", payload: { type: "function_call" } },
    { type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: 100, cached_input_tokens: 70, output_tokens: 10 } } } },
  ].map(JSON.stringify).join("\n"), "utf8");
  const report = auditCodexHome(home);
  assert.equal(report.sessionCount, 1);
  assert.equal(report.totals.compactions, 1);
  assert.ok(report.sessions[0].promptFingerprint);
  assert.equal(JSON.stringify(report).includes("Implement a private feature."), false);
  assert.ok(report.analysis.findings[0].interventions.length > 0);
  assert.ok(report.analysis.findings[0].interventions[0].verification);
  assert.equal(report.analysis.findings[0].ruleId, "KS003");
  assert.equal(report.analysis.findings[0].category, "Context management");
  assert.match(report.analysis.findings[0].description, /Context churn occurs/);
  assert.equal(report.analysis.visuals.turnBands.reduce((sum, band) => sum + band.count, 0), 1);
  assert.match(markdownReport(report), /Optimization assessment/);
  assert.match(markdownReport(report), /Implementation backlog/);
  assert.match(markdownReport(report), /Rule inventory/);
  assert.match(markdownReport(report), /What it is/);
  assert.match(htmlReport(report), /Prioritized optimizations/);
  assert.match(htmlReport(report), /Implementation backlog/);
  assert.match(htmlReport(report), /Distribution snapshots/);
  assert.match(htmlReport(report), /What it is/);
});
