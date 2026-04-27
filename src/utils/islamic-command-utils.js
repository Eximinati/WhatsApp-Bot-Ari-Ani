function getCommandText(ctx) {
  return String(ctx.text || ctx.args.join(" ") || "").trim();
}

function requireInput(ctx, text, hint) {
  if (text) {
    return true;
  }
  return ctx.reply(hint);
}

function compactLines(lines, limit = 10) {
  return (Array.isArray(lines) ? lines : []).filter(Boolean).slice(0, limit);
}

function buildCaption(title, lines) {
  return [`*${title}*`, ...compactLines(lines, 12)].join("\n");
}

function citationSummary(citations = []) {
  return citations
    .map((citation) => citation.label || citation.ref || citation.type)
    .filter(Boolean)
    .slice(0, 4)
    .join(" | ");
}

function prayerStats(times = {}) {
  return Object.entries(times)
    .slice(0, 5)
    .map(([label, value]) => ({ label, value: String(value) }));
}

function takeTop(lines, limit = 3) {
  return (Array.isArray(lines) ? lines : []).filter(Boolean).slice(0, limit);
}

module.exports = {
  buildCaption,
  citationSummary,
  compactLines,
  getCommandText,
  prayerStats,
  requireInput,
  takeTop,
};
