module.exports = {
  meta: {
    name: "bot",
    aliases: ["botmode"],
    category: "access",
    description: "Show or change whether the bot works in all chats or private chats only.",
    cooldownSeconds: 3,
    access: "owner",
    chat: "private",
    usage: "[status|private|all]",
  },
  async execute(ctx) {
    const action = String(ctx.args[0] || "status").toLowerCase();

    if (!["status", "private", "all"].includes(action)) {
      await ctx.reply(`Usage: ${ctx.config.prefix}bot <status|private|all>`);
      return;
    }

    if (action === "status") {
      const settings = await ctx.services.settings.getBotSettings();
      await ctx.reply(
        [
          "*Bot mode*",
          `Current mode: *${settings.chatMode}*`,
          settings.chatMode === "private"
            ? "The bot only responds in private chat right now."
            : "The bot responds in both private chats and groups.",
        ].join("\n"),
      );
      return;
    }

    const settings = await ctx.services.settings.setBotChatMode(action);
    ctx.logger.info(
      {
        area: "ACCESS",
        actor: ctx.msg.sender.split("@")[0],
        chatMode: settings.chatMode,
      },
      "Bot chat mode updated",
    );

    await ctx.reply(
      settings.chatMode === "private"
        ? "Bot mode updated to *private*. I will only respond in private chat now."
        : "Bot mode updated to *all*. I will respond in both private chats and groups.",
    );
  },
};
