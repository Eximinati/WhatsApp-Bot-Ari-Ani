const { NEWS } = require("@consumet/extensions");

module.exports = {
  meta: {
    name: "aninews",
    aliases: ["animenews"],
    category: "weeb",
    cooldownSeconds: 30,
    access: "user",
    chat: "both",
    description: "Fetch latest anime news"
  },

  async execute(ctx) {

    const client = ctx.client || ctx.sock || ctx.conn;
    const msg = ctx.msg;
    const jid = msg?.key?.remoteJid || ctx.from;

    if (!client?.sendMessage) {
      return ctx.reply("❌ WhatsApp client unavailable.");
    }

    try {

      await ctx.reply("📰 Fetching latest anime news...");

      const news = await new NEWS.ANN().fetchNewsFeeds();

      if (!news?.length) {
        return ctx.reply("❌ No anime news found.");
      }

      for (let i = 0; i < Math.min(news.length, 5); i++) {

        const item = news[i];

        const title =
          item?.title || "Unknown";

        const topics =
          item?.topics?.join(" | ") || "None";

        const uploaded =
          item?.uploadedAt || "Unknown";

        const intro =
          item?.preview?.intro || "No intro available.";

        let description =
          item?.preview?.full || "No description available.";

        // prevent huge captions breaking sendMessage
        if (description.length > 700) {
          description =
            description.slice(0,700) + "...";
        }

        const caption =
`📰 *===== ANIME NEWS =====* 📰

✨ *Title:* ${title}
🆔 *ID:* ${item.id || "N/A"}
📌 *Topics:* ${topics}
⏰ *Uploaded:* ${uploaded}

💬 *Intro:*
${intro}

📖 *Description:*
${description}

🔗 ${item.url || "No link"}
`;

        if (item?.thumbnail) {

          await client.sendMessage(
            jid,
            {
              image: { url: item.thumbnail },
              caption
            },
            { quoted: msg }
          );

        } else {

          await client.sendMessage(
            jid,
            { text: caption },
            { quoted: msg }
          );
        }
      }

    } catch (err) {

      console.error("Anime News Error:", err);

      return ctx.reply("❌ Could not fetch anime news.");
    }
  }
};
