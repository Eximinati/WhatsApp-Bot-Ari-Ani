const canvacord = require("canvacord");

module.exports = {
  meta: {
    name: "rank",
    aliases: ["xp"],
    category: "general",
    description: "Render your current XP rank card.",
    cooldownSeconds: 8,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const rank = await ctx.services.xp.getRank(ctx.msg.sender);
    const displayName = await ctx.services.user.getDisplayName(ctx.msg.sender);
    const discriminator = ctx.msg.sender.split("@")[0].slice(-4);

    let avatar;
    try {
      avatar = await ctx.sock.profilePictureUrl(ctx.msg.sender, "image");
    } catch {
      avatar = "https://placehold.co/256x256/png";
    }

    try {
      const card = await new canvacord.Rank()
        .setAvatar(avatar)
        .setCurrentXP(rank.currentXp)
        .setRequiredXP(rank.nextLevelXp)
        .setLevel(rank.level)
        .setUsername(displayName)
        .setDiscriminator(discriminator)
        .setRank(0, rank.rankTitle, false)
        .setBackground("COLOR", "#1f2937")
        .setProgressBar("#38bdf8", "COLOR")
        .build();

      await ctx.send(
        ctx.msg.from,
        { image: card, caption: `${displayName} is level ${rank.level}.` },
        { quoted: ctx.msg.raw },
      );
    } catch {
      await ctx.reply(
        `Rank: level ${rank.level}\nXP: ${rank.currentXp}/${rank.nextLevelXp}\nRole: ${rank.rankTitle}`,
      );
    }
  },
};
