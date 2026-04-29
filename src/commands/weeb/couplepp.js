const axios = require("axios");

module.exports = {
  meta: {
    name: "couplepp",
    aliases: ["cpp", "couple", "pppair"],
    category: "weeb",
    cooldownSeconds: 10,
    access: "user",
    chat: "both",
    description: "Sends random anime couple pictures",
    usage: "couplepp"
  },

  async execute(ctx) {
    const client = ctx.client || ctx.sock || ctx.conn;
    const M = ctx.msg;
    const jid = M.key.remoteJid;

    try {
      const { data } = await axios.get(
        "https://raw.githubusercontent.com/iamriz7/kopel_/main/kopel.json"
      );

      const pick = data[Math.floor(Math.random() * data.length)];

      await client.sendMessage(
        jid,
        {
          image: { url: pick.female },
          caption: "*💖 For Him*"
        },
        { quoted: M }
      );

      await client.sendMessage(
        jid,
        {
          image: { url: pick.male },
          caption: "*💙 For Her*"
        },
        { quoted: M }
      );

    } catch (err) {
      console.error(err);
      ctx.reply("❌ Failed to fetch couple images.");
    }
  }
};
