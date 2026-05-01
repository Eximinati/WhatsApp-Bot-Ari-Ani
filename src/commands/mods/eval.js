module.exports = {
  meta: {
    name: "eval",
    aliases: ["e"],
    category: "mods",
    description: "Execute JavaScript code (owner only).",
    cooldownSeconds: 2,
    access: "owner",
    chat: "both",
    usage: "<code>",
  },

  async execute(ctx) {
    const { msg, text, sock, config } = ctx;

    if (!text) {
      return msg.reply("Usage: /eval 2+2");
    }

    try {
      // Inject variables into eval scope
      const result = await (async () => {
        const message = msg;       // ✅ THIS FIXES YOUR ERROR
        const senderId = msg.senderId;
        const phoneId = msg.phoneId;

        return await eval(text);
      })();

      let output =
        typeof result === "object"
          ? JSON.stringify(result, null, 2)
          : String(result);

      if (!output) output = "undefined";

      await msg.reply(output);
    } catch (err) {
      await msg.reply("❌ Error: " + err.message);
    }
  },
};