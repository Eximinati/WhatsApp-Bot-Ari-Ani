const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

module.exports = {
  meta: {
    name: "emojimix",
    aliases: ["mixemoji"],
    category: "utils",
    cooldownSeconds: 8,
    access: "user",
    chat: "both",
    usage: "emojimix 😎+🥰",
    description: "Mix two emojis into a sticker"
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

    const arg =
      ctx.args.join(" ").trim();

    if (!arg || !arg.includes("+")) {
      return ctx.reply(
        "✳️ Example:\nemojimix 😎+🥰"
      );
    }

    let inputFile;
    let outputFile;

    try {

      let [emoji1, emoji2] =
        arg.split("+").map(x=>x.trim());

      await ctx.reply("🎴 Mixing emojis...");

      async function fetchKitchen(e1,e2){

        const url =
`https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${encodeURIComponent(e1)}_${encodeURIComponent(e2)}`;

        const res = await fetch(url);
        return res.json();
      }
      
      let json =
        await fetchKitchen(
          emoji1,
          emoji2
        );


      if (!json?.results?.length) {
        json = await fetchKitchen(
          emoji2,
          emoji1
        );
      }

      if (!json?.results?.length) {
        return ctx.reply(
          "❌ Those emojis can't be mixed."
        );
      }

      const imageUrl =
        json.results[0].url;

    
      const tmpDir =
        path.join(process.cwd(),"tmp");

      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir);
      }

      const stamp = Date.now();

      inputFile =
        path.join(
          tmpDir,
          `emoji_${stamp}.png`
        );

      outputFile =
        path.join(
          tmpDir,
          `emoji_${stamp}.webp`
        );

  
      const imgRes = await fetch(imageUrl);

      const arrayBuffer =
        await imgRes.arrayBuffer();

      fs.writeFileSync(
        inputFile,
        Buffer.from(arrayBuffer)
      );

    
      await new Promise((resolve,reject)=>{

        exec(
`ffmpeg -y -i "${inputFile}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" "${outputFile}"`,
(err)=>
 err ? reject(err) : resolve()
        );

      });

      const sticker =
        fs.readFileSync(outputFile);

      await client.sendMessage(
        jid,
        {
          sticker
        },
        { quoted: msg }
      );

    } catch(err){

      console.error(
        "EmojiMix Error:",
        err
      );

      return ctx.reply(
        "❌ Failed to create emoji mix."
      );

    } finally {

  
      try {
        if (
          inputFile &&
          fs.existsSync(inputFile)
        ) fs.unlinkSync(inputFile);
      } catch {}

      try {
        if (
          outputFile &&
          fs.existsSync(outputFile)
        ) fs.unlinkSync(outputFile);
      } catch {}
    }
  }
};
