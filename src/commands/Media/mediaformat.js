function renderPreferences(preferences) {
  return [
    "*Media Format Preferences*",
    ...preferences.map((entry) => {
      const current = entry.mode === "ask" ? "ask every time" : entry.mode;
      return `- /${entry.commandName}: ${current} (supports: ${entry.options.join(", ")})`;
    }),
    "",
    "Use:",
    "- /mediaformat set <command> <mode>",
    "- /mediaformat reset <command>",
    "- /mediaformat resetall",
  ].join("\n");
}

module.exports = {
  meta: {
    name: "mediaformat",
    aliases: ["mediapref", "mpref", "formatpref"],
    category: "media",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
    usage: "[set <command> <mode> | reset <command> | resetall]",
    description: "View or manage remembered media download formats.",
  },

  async execute(ctx) {
    const media = ctx.services.media;
    const action = String(ctx.args[0] || "").toLowerCase();

    if (!action) {
      const freshSettings = await ctx.services.settings.getUserSettings(ctx.msg.sender);
      await ctx.reply(renderPreferences(media.describePreferences(freshSettings)));
      return;
    }

    if (action === "resetall") {
      await media.resetAllPreferences(ctx.msg.sender);
      await ctx.reply("All remembered media format preferences were cleared. The bot will ask again.");
      return;
    }

    const commandName = String(ctx.args[1] || "").toLowerCase();
    if (!media.getCommandConfig(commandName)) {
      await ctx.reply(
        `Supported commands: ${media.getSupportedCommands().map((name) => `/${name}`).join(", ")}.`,
      );
      return;
    }

    if (action === "reset") {
      await media.resetPreference(ctx.msg.sender, commandName);
      await ctx.reply(`Preference for */${commandName}* cleared. The bot will ask again next time.`);
      return;
    }

    if (action === "set") {
      const mode = String(ctx.args[2] || "").toLowerCase();
      if (!mode) {
        const options = media.getCommandConfig(commandName).options.map((option) => option.mode).join("|");
        await ctx.reply(`Usage: */mediaformat set ${commandName} <ask|${options}>*`);
        return;
      }

      try {
        await media.setPreference(ctx.msg.sender, commandName, mode);
      } catch (error) {
        await ctx.reply(error.message || "Invalid media format choice.");
        return;
      }
      await ctx.reply(
        mode === "ask"
          ? `Preference for */${commandName}* set to ask every time.`
          : `Preference for */${commandName}* saved as *${mode}*.`,
      );
      return;
    }

    await ctx.reply("Use */mediaformat*, */mediaformat set <command> <mode>*, */mediaformat reset <command>*, or */mediaformat resetall*.");
  },
};
