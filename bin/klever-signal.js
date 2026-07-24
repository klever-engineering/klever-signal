#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { auditCodexHome, htmlReport, markdownReport, resumeReport } from "../src/index.js";

const args = process.argv.slice(2);
const command = args[0] === "resume" ? "resume" : "audit";
if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage:\n  klever-signal --codex-home <path> [--format markdown|html|json] [--output <path>]\n  klever-signal resume --codex-home <path> --rule <KS001> [--output <path>]");
  process.exit(0);
}
const value = (flag) => args[args.indexOf(flag) + 1];
const codexHome = value("--codex-home");
const format = value("--format") ?? "markdown";
const output = value("--output");
const ruleId = value("--rule");
if (!codexHome || (command === "audit" && !["markdown", "html", "json"].includes(format)) || (command === "resume" && !ruleId)) {
  console.error("Usage:\n  klever-signal --codex-home <path> [--format markdown|html|json] [--output <path>]\n  klever-signal resume --codex-home <path> --rule <KS001> [--output <path>]");
  process.exit(2);
}
try {
  const report = auditCodexHome(resolve(codexHome));
  const rendered = command === "resume" ? resumeReport(report, ruleId) : format === "json" ? `${JSON.stringify(report, null, 2)}\n` : format === "html" ? htmlReport(report) : markdownReport(report);
  if (output) {
    const resolvedOutput = resolve(output);
    mkdirSync(dirname(resolvedOutput), { recursive: true });
    writeFileSync(resolvedOutput, rendered, "utf8");
  }
  else process.stdout.write(rendered);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
