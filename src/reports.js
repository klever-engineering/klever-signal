const html = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

export function markdownReport(report) {
  const { totals, analysis } = report;
  const lines = ["# Klever Signal — Codex Session Analysis", "", `- Sessions: ${report.sessionCount}`, `- Turns: ${totals.turns}`, `- Compactions: ${totals.compactions}`, `- Tool calls: ${totals.toolCalls}`, `- Input tokens: ${totals.inputTokens}`, `- Cache rate: ${(analysis.cacheRate * 100).toFixed(1)}%`, "", "## Optimization assessment", ""];
  for (const finding of analysis.findings) {
    lines.push(`### ${finding.priority.toUpperCase()}: ${finding.title}`, "", `**Evidence:** ${finding.evidence}`, "", `**Interpretation:** ${finding.insight}`, "", `**Recommended optimization:** ${finding.recommendation}`, "", "**Implementation backlog:**", "");
    for (const item of finding.interventions) {
      lines.push(`#### ${item.layer.toUpperCase()}: \`${item.artifact}\``, "", `- **Build:** ${item.implementation.join(" ")}`, `- **Verify:** ${item.verification}`, `- **Measure:** ${item.metric}`, "");
    }
  }
  lines.push("## Repeated prompt groups", "", ...(report.repeatedPromptGroups.map((group) => `- \`${group.fingerprint}\`: ${group.sessionCount} sessions`) || ["- None"]), "", "## Sessions to review", "", "| Session source | Turns | Compactions | Tool calls | Uncached input |", "| --- | ---: | ---: | ---: | ---: |");
  for (const session of analysis.reviewCandidates) lines.push(`| \`${session.source}\` | ${session.turns} | ${session.compactions} | ${session.toolCalls} | ${session.uncachedInputTokens} |`);
  lines.push("", "## Operating model", "", "1. Use one bounded goal per worker session and define an explicit verification command.", "2. Run campaign waves with a stop condition rather than an unbounded continuation instruction.", "3. Start a fresh control session after a phase change; carry forward a structured handoff.", "4. Use this report to select transcripts for qualitative review; thresholds identify signals, not root causes.");
  return `${lines.join("\n")}\n`;
}

export function htmlReport(report) {
  const { totals, analysis } = report;
  const findings = analysis.findings.map((finding) => {
    const interventions = finding.interventions.map((item) => `<section class="intervention"><h4><span>${html(item.layer)}</span> ${html(item.artifact)}</h4><p><strong>Build:</strong></p><ol>${item.implementation.map((step) => `<li>${html(step)}</li>`).join("")}</ol><p><strong>Verify:</strong> ${html(item.verification)}</p><p><strong>Measure:</strong> ${html(item.metric)}</p></section>`).join("");
    return `<article class="finding ${html(finding.priority)}"><h3>${html(finding.priority.toUpperCase())}: ${html(finding.title)}</h3><p><strong>Evidence:</strong> ${html(finding.evidence)}</p><p><strong>Interpretation:</strong> ${html(finding.insight)}</p><p><strong>Recommended optimization:</strong> ${html(finding.recommendation)}</p><h4>Implementation backlog</h4>${interventions}</article>`;
  }).join("");
  const rows = analysis.reviewCandidates.map((session) => `<tr><td><code>${html(session.source)}</code></td><td>${session.turns}</td><td>${session.compactions}</td><td>${session.toolCalls}</td><td>${session.uncachedInputTokens}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Klever Signal — Codex Session Analysis</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:1050px;margin:2rem auto;padding:0 1rem;color:#172033;background:#fbfcfe}h1,h2{color:#102a43}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem}.metric,article{background:white;border:1px solid #d9e2ec;border-radius:10px;padding:1rem}.metric b{display:block;font-size:1.5rem}article.high{border-left:5px solid #d64545}article.medium{border-left:5px solid #d99a00}article.low{border-left:5px solid #2f855a}.intervention{margin:1rem 0;padding:.8rem 1rem;background:#f7fafc;border-left:3px solid #486581}.intervention h4{margin:0}.intervention h4 span{text-transform:uppercase;font-size:.72rem;letter-spacing:.06em;color:#486581}.intervention p{margin:.5rem 0}.intervention ol{margin:.35rem 0 .6rem;padding-left:1.4rem}table{width:100%;border-collapse:collapse;background:white}td,th{padding:.6rem;border:1px solid #d9e2ec;text-align:left}code{font-size:.85em}</style></head><body><h1>Klever Signal — Codex Session Analysis</h1><p>Deterministic optimization signals from the Codex adapter. No raw prompts or transcript copies are included.</p><section class="metrics"><div class="metric"><span>Sessions</span><b>${report.sessionCount}</b></div><div class="metric"><span>Turns</span><b>${totals.turns}</b></div><div class="metric"><span>Compactions</span><b>${totals.compactions}</b></div><div class="metric"><span>Tool calls</span><b>${totals.toolCalls}</b></div><div class="metric"><span>Cache rate</span><b>${(analysis.cacheRate * 100).toFixed(1)}%</b></div></section><h2>Prioritized optimizations</h2>${findings}<h2>Sessions to review</h2><table><thead><tr><th>Session source</th><th>Turns</th><th>Compactions</th><th>Tool calls</th><th>Uncached input</th></tr></thead><tbody>${rows}</tbody></table><h2>Interpretation boundary</h2><p>These thresholds prioritize human review. They do not establish that a compaction, long session, or repeated prompt caused an outcome.</p></body></html>`;
}
