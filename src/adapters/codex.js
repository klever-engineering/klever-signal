import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function rolloutFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const candidate = path.join(directory, entry);
    if (statSync(candidate).isDirectory()) files.push(...rolloutFiles(candidate));
    else if (entry.startsWith("rollout-") && entry.endsWith(".jsonl")) files.push(candidate);
  }
  return files.sort();
}

function records(file) {
  return readFileSync(file, "utf8").split("\n").flatMap((line) => {
    try {
      const value = JSON.parse(line);
      return value && typeof value === "object" ? [value] : [];
    } catch {
      return [];
    }
  });
}

function actionableUserText(record) {
  const payload = record.payload ?? {};
  if (record.type !== "response_item" || payload.type !== "message" || payload.role !== "user") return null;
  const text = (payload.content ?? [])
    .filter((item) => item?.type === "input_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n")
    .trim();
  if (!text || text.startsWith("<recommended_plugins>") || text.includes("<environment_context>")) return null;
  return text;
}

function auditSession(file, home) {
  let turns = 0;
  let compactions = 0;
  let userMessages = 0;
  let toolCalls = 0;
  let sessionId = null;
  let usage = {};
  let firstPrompt = null;
  for (const record of records(file)) {
    const payload = record.payload ?? {};
    if (record.type === "session_meta") sessionId = payload.session_id ?? payload.id ?? null;
    else if (record.type === "turn_context") turns += 1;
    else if (record.type === "compacted") compactions += 1;
    else if (record.type === "response_item") {
      if (["function_call", "custom_tool_call"].includes(payload.type)) toolCalls += 1;
      const prompt = actionableUserText(record);
      if (prompt) {
        userMessages += 1;
        firstPrompt ??= prompt;
      }
    } else if (record.type === "event_msg" && payload.type === "token_count" && payload.info?.total_token_usage) {
      usage = payload.info.total_token_usage;
    }
  }
  const totalInputTokens = Number(usage.input_tokens ?? 0);
  const cachedInputTokens = Number(usage.cached_input_tokens ?? 0);
  return {
    source: path.relative(home, file), sessionId, turns, compactions, userMessages, toolCalls,
    totalInputTokens, cachedInputTokens, outputTokens: Number(usage.output_tokens ?? 0),
    uncachedInputTokens: Math.max(0, totalInputTokens - cachedInputTokens),
    promptFingerprint: firstPrompt ? createHash("sha256").update(firstPrompt).digest("hex").slice(0, 16) : null,
  };
}

