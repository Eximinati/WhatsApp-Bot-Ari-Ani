const axios = require("axios");

async function fetchBuffer(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 120000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "*/*",
      "Referer": "https://www.tiktok.com/"
    }
  });

  return Buffer.from(res.data);
}

module.exports = {
  meta: {
    name: "tiktok",
    aliases: ["tt", "tiktokdl", "ttdl"],
    category: "media",
    cooldownSeconds: 4,
    access: "user",
    chat: "both",
    usage: "tiktok <url>",
    description: "Download TikTok videos"
  },

  async execute(ctx) {
    const client = ctx.client || ctx.sock || ctx.conn;
    const msg = ctx.msg;
    const jid = msg?.key?.remoteJid || ctx.from;

    if (!client?.sendMessage) {
      return ctx.reply("❌ WhatsApp client not available.");
    }

    const arg = ctx.args.join(" ").trim();

    if (!arg) {
      return ctx.reply("❌ Please provide a valid TikTok link.");
    }

    const tiktokUrl = arg.trim();

    const validTikTok = /tiktok\.com\/|vt\.tiktok\.com\//i;

    if (!validTikTok.test(tiktokUrl)) {
      return ctx.reply("❌ Invalid TikTok link.");
    }

    try {
      await ctx.reply("⏳ Fetching your TikTok video...");

      const { data } = await axios.post(
        "https://bnh-api.fly.dev/tiktok/download",
        { url: tiktokUrl },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 60000
        }
      );

      console.log("TikTok API response:", data);

      let videoUrl = null;

      if (Array.isArray(data?.videos) && data.videos.length) {
        videoUrl = data.videos[0].url;
      }

      if (!videoUrl) {
        return ctx.reply("❌ No downloadable video found.");
      }

      const title = data.title || data.description || "TikTok Video";

      
      const videoBuffer = await fetchBuffer(videoUrl);

      if (!videoBuffer || !videoBuffer.length) {
        return ctx.reply("❌ Failed to download video file.");
      }

      return await client.sendMessage(
        jid,
        {
          video: videoBuffer,
          mimetype: "video/mp4",
          caption: `🎵 *${title}*\n🔗 ${tiktokUrl}`
        },
        { quoted: msg }
      );

    } catch (error) {
      console.error("TikTok Error:", error?.message || error);
      return ctx.reply("❌ Failed to download TikTok video.");
    }
  }
};
