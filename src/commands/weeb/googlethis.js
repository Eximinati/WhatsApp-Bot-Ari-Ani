const google = require("googlethis");

module.exports = {
  meta: {
    name: "imagesearch",
    aliases: ["img","image","picture"],
    category: "weeb",
    cooldownSeconds: 10,
    access: "user",
    chat: "both",
    usage: "imagesearch <query>",
    description: "Search images from Google"
  },

  async execute(ctx) {

    const client = ctx.client || ctx.sock || ctx.conn;
    const msg = ctx.msg;
    const jid = msg?.key?.remoteJid || ctx.from;

    if (!client?.sendMessage) {
      return ctx.reply("❌ WhatsApp client unavailable.");
    }

    const query = ctx.args.join(" ").trim();

    if (!query) {
      return ctx.reply(
        "⚠️ Provide a search term.\nExample: imagesearch cat"
      );
    }

    try {

      await ctx.reply(`🔎 Searching images for *${query}*...`);

      const nsfwList =
        await client.DB.get("nsfw") || [];

      
      const safeMode = !nsfwList.includes(jid);

      const results = await google.image(query, {
        safe: safeMode,
        ris: false
      });

      if (!results?.length) {
        return ctx.reply("❌ No images found.");
      }

      
      const valid = results.filter(
        x => x?.url?.startsWith("http")
      );

      if (!valid.length) {
        return ctx.reply("❌ No usable image found.");
      }

      
      const pick =
        valid[Math.floor(Math.random() * valid.length)];

      return await client.sendMessage(
        jid,
        {
          image: { url: pick.url },
          caption:
`🔍 *Google Image Search*
📌 Query: ${query}`
        },
        { quoted: msg }
      );

    } catch (err) {

      console.error("IMAGE SEARCH ERROR:", err);

      return ctx.reply(
        "❌ Error while searching images. Try another keyword."
      );
    }
  }
};
