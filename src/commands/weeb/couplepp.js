const axios = require("axios");

module.exports = {
  meta: {
    name: "couplepp",
    category: "weeb",
    cooldownSeconds: 10,
    access: "user",
    chat: "both",
    description: "Send random anime couple profile pictures"
  },

  async execute(ctx) {

    const client = ctx.client || ctx.sock || ctx.conn;
    const msg = ctx.msg;
    const jid =
      msg?.key?.remoteJid ||
      ctx.from;

    if (!client?.sendMessage) {
      return ctx.reply(
        "❌ WhatsApp client unavailable."
      );
    }

    try {

      await ctx.reply(
        "🎲 Fetching random couple pics..."
      );

      const { data } = await axios.get(
        "https://raw.githubusercontent.com/iamriz7/kopel_/main/kopel.json",
        {
          timeout: 20000
        }
      );

      if (!Array.isArray(data) || !data.length) {
        return ctx.reply(
          "❌ No couple images found."
        );
      }

      const pair =
        data[Math.floor(
          Math.random() * data.length
        )];

      if (!pair?.female || !pair?.male) {
        return ctx.reply(
          "❌ Invalid image pair received."
        );
      }

    
      await client.sendMessage(
        jid,
        {
          image: {
            url: pair.female
          },
          caption: "💙 *For Him*"
        },
        { quoted: msg }
      );

      await client.sendMessage(
        jid,
        {
          image: {
            url: pair.male
          },
          caption: "💖 *For Her*"
        },
        { quoted: msg }
      );

    } catch (err) {

      console.error(
        "CouplePP Error:",
        err
      );

      return ctx.reply(
        "❌ Failed to fetch couple pictures."
      );
    }
  }
};
