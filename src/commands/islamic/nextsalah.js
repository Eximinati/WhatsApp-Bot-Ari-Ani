const {
  buildCaption,
  prayerStats,
  getCommandText,
} = require("../../utils/islamic-command-utils");

module.exports = {
  meta: {
    name: "nextsalah",
    aliases: ["nextprayer"],
    category: "islamic",
    description: "Show the next prayer and countdown using a city or saved location.",
    cooldownSeconds: 10,
    access: "user",
    chat: "both",
    usage: "[city]",
  },
  async execute(ctx) {
    const query = getCommandText(ctx);
    const result = await ctx.services.islamic.getNextPrayer(ctx.msg.sender, query);
    const lines = [
      `Next prayer: ${result.nextPrayer}`,
      `Time left: ${result.countdown}`,
      ...Object.entries(result.times).map(([label, value]) => `${label}: ${value}`),
    ];
    const title = `NEXT SALAH | ${result.title}`;
    await ctx.services.visuals.sendPrayerCard({
      ctx,
      title,
      lines,
      caption: buildCaption(title, lines),
      chips: [result.nextPrayer, result.countdown],
      stats: prayerStats(result.times),
      subtitle: result.subtitle,
    });
  },
};
