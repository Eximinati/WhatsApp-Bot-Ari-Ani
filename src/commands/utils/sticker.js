const constants = require("../../config/constants");
const { createStickerFromMessage } = require("../../utils/media");

module.exports = {
  meta: {
    name: "sticker",
    aliases: ["s"],
    category: "utils",
    description: "Turn a replied image or short video into a sticker.",
    cooldownSeconds: 8,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const quoted = ctx.msg.quoted;
    if (!quoted?.msg) {
      await ctx.reply("Reply to an image or short video first.");
      return;
    }

    const mime = quoted.msg.mimetype || "";
    if (!/image|video/.test(mime)) {
      await ctx.reply("Only images and short videos can be converted to stickers.");
      return;
    }

    if (
      /video/.test(mime) &&
      (quoted.msg.seconds || 0) > constants.media.maxStickerVideoSeconds
    ) {
      await ctx.reply(
        `Video stickers must be ${constants.media.maxStickerVideoSeconds}s or shorter.`,
      );
      return;
    }

    const sticker = await createStickerFromMessage(quoted, {
      pack: ctx.config.packname,
      author: ctx.msg.pushName || ctx.config.botName,
    });

    await ctx.send(
      ctx.msg.from,
      { sticker },
      { quoted: ctx.msg.raw },
    );
  },
};
