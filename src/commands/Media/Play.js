const axios = require("axios");
const yts = require("yt-search");

module.exports = {
  meta: {
    name: "play",
    aliases: ["yta", "song", "ytaudio", "playaudio"],
    category: "media",
    description: "Download and play audio from YouTube.",
    cooldownSeconds: 10,
    access: "user",
    chat: "both",
    usage: "<song name/link> [--ask]",
  },

  async execute(ctx) {
    const client = ctx.client || ctx.sock || ctx.conn;
    const msg = ctx.msg;
    const jid = msg?.key?.remoteJid || ctx.from;

    if (!client?.sendMessage) {
      return ctx.reply("❌ WhatsApp client not available.");
    }

    const { args, forcePrompt } = ctx.services.media.extractControlFlags(ctx.args);
    const arg = args.join(" ").trim();
    if (!arg) {
      return ctx.reply("❗ Provide a YouTube link or song name.");
    }

    try {
      let info;
      let url;

      const validYT = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//;
      const isLink = validYT.test(arg);

      if (isLink) {
        const idMatch = arg.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
        if (!idMatch) {
          return ctx.reply("❗ Invalid YouTube link.");
        }

        info = await yts({ videoId: idMatch[1] });
        url = arg.trim();
      } else {
        const { videos } = await yts(arg);
        if (!videos?.length) {
          return ctx.reply("❗ Song not found.");
        }

        info = videos[0];
        url = info.url;
      }

      await ctx.reply(`🎵 Preparing: *${info.title}*`);

      let mediaUrl = "";

      try {
        const { data } = await axios.get(
          `https://apis.davidcyril.name.ng/play?query=${encodeURIComponent(url)}`,
          { timeout: 120000 },
        );

        if (data?.status && data?.result?.download_url) {
          mediaUrl = data.result.download_url;
        }
      } catch (error) {
        console.log("play API1 failed:", error.message);
      }

      if (!mediaUrl) {
        try {
          const apiBase = "https://space2bnhz.tail9ef80b.ts.net";
          const response = await axios.post(
            `${apiBase}/song/download`,
            { title: info.title },
            { timeout: 120000 },
          );

          if (response.data?.file_url) {
            mediaUrl = response.data.file_url.replace("http://127.0.0.1:5000", apiBase);
          }
        } catch (error) {
          console.log("play API2 failed:", error.message);
        }
      }

      if (!mediaUrl) {
        try {
          const { data } = await axios.get(
            `https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(url)}`,
            { timeout: 120000 },
          );

          mediaUrl = data?.result?.download || data?.download || data?.url || "";
        } catch (error) {
          console.log("play API3 failed:", error.message);
        }
      }

      if (!mediaUrl) {
        return ctx.reply("❌ All download sources failed.");
      }

      return ctx.services.media.sendOrPrompt({
        sock: client,
        message: {
          from: jid,
          sender: msg?.sender || ctx.msg.sender,
          reply: ctx.reply,
          quoted: msg,
        },
        userSettings: ctx.userSettings,
        commandName: "play",
        forcePrompt,
        media: {
          title: info.title,
          mediaUrl,
          messageType: "audio",
          mimetype: "audio/mpeg",
          fileName: `${info.title}.mp3`,
          contextInfo: {
            externalAdReply: {
              title: info.title,
              body: info.author?.name || "Music",
              thumbnailUrl: info.thumbnail,
              mediaType: 2,
              mediaUrl: url,
              sourceUrl: url,
            },
          },
        },
      });
    } catch (error) {
      console.error("Play Command Error:", error);
      return ctx.reply("❌ Unexpected error occurred.");
    }
  },
};
