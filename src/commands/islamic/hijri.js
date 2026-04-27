const { getCommandText } = require("../../utils/islamic-command-utils");

module.exports = {
  meta: {
    name: "hijri",
    aliases: ["islamicdate"],
    category: "islamic",
    description: "Show the current Hijri date or convert using your saved prayer location.",
    cooldownSeconds: 8,
    access: "user",
    chat: "both",
    usage: "[date]",
  },
  async execute(ctx) {
    const query = getCommandText(ctx);
    const result = await ctx.services.islamic.getHijri(ctx.msg.sender, query);
    const lines = Object.entries(result)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .slice(0, 8)
      .map(([label, value]) => `${label}: ${value}`);
    await ctx.services.visuals.sendIslamicAnswerCard({
      ctx,
      title: "HIJRI DATE",
      lines,
      caption: ["*HIJRI DATE*", ...lines].join("\n"),
      chips: ["Hijri", query || "Today"],
      stats: lines.slice(0, 4).map((line, index) => ({
        label: index === 0 ? "Primary" : `Info ${index}`,
        value: line.slice(0, 24),
      })),
      subtitle: "Islamic calendar lookup",
    });
  },
};
