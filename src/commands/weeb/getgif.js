const axios = require("axios");

module.exports = {
  meta: {
    name: "getgif",
    aliases: ["gify"],
    category: "weeb",
    cooldownSeconds: 10,
    access: "user",
    chat: "both",
    usage: "getgif <search>",
    description: "Search and send a GIF"
  },

  async execute(ctx) {

    const client = ctx.client || ctx.sock || ctx.conn;
    const msg = ctx.msg;
    const jid = msg?.key?.remoteJid || ctx.from;

    const query = ctx.args.join(" ").trim();

    if (!client?.sendMessage) {
      return ctx.reply("❌ WhatsApp client not available.");
    }

    if (!query) {
      return ctx.reply("❌ Provide a search term.");
    }

    try {

      await ctx.reply(`🔎 Searching GIF for *${query}*...`);

      const res = await axios.get(
        `https://g.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=LIVDSRZULELA&limit=8`,
        { timeout: 20000 }
      );

      const results = res?.data?.results || [];

      if (!results.length) {
        return ctx.reply("❌ No GIF found.");
      }

      // Filter only valid mp4 results
      const valid = results.filter(
        x => x?.media?.[0]?.mp4?.url
      );

      if (!valid.length) {
        return ctx.reply("❌ No playable GIF found.");
      }

      const pick =
        valid[Math.floor(Math.random() * valid.length)];

      const gifUrl = pick.media[0].mp4.url;

      return await client.sendMessage(
        jid,
        {
          video: { url: gifUrl },
          gifPlayback: true,
          caption: `✅ Here is your GIF for: ${query}`
        },
        { quoted: msg }
      );

    } catch (err) {

      console.error("GIF Error:", err?.message || err);

      return ctx.reply("❌ Failed to fetch GIF.");
    }
  }
};
