const MENU_VERSION = 1;
const MENU_TTL_MS = 10 * 60 * 1000;

const FORCE_PROMPT_FLAGS = new Set(["--ask", "--choose", "--format"]);

const COMMAND_CONFIGS: Record<string, any> = {
    video: {
        label: "YouTube video",
        options: [
            { mode: "video", label: "video" },
            { mode: "document", label: "document" }
        ]
    },
    play: {
        label: "YouTube audio",
        options: [
            { mode: "audio", label: "audio" },
            { mode: "document", label: "document" }
        ]
    },
    tiktok: {
        label: "TikTok video",
        options: [
            { mode: "video", label: "video" },
            { mode: "document", label: "document" }
        ]
    },
    instagram: {
        label: "Instagram video",
        options: [
            { mode: "video", label: "video" },
            { mode: "document", label: "document" }
        ]
    }
};

function parseJsonObject(raw: any): any {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed
            : {};
    } catch {
        return {};
    }
}

function sanitizeFileName(name: string, fallback: string): string {
    const value = String(name || "")
        .replace(/[\\/:*?"<>|]/g, "")
        .trim();

    return value || fallback;
}


export class MediaInteractionService {
    logger: any;
    settings: any;

    constructor({ logger, settings }: any) {
        this.logger = logger;
        this.settings = settings;
    }

    getSupportedCommands() {
        return Object.keys(COMMAND_CONFIGS);
    }

    getCommandConfig(name: string) {
        return COMMAND_CONFIGS[String(name || "").toLowerCase()] || null;
    }

    parseMediaPreferences(raw: any) {
        return parseJsonObject(raw);
    }

    parseMenuState(raw: any) {
        const parsed = parseJsonObject(raw);
        if (!parsed.step || !parsed.commandName || !parsed.chatJid) {
            return null;
        }
        return parsed;
    }

    async getPreference(userSettings: any, commandName: string) {
        const config = this.getCommandConfig(commandName);
        if (!config) return "ask";

        const preferences = this.parseMediaPreferences(
            userSettings?.mediaPreferencesJson
        );

        const value = String(
            preferences[String(commandName).toLowerCase()] || "ask"
        ).toLowerCase();

        return config.options.some((o: any) => o.mode === value)
            ? value
            : "ask";
    }

    async setPreference(userJid: string, commandName: string, mode: string) {
        const config = this.getCommandConfig(commandName);
        if (!config) throw new Error("Unsupported command");

        const userSettings = await this.settings.getUserSettings(userJid);
        const preferences = this.parseMediaPreferences(
            userSettings?.mediaPreferencesJson
        );

        preferences[String(commandName).toLowerCase()] = mode;

        await this.settings.updateUserSettings(userJid, {
            mediaPreferencesJson: JSON.stringify(preferences)
        });

        return mode;
    }

    async saveMenuState(userJid: string, state: any) {
        await this.settings.updateUserSettings(userJid, {
            mediaMenuStateJson: JSON.stringify({
                version: MENU_VERSION,
                expiresAt: Date.now() + MENU_TTL_MS,
                updatedAt: Date.now(),
                ...state
            })
        });
    }

    async clearMenuState(userJid: string) {
        await this.settings.updateUserSettings(userJid, {
            mediaMenuStateJson: ""
        });
    }

    buildFileName(media: any): string {
        const ext =
            media.messageType === "audio"
                ? ".mp3"
                : media.messageType === "video"
                ? ".mp4"
                : ".jpg";

        return sanitizeFileName(
            media.fileName || media.title || "download",
            "download"
        ) + ext;
    }

    async sendMediaByMode({
        sock,
        jid,
        quoted,
        media,
        mode
    }: any) {
        if (!sock?.sendMessage) {
            throw new Error("Client not available");
        }

        const fileName = this.buildFileName(media);

        if (media.messageType === "audio") {
            if (mode === "audio") {
                return sock.sendMessage(jid, {
                    audio: { url: media.mediaUrl },
                    mimetype: "audio/mpeg",
                    fileName,
                    contextInfo: media.contextInfo
                }, { quoted });
            }

            if (mode === "document") {
                return sock.sendMessage(jid, {
                    document: { url: media.mediaUrl },
                    mimetype: "audio/mpeg",
                    fileName,
                    contextInfo: media.contextInfo
                }, { quoted });
            }
        }

        if (media.messageType === "video") {
            if (mode === "video") {
                return sock.sendMessage(jid, {
                    video: { url: media.mediaUrl },
                    caption: media.caption
                }, { quoted });
            }

            if (mode === "document") {
                return sock.sendMessage(jid, {
                    document: { url: media.mediaUrl },
                    fileName,
                    caption: media.caption
                }, { quoted });
            }
        }

        throw new Error("Unsupported media type");
    }

    async sendOrPrompt({
        sock,
        message,
        userSettings,
        commandName,
        media,
        forcePrompt = false
    }: any) {
        const preferred = forcePrompt
            ? "ask"
            : await this.getPreference(userSettings, commandName);

        if (preferred !== "ask") {
            return this.sendMediaByMode({
                sock,
                jid: message.from,
                quoted: message.quoted,
                media,
                mode: preferred
            });
        }

        return message.reply(
            `Reply with format choice for ${commandName}`
        );
    }
}
