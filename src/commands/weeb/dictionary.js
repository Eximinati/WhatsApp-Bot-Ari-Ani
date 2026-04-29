const axios = require("axios");

module.exports = {
  meta: {
    name: "dictionary",
    aliases: ["ud"],
    category: "weeb",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
    usage: "dictionary <word>",
    description: "Define a word using Urban Dictionary"
  },

  async execute(ctx) {

    const term =
      ctx.args.join(" ").trim();

    if (!term) {
      return ctx.reply(
        "❌ Please provide a word."
      );
    }

    try {

      const { data } = await axios.get(
        `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`,
        { timeout: 20000 }
      );

      if (!data?.list?.length) {
        return ctx.reply(
          `❌ No definition found for *${term}*`
        );
      }

      const entry = data.list[0];

      let definition =
        (entry.definition || "None")
          .replace(/\[/g,"")
          .replace(/\]/g,"");

      let example =
        (entry.example || "None")
          .replace(/\[/g,"")
          .replace(/\]/g,"");

      
      if (definition.length > 1200) {
        definition =
          definition.slice(0,1200) + "...";
      }

      if (example.length > 500) {
        example =
          example.slice(0,500) + "...";
      }

      const text =
`📚 *Dictionary:* ${term}

📖 *Definition:*
${definition}

💬 *Example:*
${example}

👍 ${entry.thumbs_up || 0} | 👎 ${entry.thumbs_down || 0}
`;

      return ctx.reply(text);

    } catch (err) {

      console.error(
        "Dictionary Error:",
        err
      );

      return ctx.reply(
        `❌ Couldn't find a definition for *${term}*`
      );
    }
  }
};