function buildAnalysis(totals, sessions, repeatedPromptGroups) {
  const findings = [];
  const cacheRate = totals.inputTokens ? totals.cachedInputTokens / totals.inputTokens : 0;
  const percentage = (part, whole) => whole ? `${((part / whole) * 100).toFixed(1)}%` : "0.0%";
  const intervention = (id, layer, artifact, implementation, verification, metric) => ({ id, layer, artifact, implementation, verification, metric });
  const rule = (ruleId, category, priority, title, description, evidence, insight, recommendation, interventions, signalCount) => ({ ruleId, category, priority, title, description, evidence, insight, recommendation, interventions, signalCount });
  const turnBands = [
    { label: "1–4 turns", count: sessions.filter((session) => session.turns < 5).length },
    { label: "5–14 turns", count: sessions.filter((session) => session.turns >= 5 && session.turns < 15).length },
    { label: "15+ turns", count: sessions.filter((session) => session.turns >= 15).length },
  ];
  const compactionBands = [
    { label: "No compaction", count: sessions.filter((session) => !session.compactions).length },
    { label: "One compaction", count: sessions.filter((session) => session.compactions === 1).length },
    { label: "Multiple compactions", count: sessions.filter((session) => session.compactions >= 2).length },
  ];
  if (repeatedPromptGroups.length) {
    const repeatedSessions = repeatedPromptGroups.reduce((sum, group) => sum + group.sessionCount, 0);
    findings.push(rule("KS001", "Execution control", "high", "Retry loop", "A retry loop occurs when a materially identical goal is attempted again without new evidence, a changed workspace state, or a different execution strategy.", `${repeatedSessions} sessions (${percentage(repeatedSessions, sessions.length)}) belong to ${repeatedPromptGroups.length} repeated actionable-prompt groups.`, "Repeated requests are not automatically waste, but they are a strong signal that retries can proceed without new evidence or a changed execution path.", "Before retrying a goal, require a changed failure signature, a workspace change, or explicit approval.", [
        intervention("retry-admission", "skill", "retry-admission-gate", ["Define a retry card: prior attempt, observed blocker, what changed, and next verification command.", "Require the card before an agent resumes a materially identical goal."], "Run three known retry cases; the gate must reject an unchanged retry and allow a retry with recorded new evidence.", "Repeated-prompt session share"),
        intervention("retry-admission", "harness", "retry-dedup hook", ["Fingerprint the normalized task request at session start.", "When the fingerprint recurs within a chosen window, surface the prior outcome and require a change reason."], "Track gate decisions and confirm that every admitted repeat has a recorded change reason.", "Admitted repeats without a change reason"),
      ], repeatedSessions));
  }
  const longSessions = sessions.filter((session) => session.turns >= 15);
  if (longSessions.length) findings.push(rule("KS002", "Context management", "high", "Context sprawl", "Context sprawl occurs when one session keeps accumulating turns after its goal, repository, or work mode has changed, instead of starting a bounded follow-up session.", `${longSessions.length} sessions (${percentage(longSessions.length, sessions.length)}) reached 15 or more turns.`, "Long sessions can be productive; the practical risk is carrying obsolete assumptions and tool state after the work has changed phase.", "After a goal-family or work-mode change, start a new session with a short handoff: outcome, non-goals, evidence, and next stop condition.", [
      intervention("phase-handoff", "technique", "phase-boundary handoff", ["Use a five-field handoff: achieved outcome, active decision, non-goals, verification state, next stop condition.", "Start a fresh worker session whenever the goal, repository, or execution mode changes."], "Review ten handoffs: every field must be present and the next worker must be able to run the named verification without reading the previous transcript.", "Turns after last phase change"),
      intervention("phase-handoff", "harness", "turn-budget checkpoint", ["At a configurable turn threshold, ask whether the current goal and repository are unchanged.", "If not, emit the handoff template and end the worker session."], "Simulate a repository change and confirm the checkpoint creates a handoff instead of extending the old context.", "Sessions exceeding turn budget without a handoff"),
    ], longSessions.length));
  const compactionHeavy = sessions.filter((session) => session.compactions >= 2 || (session.turns && session.compactions / session.turns >= 0.15));
  if (compactionHeavy.length) findings.push(rule("KS003", "Context management", "medium", "Context churn", "Context churn occurs when repeated context compaction forces an agent to reconstruct decisions, constraints, or verification state that should have been carried forward explicitly.", `${compactionHeavy.length} sessions (${percentage(compactionHeavy.length, sessions.length)}) have multiple or dense compactions.`, "Compaction is a normal context-management mechanism. The improvement opportunity is preserving decision-critical state so the resumed agent does not rediscover it.", "Keep summaries structured around active outcome, decisions, non-goals, verification state, and blockers; do not treat compaction count alone as a failure.", [
      intervention("compaction-contract", "skill", "context-resume-contract", ["Add a compact-before-resume template with the five decision-critical fields.", "Require a named source of truth for any unresolved decision or verification claim."], "Give a fresh agent only the compacted handoff and confirm it can identify the next action, constraint, and verification command.", "Post-compaction rediscovery turns"),
      intervention("compaction-contract", "harness", "compaction quality check", ["Detect compaction events and attach a structured checklist to the next turn.", "Flag missing outcome, blocker, or verification state for human review."], "Sample compacted sessions and score the checklist completion rate.", "Complete compaction handoffs"),
    ], compactionHeavy.length));
  if (totals.inputTokens && cacheRate < 0.30) findings.push(rule("KS004", "Prompt architecture", "medium", "Cache instability", "Cache instability occurs when durable prompt material changes position or wording often enough that the runtime cannot reuse prior context efficiently.", `Cached input is only ${(cacheRate * 100).toFixed(1)}% of reported input tokens.`, "Low reuse suggests that durable instructions or tool contracts may be changing position or wording between requests, increasing uncached context without necessarily improving quality.", "Keep durable instructions and tool contracts in a stable prefix; inject goal-specific details after it.", [
      intervention("stable-prefix", "harness", "context assembler", ["Assemble policy, tool contract, and output contract in a deterministic order.", "Append task-specific evidence after the stable block; version the stable block deliberately."], "Compare cache rate for a controlled set of equivalent tasks before and after the assembly change.", "Cache rate and uncached input per completed task"),
      intervention("stable-prefix", "technique", "prompt contract split", ["Move durable rules into a concise invariant section.", "Keep volatile task data, logs, and artifacts in a separately labeled evidence section."], "Review five prompts and verify that only the evidence section changes between equivalent runs.", "Stable-prefix change rate"),
    ], Math.round((1 - cacheRate) * sessions.length)));
  const toolCallThreshold = Math.max(50, Math.ceil((totals.toolCalls / Math.max(1, sessions.length)) * 3));
  const toolHotspots = sessions.filter((session) => session.toolCalls >= toolCallThreshold);
  if (toolHotspots.length) findings.push(rule("KS005", "Execution control", "medium", "Tool-loop hotspot", "A tool-loop hotspot occurs when a session makes unusually many tool calls without a visible decision, changed hypothesis, or completed verification step between batches.", `${toolHotspots.length} sessions (${percentage(toolHotspots.length, sessions.length)}) issued ${toolCallThreshold} or more tool calls; the threshold is three times the session average.`, "High tool volume can be legitimate for broad work. It becomes a smell when repeated inspection or failed actions replace a bounded verification loop.", "Introduce an explicit tool budget and require a decision or verification checkpoint before extending it.", [
    intervention("tool-loop", "technique", "tool-budget loop", ["State the next evidence needed before invoking a tool.", "After a small batch of calls, decide: verify, change approach, or stop for input."], "Review hotspot sessions and confirm each tool batch ends in an explicit decision rather than another unbounded search.", "Tool calls per verified outcome"),
    intervention("tool-loop", "harness", "tool-loop checkpoint", ["Count tool calls per goal phase.", "At the configured budget, prompt for the expected evidence and current hypothesis before continuing."], "Use a fixture with repeated failed calls; verify that the checkpoint asks for a hypothesis rather than silently permitting another batch.", "Tool-call budget overruns"),
  ], toolHotspots.length));
  if (!findings.length) findings.push(rule("KS000", "Qualitative review", "low", "No threshold-based optimization signal detected", "This informational rule means the current deterministic checks did not identify a common session smell; it does not certify that the operating model is optimal.", "The deterministic rules did not flag retries, long sessions, dense compaction, low cache reuse, or tool-loop hotspots.", "Absence of a threshold signal is not evidence of an optimal operating model.", "Review the highest-cost sessions qualitatively before changing prompt or runtime policy.", [intervention("qualitative-review", "technique", "session-review rubric", ["Sample the highest-cost sessions.", "Classify friction as missing context, unclear completion criteria, tool failure, or coordination overhead."], "Two reviewers should agree on the friction category for a small calibration sample.", "Reviewed high-cost sessions")], 0));
  const score = (session) => session.turns * 3 + session.compactions * 25 + Math.floor(session.toolCalls / 4) + Math.floor(session.uncachedInputTokens / 10000);
  return { cacheRate, findings, reviewCandidates: [...sessions].sort((a, b) => score(b) - score(a)).slice(0, 10), visuals: { turnBands, compactionBands }, thresholds: { longSessionTurns: 15, compactionDensity: 0.15, lowCacheRate: 0.30, toolCallHotspot: toolCallThreshold } };
}

