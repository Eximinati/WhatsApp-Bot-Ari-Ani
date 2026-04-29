const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

module.exports = {
  meta: {
    name: "viewonce",
    aliases: ["vv", "viewonce2"],
    category: "media",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
    usage: "reply view-once image/video",
    description: "Reveal view-once media"
  },

  async execute(ctx) {
    const client = ctx.client || ctx.sock || ctx.conn;
    const msg = ctx.msg;
    const jid = msg?.key?.remoteJid || ctx.from;

    if (!client?.sendMessage) {
      return ctx.reply("❌ WhatsApp client not available.");
    }

    const quoted =
      ctx.quoted ||
      msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quoted) {
      return ctx.reply("❌ Reply to a view-once image or video.");
    }

    try {
      const inner =
        quoted.imageMessage ||
        quoted.videoMessage ||
        quoted.msg ||
        quoted;

      if (!inner?.viewOnce) {
        return ctx.reply("❌ This is not a view-once media.");
      }

      const isVideo = inner.mimetype?.includes("video");
      const type = isVideo ? "video" : "image";

      const stream = await downloadContentFromMessage(inner, type);

      let buffer = Buffer.from([]);

      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      if (!buffer.length) {
        return ctx.reply("❌ Failed to download view-once media.");
      }

      return await client.sendMessage(
        jid,
        {
          [type]: buffer,
          caption: inner.caption || "👁️ View Once Revealed"
        },
        { quoted: msg }
      );

    } catch (err) {
      console.error("ViewOnce Error:", err);
      return ctx.reply("❌ Failed to retrieve view-once media.");
    }
  }
};
