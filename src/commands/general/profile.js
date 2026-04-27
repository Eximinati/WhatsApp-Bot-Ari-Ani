const { mentionTag } = require("../../utils/jid");
const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "profile",
    aliases: ["p"],
    category: "general",
    description: "Show your profile, XP, and economy overview.",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
    usage: "[@user]",
  },
  async execute(ctx) {
    const targetJid =
      ctx.msg.mentions[0] || ctx.msg.quoted?.sender || ctx.msg.sender;
    const [profile, balance, wealthRank] = await Promise.all([
      ctx.services.xp.getProfile(targetJid),
      ctx.services.economy.getBalance(targetJid),
      ctx.services.economy.getWealthRank(targetJid),
    ]);
    const displayName = await ctx.services.user.getDisplayName(targetJid);

    let about = profile.bio || "No bio saved.";
    try {
      const status = await ctx.sock.fetchStatus(targetJid);
      if (status?.status) {
        about = status.status;
      }
    } catch {}

    const role =
      typeof ctx.services.xp.getDisplayedRole === "function"
        ? ctx.services.xp.getDisplayedRole(profile)
        : ctx.services.xp.getRole(profile.level);

    const lines = [
      `User: ${mentionTag(targetJid)}`,
      `XP: ${profile.xp} | Level: ${profile.level}`,
      `Role: ${role}`,
      `Job: ${balance.jobKey || "none"} | Faction: ${balance.factionKey || "none"}`,
      `Wallet: ${formatMoney(balance.wallet)} | Bank: ${formatMoney(balance.bank)}`,
      `Total Wealth: ${formatMoney(balance.totalWealth)} | Wealth Rank: #${wealthRank.rank}`,
      `Tool: ${balance.equippedToolKey || "none"} | Buffs: ${balance.activeBuffs.length}`,
      `Access: ${profile.accessState || "none"} | Streak: ${profile.streakCount || 0}`,
      `Timezone: ${profile.timezone || ctx.config.timezone}`,
      `Banned: ${profile.banned ? "yes" : "no"}`,
      `Bio: ${about}`,
    ];

    await ctx.services.visuals.sendProfileCard({
      ctx,
      title: `PROFILE | ${displayName}`,
      jid: targetJid,
      storedAvatarUrl: profile.avatarUrl,
      mentions: [targetJid],
      lines,
      caption: lines.join("\n"),
    });
  },
};
