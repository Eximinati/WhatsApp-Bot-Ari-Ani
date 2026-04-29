const { Character } = require("@shineiichijo/marika");

module.exports = {
  meta: {
    name: "character",
    aliases: ["char"],
    category: "weeb",
    cooldownSeconds: 20,
    access: "user",
    chat: "both",
    usage: "character <name>",
    description: "Get anime character information"
  },

  async execute(ctx) {

    const client = ctx.client || ctx.sock || ctx.conn;
    const msg = ctx.msg;
    const jid =
      msg?.key?.remoteJid ||
      ctx.from;

    if (!client?.sendMessage) {
      return ctx.reply("❌ WhatsApp client unavailable.");
    }

    const query = ctx.args.join(" ").trim();

    if (!query) {
      return ctx.reply("❌ Provide a character name.");
    }

    try {

      await ctx.reply(
        `🔎 Searching character: *${query}*...`
      );

      const api = new Character();

      const { data } =
        await api.searchCharacter(query);

      const chara = data?.[0];

      if (!chara) {
        return ctx.reply(
          "❌ No character found."
        );
      }

      let source = "Unknown";

      try {

        const animeRes =
          await api.getCharacterAnime(
            chara.mal_id
          );

        if (animeRes?.data?.length) {
          source =
            animeRes.data[0].anime.title;
        }

      } catch {

        try {

          const mangaRes =
            await api.getCharacterManga(
              chara.mal_id
            );

          if (mangaRes?.data?.length) {
            source =
              mangaRes.data[0].manga.title;
          }

        } catch {}
      }

      const nicknames =
        chara?.nicknames?.length
          ? chara.nicknames.join(", ")
          : "None";

    
      let about =
        chara.about || "No description available.";

      
      if (about.length > 1000) {
        about =
          about.slice(0,1000) + "...";
      }

      let text =
`💙 *Name:* ${chara.name}

💚 *Nicknames:* ${nicknames}

💛 *Source:* ${source}

❤ *Description:*
${about}
`;

      const image =
        chara?.images?.jpg?.image_url;

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

    } catch (error) {

      console.error(
        "Character command error:",
        error
      );

      return ctx.reply(
        "❌ Error fetching character information."
      );
    }
  }
};
