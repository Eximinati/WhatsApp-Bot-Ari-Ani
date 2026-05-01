const axios = require("axios");
const yts = require("yt-search");

module.exports = {
  meta: {
    name: "video",
    aliases: ["ytvideo", "mp4", "ytv"],
    category: "media",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
    usage: "video <youtube link or name> [--ask]",
    description: "Download YouTube videos",
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
      return ctx.reply("❗ Provide a YouTube link or video name.");
    }

    const validYT = /^https?:\/\/(youtu\.be\/|(www\.)?youtube\.com\/(embed|v|shorts|watch))/;
    const isLink = validYT.test(arg);
    let info;
    let url;

    try {
      const search = async (term) => {
        const { videos } = await yts(term.trim());
        return videos?.length ? videos[0] : null;
      };

      if (isLink) {
        const idMatch = arg.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
        if (!idMatch) {
          return ctx.reply("❗ Invalid YouTube link.");
        }

        info = await yts({ videoId: idMatch[1] });
        url = arg.trim();
      } else {
        info = await search(arg);
        url = info?.url;
      }

      if (!info || !url) {
        return ctx.reply("❗ Could not retrieve video details.");
      }

      await ctx.reply(`🎬 Preparing video: *${info.title}*`);

      let mediaUrl = "";

      try {
        const { data } = await axios.get(
          `https://apis.davidcyril.name.ng/youtube/mp4?url=${encodeURIComponent(url)}`,
          { timeout: 120000 },
        );

        if (data?.status && data?.result?.download_url) {
          mediaUrl = data.result.download_url;
        }
      } catch (error) {
        console.log("video API1 failed:", error.message);
      }

      if (!mediaUrl) {
        try {
          const { data } = await axios.get(
            `https://apis.davidcyril.name.ng/download/ytmp4?url=${encodeURIComponent(url)}`,
            { timeout: 120000 },
          );

          if (data?.status && data?.result?.download_url) {
            mediaUrl = data.result.download_url;
          }
        } catch (error) {
          console.log("video API2 failed:", error.message);
        }
      }

      if (!mediaUrl) {
        try {
          const apiBase = "https://space2bnhz.tail9ef80b.ts.net";
          const { data } = await axios.post(
            `${apiBase}/video/download`,
            { title: info.title },
            { timeout: 120000 },
          );

          if (data?.file_url) {
            mediaUrl = data.file_url.replace("http://127.0.0.1:5000", apiBase);
          }
        } catch (error) {
          console.log("video API3 failed:", error.message);
        }
      }

      if (!mediaUrl) {
        return ctx.reply("❌ Failed to download video. Try another link.");
      }

      return ctx.services.media.sendOrPrompt({
        sock: client,
        message: {
          from: jid,
          senderId: msg?.senderId || ctx.msg?.senderId,
          reply: ctx.reply,
          quoted: msg,
        },
        userSettings: ctx.userSettings,
        commandName: "video",
        forcePrompt,
        media: {
          title: info.title,
          mediaUrl,
          messageType: "video",
          mimetype: "video/mp4",
          fileName: `${info.title}.mp4`,
          caption: `🎬 ${info.title}\n\n⏱ ${info.timestamp}\n👤 ${info.author?.name || "Unknown"}`,
        },
      });
    } catch (error) {
      console.error("Video Command Error:", error);
      return ctx.reply("❌ Unexpected error occurred.");
    }
  },
};
