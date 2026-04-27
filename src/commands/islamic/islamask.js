const { getCommandText, requireInput } = require("../../utils/islamic-command-utils");

function formatEvidenceBlock(title, items = [], { includeGrade = false } = {}) {
  if (!items.length) {
    return [];
  }

  return [
    title,
    ...items.map((item, index) => {
      const parts = [
        `${index + 1}. ${item.ref || item.label}`,
        item.excerptEn ? `EN: ${item.excerptEn}` : "",
        item.excerptUr ? `UR: ${item.excerptUr}` : "",
        includeGrade && item.grade ? `Status: ${item.grade}` : "",
        item.url ? `Link: ${item.url}` : item.sourceUrl ? `Link: ${item.sourceUrl}` : "",
      ].filter(Boolean);
      return parts.join("\n");
    }),
  ];
}

function formatMadhhabBlock(items = []) {
  if (!items.length) {
    return [];
  }

  return [
    "Four Sunni schools:",
    ...items.map(
      (item, index) =>
        `${index + 1}. ${item.school} (${item.imam})\nEN: ${item.summaryEn}\nUR: ${item.summaryUr}${
          item.sourceUrl ? `\nLink: ${item.sourceUrl}` : ""
        }`,
    ),
  ];
}

function formatKhulafaBlock(items = []) {
  if (!items.length) {
    return [
      "Khulafa practice:",
      "No direct, topic-specific Khulafa practice report was verified in the current curated source set for making this issue decisive.",
    ];
  }

  return [
    "Khulafa practice:",
    ...items.map(
      (item, index) =>
        `${index + 1}. ${item.name}\nEN: ${item.summaryEn}\nUR: ${item.summaryUr}${
          item.sourceUrl ? `\nLink: ${item.sourceUrl}` : ""
        }`,
    ),
  ];
}

function formatScholarNotes(items = []) {
  if (!items.length) {
    return [];
  }

  return [
    "Scholar note:",
    ...items.slice(0, 2).map(
      (item, index) =>
        `${index + 1}. ${item.label}\nEN: ${item.summaryEn}\nUR: ${item.summaryUr}${
          item.sourceUrl ? `\nLink: ${item.sourceUrl}` : ""
        }`,
    ),
  ];
}

function formatSourceLinks(items = []) {
  if (!items.length) {
    return [];
  }
  return [
    "Source links:",
    ...items.map((item, index) => `${index + 1}. ${item.label}\n${item.url || item.sourceUrl}`),
  ];
}

function joinSections(sections = []) {
  return sections
    .filter((section) => Array.isArray(section) ? section.some(Boolean) : section)
    .map((section) => (Array.isArray(section) ? section.filter(Boolean).join("\n") : section))
    .join("\n\n");
}

module.exports = {
  meta: {
    name: "islamask",
    aliases: ["askislam"],
    category: "islamic",
    description: "Answer only from Quran, Hadith, and curated Rashidun sources with citations.",
    cooldownSeconds: 10,
    access: "user",
    chat: "both",
    usage: "<question>",
  },
  async execute(ctx) {
    const question = getCommandText(ctx);
    if (!(await requireInput(ctx, question, "Use /islamask why is salah important?"))) {
      return;
    }

    const settings = await ctx.services.islamic.getUserIslamicSettings(ctx.msg.sender);
    const result = await ctx.services.islamic.answerIslamicQuestion(question, settings);
    if (!result.ok) {
      await ctx.reply(result.message);
      return;
    }

    const title =
      result.questionType === "fiqh-dispute"
        ? "*ISLAMIC ANSWER | FIQH DIFFERENCE*"
        : "*ISLAMIC ANSWER*";

    const message = joinSections([
      [
        title,
        `Question: ${question}`,
        result.issueTitle ? `Issue: ${result.issueTitle}` : "",
        result.issueTitleUr ? `Issue UR: ${result.issueTitleUr}` : "",
        result.questionType ? `Type: ${String(result.questionType).replace(/-/g, " ")}` : "",
      ],
      [
        `Answer EN: ${result.answerEn}`,
        result.answerUr ? `Answer UR: ${result.answerUr}` : "",
      ],
      formatEvidenceBlock("Quran basis:", (result.quranEvidence || []).slice(0, 2)),
      formatEvidenceBlock("Hadith evidence:", (result.hadithEvidence || []).slice(0, 3), {
        includeGrade: true,
      }),
      result.questionType === "fiqh-dispute"
        ? formatMadhhabBlock(result.madhhabViews || [])
        : [],
      result.questionType === "fiqh-dispute"
        ? formatKhulafaBlock(result.khulafaPractice || [])
        : [],
      formatScholarNotes(result.scholarNotes || []),
      result.safetyNote ? [`Safety note: ${result.safetyNote}`] : [],
      formatSourceLinks(result.sourceLinks || []),
    ]);

    await ctx.reply(message);
  },
};
