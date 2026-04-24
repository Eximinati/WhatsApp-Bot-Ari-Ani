module.exports = {
  meta: {
    name: "role",
    aliases: ["roleselect"],
    category: "games",
    description: "List or set your cosmetic profile role.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
    usage: "list | set <role>",
  },
  async execute(ctx) {
    const action = (ctx.args[0] || "list").toLowerCase();
    if (action === "list") {
      const roles = ctx.services.xp.listSelectableRoles();
      await ctx.reply(`*Selectable roles*\n${roles.map((role) => `- ${role}`).join("\n")}`);
      return;
    }

    if (action !== "set") {
      await ctx.reply("Usage: /role list or /role set <role>");
      return;
    }

    const role = ctx.args.slice(1).join(" ").trim();
    if (!role) {
      await ctx.reply("Provide a role name from /role list.");
      return;
    }

    try {
      await ctx.services.xp.setPreferredRole(ctx.msg.sender, role);
      await ctx.reply(`Your role is now *${role}*.`);
    } catch (error) {
      await ctx.reply(error.message);
    }
  },
};
