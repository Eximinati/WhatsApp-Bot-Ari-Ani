module.exports = {
  meta: {
    name: "slot",
    aliases: ["slots"],
    category: "games",
    description: "Spin the slot machine for XP.",
    cooldownSeconds: 4,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const result = ctx.services.games.playSlot();
    const rewards = {
      jackpot: 25,
      pair: 8,
      miss: 1,
    };
    await ctx.services.xp.addXp(ctx.msg.sender, rewards[result.outcome]);
    await ctx.reply(
      `${result.roll.join(" ")}\nResult: *${result.outcome}*\nXP: *+${rewards[result.outcome]}*`,
    );
  },
};
