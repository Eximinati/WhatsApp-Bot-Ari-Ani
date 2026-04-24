const { mentionTag } = require("../../utils/jid");

module.exports = {
  meta: {
    name: "profile",
    aliases: ["p"],
    category: "general",
    description: "Show your profile, XP, and stored user settings.",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
    usage: "[@user]",
  },
  async execute(ctx) {
    const targetJid =
      ctx.msg.mentions[0] || ctx.msg.quoted?.sender || ctx.msg.sender;
    const profile = await ctx.services.xp.getProfile(targetJid);
    const displayName = await ctx.services.user.getDisplayName(targetJid);

    let about = profile.bio || "No bio saved.";
    try {
      const status = await ctx.sock.fetchStatus(targetJid);
      if (status?.status) {
        about = status.status;
      }
    } catch {}

    const lines = [
      `*Profile for ${displayName}*`,
      `User: ${mentionTag(targetJid)}`,
      `XP: ${profile.xp}`,
      `Level: ${profile.level}`,
      `Role: ${ctx.services.xp.getRole(profile.level)}`,
      `Banned: ${profile.banned ? "yes" : "no"}`,
      `Bio: ${about}`,
    ];

    await ctx.send(
      ctx.msg.from,
      {
        text: lines.join("\n"),
        mentions: [targetJid],
      },
      { quoted: ctx.msg.raw },
    );
  },
};
