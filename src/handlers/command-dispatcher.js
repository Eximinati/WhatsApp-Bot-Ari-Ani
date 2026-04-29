const constants = require("../config/constants");
const { capitalize } = require("../utils/text");
const { maybeHandleReplyInteraction } = require("../services/reply-interactions");

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
      const userSettings = await services.settings.getUserSettings(message.sender);
      const botSettings = await services.settings.getBotSettings();
      const botJid = sock.user?.id?.split(":")[0]
        ? `${sock.user.id.split(":")[0]}@s.whatsapp.net`
        : null;
      const permission = services.permission.getPermissionContext(
        message,
        metadata,
        botJid,
        userSettings,
      );

      const moderationResult = await services.groupModeration.enforce(
        sock,
        message,
        permission,
      );
      if (moderationResult.handled) {
        return;
      }

      const handledStatusReply = await services.status.maybeResend({
        sock,
        message,
      });
      if (handledStatusReply) {
        return;
      }

      if (!services.permission.botChatAllowed(botSettings.chatMode, message)) {
        return;
      }

      if (!message.text.startsWith(config.prefix)) {
        if (services.permission.canUseBot(permission) && !userSettings.banned) {
          const handledReplyInteraction = await maybeHandleReplyInteraction({
            config,
            message,
            services,
            sock,
            userSettings,
          });
          if (handledReplyInteraction) {
            return;
          }
        }

        return;
      }

      const commandName = parseCommandName(message.text);
      if (!commandName) {
        return;
      }

      const commandLog = buildCommandLog(message, metadata, commandName);
      if (!services.permission.canUseBot(permission)) {
        logger.warn(
          { area: "ACCESS", ...commandLog, status: "private-bot-blocked" },
          "Command rejected",
        );
        await message.reply(
          "This bot is currently private. Ask an owner or mod to permit your account.",
        );
        return;
      }

      const command = services.commands.get(commandName);
      if (!command) {
        logger.warn(
          { area: "CMD", ...commandLog, status: "unknown" },
          "Command rejected",
        );
        await message.reply(
          `Unknown command: *${commandName}*. Use *${config.prefix}help* to see available commands.`,
        );
        return;
      }

      if (!services.permission.chatAllowed(command.meta.chat, message)) {
        logger.info(
          { area: "CMD", ...commandLog, resolvedCommand: command.meta.name, status: "wrong-chat" },
          "Command rejected",
        );
        const scope =
          command.meta.chat === "group" ? "This command only works in groups." : "This command only works in private chat.";
        await message.reply(scope);
        return;
      }

      if (!services.permission.hasAccess(command.meta.access, permission)) {
        logger.info(
          { area: "ACCESS", ...commandLog, resolvedCommand: command.meta.name, status: "no-access" },
          "Command rejected",
        );
        const label = capitalize(command.meta.access);
        await message.reply(`${label} permission is required for this command.`);
        return;
      }

      if (userSettings.banned) {
        logger.warn(
          { area: "ACCESS", ...commandLog, resolvedCommand: command.meta.name, status: "banned" },
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
            area: "CMD",
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
        userSettings,
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
          await services.xp.awardCommandXp(message.sender);
        }

        logger.info(
          {
            area: "CMD",
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
            area: "CMD",
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
