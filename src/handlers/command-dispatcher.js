const constants = require("../config/constants");
const { capitalize } = require("../utils/text");

function createCommandDispatcher({
  config,
  groupMetadataCache,
  logger,
  services,
}) {
  async function getMetadata(sock, message) {
    if (!message.isGroup) {
      return null;
    }

    return groupMetadataCache.getOrFetch(sock, message.from);
  }

  function parseCommandName(text) {
    return text.slice(config.prefix.length).trim().split(/\s+/)[0]?.toLowerCase();
  }

  function shortJid(jid) {
    return String(jid || "").split("@")[0];
  }

  function summarizeText(text, maxLength = 80) {
    if (!text) {
      return "";
    }

    return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
  }

  function buildCommandLog(message, metadata, commandName) {
    return {
      command: commandName,
      sender: shortJid(message.sender),
      senderName: message.pushName || undefined,
      chatType: message.isGroup ? "group" : "private",
      chat: message.isGroup
        ? metadata?.subject || shortJid(message.from)
        : shortJid(message.from),
      text: summarizeText(message.text),
    };
  }

  return {
    async dispatch({ sock, message }) {
      const metadata = await getMetadata(sock, message);
      const botJid = sock.user?.id?.split(":")[0]
        ? `${sock.user.id.split(":")[0]}@s.whatsapp.net`
        : null;
      const permission = services.permission.getPermissionContext(
        message,
        metadata,
        botJid,
      );

      const moderationResult = await services.groupModeration.enforce(
        sock,
        message,
        permission,
      );
      if (moderationResult.handled) {
        return;
      }

      if (!message.text.startsWith(config.prefix)) {
        return;
      }

      const commandName = parseCommandName(message.text);
      if (!commandName) {
        return;
      }

      const commandLog = buildCommandLog(message, metadata, commandName);
      const command = services.commands.get(commandName);
      if (!command) {
        logger.warn(
          { ...commandLog, status: "unknown" },
          "Command rejected",
        );
        await message.reply(
          `Unknown command: *${commandName}*. Use *${config.prefix}help* to see available commands.`,
        );
        return;
      }

      if (!services.permission.chatAllowed(command.meta.chat, message)) {
        logger.info(
          { ...commandLog, resolvedCommand: command.meta.name, status: "wrong-chat" },
          "Command rejected",
        );
        const scope =
          command.meta.chat === "group" ? "This command only works in groups." : "This command only works in private chat.";
        await message.reply(scope);
        return;
      }

      if (!services.permission.hasAccess(command.meta.access, permission)) {
        logger.info(
          { ...commandLog, resolvedCommand: command.meta.name, status: "no-access" },
          "Command rejected",
        );
        const label = capitalize(command.meta.access);
        await message.reply(`${label} permission is required for this command.`);
        return;
      }

      const userSettings = await services.settings.getUserSettings(message.sender);
      if (userSettings.banned) {
        logger.warn(
          { ...commandLog, resolvedCommand: command.meta.name, status: "banned" },
          "Command rejected",
        );
        await message.reply("You are banned from using this bot.");
        return;
      }

      const cooldown = services.cooldowns.check(
        message.sender,
        command.meta.name,
        command.meta.cooldownSeconds ?? constants.commands.defaultCooldownSeconds,
      );

      if (cooldown.active) {
        logger.info(
          {
            ...commandLog,
            resolvedCommand: command.meta.name,
            status: "cooldown",
            retryAfterSeconds: Math.ceil(cooldown.remainingMs / 1000),
          },
          "Command throttled",
        );
        await message.reply(
          `Please wait ${Math.ceil(cooldown.remainingMs / 1000)}s before using *${command.meta.name}* again.`,
        );
        return;
      }

      const args = message.text
        .slice(config.prefix.length)
        .trim()
        .split(/\s+/)
        .slice(1);
      const text = args.join(" ").trim();

      const ctx = {
        sock,
        msg: message,
        args,
        text,
        command,
        logger,
        config,
        services,
        metadata,
        permission,
        reply: (value, options = {}) => message.reply(value, options),
        send: (jid, payload, options = {}) => sock.sendMessage(jid, payload, options),
      };

      const startedAt = Date.now();
      try {
        await command.execute(ctx);
        services.cooldowns.consume(
          message.sender,
          command.meta.name,
          command.meta.cooldownSeconds ?? constants.commands.defaultCooldownSeconds,
        );

        if (command.meta.trackXp !== false) {
          await services.xp.addXp(message.sender, Math.floor(Math.random() * 4) + 1);
        }

        logger.info(
          {
            ...commandLog,
            resolvedCommand: command.meta.name,
            status: "success",
            durationMs: Date.now() - startedAt,
          },
          "Command handled",
        );
      } catch (error) {
        logger.error(
          {
            ...commandLog,
            resolvedCommand: command.meta.name,
            status: "failed",
            durationMs: Date.now() - startedAt,
            error,
          },
          "Command failed",
        );
        await message.reply("Something went wrong while running that command.");
      }
    },
  };
}

module.exports = {
  createCommandDispatcher,
};
