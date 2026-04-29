const { Anime } = require("@shineiichijo/marika");

function cap(str="") {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {
  meta: {
    name: "anime",
    aliases: ["ani"],
    category: "weeb",
    cooldownSeconds: 10,
    access: "user",
    chat: "both",
    usage: "anime <name>",
    description: "Get anime information"
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
      return ctx.reply("❌ Provide an anime name.");
    }

    try {

      await ctx.reply(`🔎 Searching anime: *${query}*...`);

      const { data } =
        await new Anime().searchAnime(query);

      const result = data?.[0];

      if (!result) {
        return ctx.reply("❌ No anime found.");
      }

      const genres =
        result?.genres?.map(x=>x.name).join(", ") || "Unknown";

      const studios =
        result?.studios?.map(x=>x.name).join(", ") || "Unknown";

      const producers =
        result?.producers?.map(x=>x.name).join(", ") || "Unknown";

      let synopsis =
        result?.synopsis || "No synopsis available.";

      if (synopsis.length > 800) {
        synopsis =
          synopsis.slice(0,800) + "...";
      }

      let text = "";

      text += `🎀 *Title:* ${result.title || "Unknown"}\n`;
      text += `🎋 *Format:* ${result.type || "Unknown"}\n`;
      text += `📈 *Status:* ${cap(
         (result.status || "unknown").replace(/_/g," ")
      )}\n`;

      text += `🍥 *Episodes:* ${result.episodes || "Unknown"}\n`;
      text += `🎈 *Duration:* ${result.duration || "Unknown"}\n`;
      text += `🧧 *Genres:* ${genres}\n`;

      text += `✨ *Based on:* ${cap(result.source || "Unknown")}\n`;
      text += `📍 *Studios:* ${studios}\n`;
      text += `🎴 *Producers:* ${producers}\n`;

      text += `💫 *Premiered:* ${result?.aired?.from || "Unknown"}\n`;
      text += `🎗 *Ended:* ${result?.aired?.to || "Unknown"}\n`;

      text += `🎐 *Popularity:* ${result.popularity || "N/A"}\n`;
      text += `🎏 *Favorites:* ${result.favorites || "N/A"}\n`;
      text += `🎇 *Rating:* ${result.rating || "N/A"}\n`;
      text += `🏅 *Rank:* ${result.rank || "N/A"}\n\n`;

      if (result.background) {
        let bg = result.background;

        if (bg.length > 300) {
          bg = bg.slice(0,300) + "...";
        }

        text += `🎆 *Background:*\n${bg}\n\n`;
      }

      text += `❄ *Description:*\n${synopsis}`;

      const image =
        result?.images?.jpg?.large_image_url ||
        result?.images?.jpg?.image_url;

      if (image) {
        return client.sendMessage(
          jid,
          {
            image: { url: image },
            caption: text
          },
          { quoted: msg }
        );
      }

      return client.sendMessage(
        jid,
        { text },
        { quoted: msg }
      );

    } catch (err) {

      console.error("Anime command error:", err);

      return ctx.reply(
        "❌ Error fetching anime information."
      );
    }
  }
};