/** Analyze a Codex JSONL home without copying its transcripts. */
export function auditCodexHome(codexHome) {
  const home = path.resolve(codexHome);
  const sessionsDirectory = path.join(home, "sessions");
  if (!existsSync(sessionsDirectory)) throw new Error(`Not a Codex home: missing sessions directory at ${sessionsDirectory}`);
  const sessions = rolloutFiles(sessionsDirectory).map((file) => auditSession(file, home));
  const promptCounts = new Map();
  for (const session of sessions) if (session.promptFingerprint) promptCounts.set(session.promptFingerprint, (promptCounts.get(session.promptFingerprint) ?? 0) + 1);
  const repeatedPromptGroups = [...promptCounts].filter(([, sessionCount]) => sessionCount > 1).sort((a, b) => b[1] - a[1]).map(([fingerprint, sessionCount]) => ({ fingerprint, sessionCount }));
  const totals = sessions.reduce((total, session) => ({ turns: total.turns + session.turns, compactions: total.compactions + session.compactions, toolCalls: total.toolCalls + session.toolCalls, inputTokens: total.inputTokens + session.totalInputTokens, cachedInputTokens: total.cachedInputTokens + session.cachedInputTokens, outputTokens: total.outputTokens + session.outputTokens }), { turns: 0, compactions: 0, toolCalls: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 });
  return { schemaVersion: 1, adapter: "codex", codexHome: home, sessionCount: sessions.length, totals, repeatedPromptGroups, sessions, analysis: buildAnalysis(totals, sessions, repeatedPromptGroups), privacy: { rawPromptTextStored: false, rawTranscriptsCopied: false, promptFingerprints: "sha256 prefix of first actionable user prompt" } };
}
