const MENU_VERSION = 1;
const MENU_TTL_MS = 10 * 60 * 1000;

const FORCE_PROMPT_FLAGS = new Set(["--ask", "--choose", "--format"]);

const COMMAND_CONFIGS = {
  video: {
    label: "YouTube video",
    options: [
      { mode: "video", label: "video" },
      { mode: "document", label: "document" },
    ],
  },
  play: {
    label: "YouTube audio",
    options: [
      { mode: "audio", label: "audio" },
      { mode: "document", label: "document" },
    ],
  },
  tiktok: {
    label: "TikTok video",
    options: [
      { mode: "video", label: "video" },
      { mode: "document", label: "document" },
    ],
  },
  instagram: {
    label: "Instagram video",
    options: [
      { mode: "video", label: "video" },
      { mode: "document", label: "document" },
    ],
  },
};

function parseJsonObject(raw) {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function sanitizeFileName(name, fallback) {
  const value = String(name || "").replace(/[\\/:*?"<>|]/g, "").trim();
  return value || fallback;
}

class MediaInteractionService {
  constructor({ logger, settings }) {
    this.logger = logger;
    this.settings = settings;
  }

  getSupportedCommands() {
    return Object.keys(COMMAND_CONFIGS);
  }

  getCommandConfig(commandName) {
    return COMMAND_CONFIGS[String(commandName || "").toLowerCase()] || null;
  }

  parseMediaPreferences(raw) {
    return parseJsonObject(raw);
  }

  parseMenuState(raw) {
    const parsed = parseJsonObject(raw);
    if (!parsed.step || !parsed.commandName || !parsed.chatJid) {
      return null;
    }
    return parsed;
  }

  getPreference(userSettings, commandName) {
    const config = this.getCommandConfig(commandName);
    if (!config) {
      return "ask";
    }

    const preferences = this.parseMediaPreferences(userSettings?.mediaPreferencesJson);
    const value = String(preferences[String(commandName || "").toLowerCase()] || "ask").toLowerCase();
    return config.options.some((option) => option.mode === value) ? value : "ask";
  }

  async setPreference(userJid, commandName, mode) {
    const config = this.getCommandConfig(commandName);
    if (!config) {
      throw new Error(`Unsupported media command: ${commandName}`);
    }

    const normalizedMode = String(mode || "").toLowerCase();
    if (normalizedMode !== "ask" && !config.options.some((option) => option.mode === normalizedMode)) {
      throw new Error(`Unsupported media mode for ${commandName}: ${mode}`);
    }

    const userSettings = await this.settings.getUserSettings(userJid);
    const preferences = this.parseMediaPreferences(userSettings?.mediaPreferencesJson);
    preferences[String(commandName || "").toLowerCase()] = normalizedMode;
    await this.settings.updateUserSettings(userJid, {
      mediaPreferencesJson: JSON.stringify(preferences),
    });
    return normalizedMode;
  }

  async resetPreference(userJid, commandName) {
    const config = this.getCommandConfig(commandName);
    if (!config) {
      throw new Error(`Unsupported media command: ${commandName}`);
    }

    const userSettings = await this.settings.getUserSettings(userJid);
    const preferences = this.parseMediaPreferences(userSettings?.mediaPreferencesJson);
    delete preferences[String(commandName || "").toLowerCase()];
    await this.settings.updateUserSettings(userJid, {
      mediaPreferencesJson: JSON.stringify(preferences),
    });
  }

  async resetAllPreferences(userJid) {
    await this.settings.updateUserSettings(userJid, {
      mediaPreferencesJson: "",
    });
  }

  describePreferences(userSettings) {
    return this.getSupportedCommands().map((commandName) => {
      const config = this.getCommandConfig(commandName);
      return {
        commandName,
        label: config.label,
        mode: this.getPreference(userSettings, commandName),
        options: config.options.map((option) => option.mode),
      };
    });
  }

  extractControlFlags(args = []) {
    const cleanArgs = [];
    let forcePrompt = false;

    for (const value of args) {
      if (FORCE_PROMPT_FLAGS.has(String(value || "").toLowerCase())) {
        forcePrompt = true;
        continue;
      }

      cleanArgs.push(value);
    }

    return {
      args: cleanArgs,
      forcePrompt,
    };
  }

  async saveMenuState(userJid, state) {
    await this.settings.updateUserSettings(userJid, {
      mediaMenuStateJson: JSON.stringify({
        version: MENU_VERSION,
        expiresAt: Date.now() + MENU_TTL_MS,
        updatedAt: Date.now(),
        ...state,
      }),
    });
  }

  async clearMenuState(userJid) {
    await this.settings.updateUserSettings(userJid, {
      mediaMenuStateJson: "",
    });
  }

  createFormatActions(commandName) {
    const config = this.getCommandConfig(commandName);
    if (!config) {
      return {};
    }

    const [primary, secondary] = config.options;
    return {
      "1": { mode: primary.mode, remember: false },
      "2": { mode: primary.mode, remember: true },
      "3": { mode: secondary.mode, remember: false },
      "4": { mode: secondary.mode, remember: true },
    };
  }

  renderFormatMenu(commandName, media) {
    const config = this.getCommandConfig(commandName);
    if (!config) {
      return "Reply with a valid number.";
    }

    const [primary, secondary] = config.options;
    const title = media?.title || "this media";
    return [
      `*${config.label} format*`,
      title,
      "",
      `1. Send as ${primary.label}`,
      `2. Always send /${commandName} as ${primary.label}`,
      `3. Send as ${secondary.label}`,
      `4. Always send /${commandName} as ${secondary.label}`,
      "0. Cancel",
      "",
      "Reply with a number.",
    ].join("\n");
  }

  buildFileName(media) {
    const extension = media.messageType === "audio"
      ? ".mp3"
      : media.messageType === "image"
        ? ".jpg"
        : ".mp4";

    if (media.fileName) {
      return sanitizeFileName(media.fileName, `download${extension}`);
    }

    return `${sanitizeFileName(media.title, "download")}${extension}`;
  }

  async sendMediaByMode({
    sock,
    jid,
    quoted,
    media,
    mode,
  }) {
    if (!sock?.sendMessage) {
      throw new Error("WhatsApp client not available.");
    }

    if (!media?.mediaUrl) {
      throw new Error("No media URL is available to send.");
    }

    const messageType = media.messageType;
    const fileName = this.buildFileName(media);
    const options = quoted ? { quoted } : {};

    if (messageType === "audio") {
      if (mode === "audio") {
        return sock.sendMessage(
          jid,
          {
            audio: { url: media.mediaUrl },
            mimetype: media.mimetype || "audio/mpeg",
            ptt: false,
            fileName,
            contextInfo: media.contextInfo,
          },
          options,
        );
      }

      if (mode === "document") {
        return sock.sendMessage(
          jid,
          {
            document: { url: media.mediaUrl },
            mimetype: media.mimetype || "audio/mpeg",
            fileName,
            contextInfo: media.contextInfo,
          },
          options,
        );
      }
    }

    if (messageType === "video") {
      if (mode === "video") {
        return sock.sendMessage(
          jid,
          {
            video: { url: media.mediaUrl },
            mimetype: media.mimetype || "video/mp4",
            caption: media.caption,
          },
          options,
        );
      }

      if (mode === "document") {
        return sock.sendMessage(
          jid,
          {
            document: { url: media.mediaUrl },
            mimetype: media.mimetype || "video/mp4",
            fileName,
            caption: media.caption,
          },
          options,
        );
      }
    }

    if (messageType === "image") {
      return sock.sendMessage(
        jid,
        {
          image: { url: media.mediaUrl },
          caption: media.caption,
        },
        options,
      );
    }

    throw new Error(`Unsupported media mode ${mode} for ${messageType || "unknown"} content.`);
  }

  async promptFormatChoice({
    sock,
    message,
    userJid,
    chatJid,
    commandName,
    media,
  }) {
    await this.saveMenuState(userJid, {
      step: "format",
      commandName,
      chatJid,
      media,
    });

    return message.reply(this.renderFormatMenu(commandName, media));
  }

  async sendOrPrompt({
    sock,
    message,
    userSettings,
    commandName,
    media,
    forcePrompt = false,
  }) {
    const config = this.getCommandConfig(commandName);
    if (!config) {
      throw new Error(`Unsupported media command: ${commandName}`);
    }

    const preferred = forcePrompt ? "ask" : this.getPreference(userSettings, commandName);
    if (preferred !== "ask") {
      return this.sendMediaByMode({
        sock,
        jid: message.from,
        quoted: message.quoted || null,
        media,
        mode: preferred,
      });
    }

    return this.promptFormatChoice({
      sock,
      message,
      userJid: message.sender,
      chatJid: message.from,
      commandName,
      media,
    });
  }

  async maybeHandleReply({
    config,
    message,
    sock,
    userSettings,
  }) {
    const state = this.parseMenuState(userSettings?.mediaMenuStateJson);
    if (!state || !message.text) {
      return false;
    }

    const text = String(message.text || "").trim();
    if (!text || text.startsWith(config.prefix)) {
      return false;
    }

    if (Date.now() > Number(state.expiresAt || 0)) {
      await this.clearMenuState(message.sender);
      await message.reply("That media choice expired. Run the command again.");
      return true;
    }

    if (state.chatJid !== message.from) {
      return false;
    }

    const choice = text.toLowerCase();
    if (!/^\d+$/.test(choice) && !["back", "menu", "cancel", "exit"].includes(choice)) {
      return false;
    }

    if (["0", "back", "menu", "cancel", "exit"].includes(choice)) {
      await this.clearMenuState(message.sender);
      await message.reply("Media format menu closed.");
      return true;
    }

    if (state.step !== "format") {
      return false;
    }

    const actions = this.createFormatActions(state.commandName);
    const action = actions[choice];
    if (!action) {
      await message.reply("Reply with a valid number from the media format menu.");
      return true;
    }

    await this.clearMenuState(message.sender);

    if (action.remember) {
      await this.setPreference(message.sender, state.commandName, action.mode);
    }

    await this.sendMediaByMode({
      sock,
      jid: state.chatJid,
      quoted: message,
      media: state.media,
      mode: action.mode,
    });

    if (action.remember) {
      await message.reply(
        `Saved /${state.commandName} preference: *${action.mode}*. Use */mediaformat reset ${state.commandName}* to ask again.`,
      );
    }

    return true;
  }
}

module.exports = {
  MediaInteractionService,
};
