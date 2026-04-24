module.exports = {
  meta: {
    name: "groupinfo",
    aliases: ["gcinfo"],
    category: "group",
    description: "Show metadata for the current group.",
    cooldownSeconds: 5,
    access: "user",
    chat: "group",
    usage: "",
  },
  async execute(ctx) {
    const metadata = ctx.metadata || (await ctx.sock.groupMetadata(ctx.msg.from));
    await ctx.reply(
      [
        `*${metadata.subject}*`,
        `Members: ${metadata.participants.length}`,
        `Description: ${metadata.desc || "No description set."}`,
        `Invite approval: ${metadata.joinApprovalMode ? "enabled" : "disabled"}`,
        `Announce mode: ${metadata.announce ? "admins only" : "all members"}`,
      ].join("\n"),
    );
  },
};
