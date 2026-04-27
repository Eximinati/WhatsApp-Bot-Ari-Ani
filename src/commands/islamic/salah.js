const {
  buildCaption,
  prayerStats,
  getCommandText,
} = require("../../utils/islamic-command-utils");

module.exports = {
  meta: {
    name: "salah",
    aliases: ["prayer"],
    category: "islamic",
    description: "Show today's prayer times for a city or your saved location.",
    cooldownSeconds: 10,
    access: "user",
    chat: "both",
    usage: "[city]",
  },
  async execute(ctx) {
    const query = getCommandText(ctx);
    const result = await ctx.services.islamic.getPrayerTimes(ctx.msg.sender, query);
    const lines = Object.entries(result.times).map(([label, value]) => `${label}: ${value}`);
    const title = `SALAH | ${result.title}`;
    await ctx.services.visuals.sendPrayerCard({
      ctx,
      title,
      lines,
      caption: buildCaption(title, lines),
      chips: [result.title, "Prayer Times"],
      stats: prayerStats(result.times),
      subtitle: result.subtitle,
    });
  },
};
