const constants = require("../../config/constants");
const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "slot",
    aliases: ["slots"],
    category: "games",
    description: "Spin the slot machine for XP and cash.",
    cooldownSeconds: 4,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const result = ctx.services.games.playSlot();
    const reward = constants.economy.gameRewards.slot[result.outcome];
    const [displayName, profile, balance] = await Promise.all([
      ctx.services.user.getDisplayName(ctx.msg.sender),
      ctx.services.xp.addXp(ctx.msg.sender, reward.xp),
      ctx.services.economy.rewardGame(ctx.msg.sender, reward),
    ]);

    await ctx.services.visuals.sendQuoteCard({
      ctx,
      title: "SLOT SPIN",
      jid: ctx.msg.sender,
      username: displayName,
      storedAvatarUrl: profile.profile.avatarUrl,
      lines: [
        `Reel: ${result.roll.join(" ")}`,
        `Outcome: ${result.outcome.toUpperCase()}`,
        `Reward: +${reward.xp} XP | +${formatMoney(reward.cash)}`,
        `Wallet: ${formatMoney(balance.wallet)}`,
      ],
      color: result.outcome === "jackpot" ? "#fbbf24" : result.outcome === "pair" ? "#60a5fa" : "#94a3b8",
      caption: `Slot result | ${result.outcome}`,
    });
  },
};
