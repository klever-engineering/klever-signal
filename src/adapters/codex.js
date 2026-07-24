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
  if (repeatedPromptGroups.length) {
    const repeatedSessions = repeatedPromptGroups.reduce((sum, group) => sum + group.sessionCount, 0);
    findings.push({ priority: "high", title: "Add retry admission gates for repeated prompts", evidence: `${repeatedSessions} sessions belong to ${repeatedPromptGroups.length} repeated actionable-prompt groups.`, recommendation: "Before retrying a goal, require a changed failure signature, a workspace change, or explicit approval." });
  }
  const longSessions = sessions.filter((session) => session.turns >= 15);
  if (longSessions.length) findings.push({ priority: "high", title: "Split long control sessions at phase boundaries", evidence: `${longSessions.length} sessions reached 15 or more turns.`, recommendation: "After a goal-family or work-mode change, start a new session with a short handoff: outcome, non-goals, evidence, and next stop condition." });
  const compactionHeavy = sessions.filter((session) => session.compactions >= 2 || (session.turns && session.compactions / session.turns >= 0.15));
  if (compactionHeavy.length) findings.push({ priority: "medium", title: "Review compaction-trigger policy and handoff quality", evidence: `${compactionHeavy.length} sessions have multiple or dense compactions.`, recommendation: "Keep summaries structured around active outcome, decisions, non-goals, verification state, and blockers; do not treat compaction count alone as a failure." });
  if (totals.inputTokens && cacheRate < 0.30) findings.push({ priority: "medium", title: "Stabilize repeated prompt prefixes for caching", evidence: `Cached input is only ${(cacheRate * 100).toFixed(1)}% of reported input tokens.`, recommendation: "Keep durable instructions and tool contracts in a stable prefix; inject goal-specific details after it." });
  if (!findings.length) findings.push({ priority: "low", title: "No threshold-based optimization signal detected", evidence: "The deterministic rules did not flag retries, long sessions, dense compaction, or low cache reuse.", recommendation: "Review the highest-cost sessions qualitatively before changing prompt or runtime policy." });
  const score = (session) => session.turns * 3 + session.compactions * 25 + Math.floor(session.toolCalls / 4) + Math.floor(session.uncachedInputTokens / 10000);
  return { cacheRate, findings, reviewCandidates: [...sessions].sort((a, b) => score(b) - score(a)).slice(0, 10), thresholds: { longSessionTurns: 15, compactionDensity: 0.15, lowCacheRate: 0.30 } };
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
