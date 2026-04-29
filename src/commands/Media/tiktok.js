const axios = require("axios");

module.exports = {
  meta: {
    name: "tiktok",
    aliases: ["tt", "tiktokdl", "ttdl"],
    category: "media",
    cooldownSeconds: 4,
    access: "user",
    chat: "both",
    usage: "tiktok <url> [--ask]",
    description: "Download TikTok videos",
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
      return ctx.reply("❌ Please provide a valid TikTok link.");
    }

    const tiktokUrl = arg.trim();
    if (!/tiktok\.com\/|vt\.tiktok\.com\//i.test(tiktokUrl)) {
      return ctx.reply("❌ Invalid TikTok link.");
    }

    try {
      await ctx.reply("⏳ Fetching your TikTok video...");

      const { data } = await axios.post(
        "https://bnh-api.fly.dev/tiktok/download",
        { url: tiktokUrl },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 60000,
        },
      );

      const videoUrl = Array.isArray(data?.videos) && data.videos.length
        ? data.videos[0].url
        : "";

      if (!videoUrl) {
        return ctx.reply("❌ No downloadable video found.");
      }

      const title = data.title || data.description || "TikTok Video";

      return ctx.services.media.sendOrPrompt({
        sock: client,
        message: {
          from: jid,
          sender: msg?.sender || ctx.msg.sender,
          reply: ctx.reply,
          quoted: msg,
        },
        userSettings: ctx.userSettings,
        commandName: "tiktok",
        forcePrompt,
        media: {
          title,
          mediaUrl: videoUrl,
          messageType: "video",
          mimetype: "video/mp4",
          fileName: `${title}.mp4`,
          caption: `🎵 *${title}*\n🔗 ${tiktokUrl}`,
        },
      });
    } catch (error) {
      console.error("TikTok Error:", error?.message || error);
      return ctx.reply("❌ Failed to download TikTok video.");
    }
  },
};
