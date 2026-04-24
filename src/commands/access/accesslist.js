module.exports = {
  meta: {
    name: "accesslist",
    aliases: ["permits"],
    category: "access",
    description: "Show allowed and trusted bot users.",
    cooldownSeconds: 5,
    access: "staff",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const records = await ctx.services.settings.listAccessUsers();
    if (!records.length) {
      await ctx.reply("No users are currently permitted.");
      return;
    }

    const lines = ["*Bot access list*"];
    for (const record of records) {
      lines.push(`- ${record.jid.split("@")[0]}: ${record.accessState}`);
    }
    await ctx.reply(lines.join("\n"));
  },
};
