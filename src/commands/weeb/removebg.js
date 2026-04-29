module.exports = {
  meta: {
    name: "removebg",
    aliases: ["rbg"],
    category: "weeb",
    cooldownSeconds: 10,
    access: "user",
    chat: "both",
    description: "Remove background from image"
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

      if (!client.bgAPI) {
        return ctx.reply(
          "❌ RemoveBG API key missing."
        );
      }

      const quoted =
        msg?.quoted || ctx.quoted;

      const mime =
        quoted?.msg?.mimetype ||
        msg?.msg?.mimetype ||
        "";

      if (!mime.startsWith("image/")) {
        return ctx.reply(
          "❌ Reply to an image or send one with the command."
        );
      }

      await ctx.reply(
        "🪄 Removing background..."
      );

      let buffer;

      if (quoted) {
        buffer = await quoted.download();
      } else {
        buffer = await msg.download();
      }

      if (!buffer) {
        return ctx.reply(
          "❌ Could not download image."
        );
      }

      const image =
        await client.utils.removeBG(buffer);

      if (!image) {
        return ctx.reply(
          "❌ Background removal failed."
        );
      }

      return await client.sendMessage(
        jid,
        {
          image: image,
          caption: "✅ Background removed"
        },
        { quoted: msg }
      );

    } catch (err) {

      console.error(
        "RemoveBG Error:",
        err
      );

      return ctx.reply(
        "❌ Failed to remove background."
      );
    }
  }
};
