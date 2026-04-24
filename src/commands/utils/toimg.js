const { convertWebpToPngBuffer, downloadMessageBuffer } = require("../../utils/media");

module.exports = {
  meta: {
    name: "toimg",
    aliases: ["topng"],
    category: "utils",
    description: "Convert a replied sticker back into a PNG image.",
    cooldownSeconds: 8,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const quoted = ctx.msg.quoted;
    if (!quoted?.msg || !(quoted.msg.mimetype || "").includes("webp")) {
      await ctx.reply("Reply to a sticker first.");
      return;
    }

    const buffer = await downloadMessageBuffer(quoted);
    const image = await convertWebpToPngBuffer(buffer);
    await ctx.send(
      ctx.msg.from,
      { image, caption: "Sticker converted to image." },
      { quoted: ctx.msg.raw },
    );
  },
};
