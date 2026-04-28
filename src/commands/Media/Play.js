const axios = require("axios");
const yts = require("yt-search");

async function sendAudioSafe(
 client,
 jid,
 mediaUrl,
 info,
 ytUrl,
 msg
){

 if(!client?.sendMessage){
   throw new Error("Client undefined");
 }

 try{

   return await client.sendMessage(
    jid,
    {
      document: { url: mediaUrl },
      mimetype: "audio/mpeg",
      ptt: false,
      fileName: `${info.title.replace(/[\\/:*?"<>|]/g,"")}.mp3`,
      contextInfo: {
        externalAdReply: {
          title: info.title,
          body: info.author?.name || "Music",
          thumbnailUrl: info.thumbnail,
          mediaType: 2,
          mediaUrl: ytUrl,
          sourceUrl: ytUrl
        }
      }
    },
    { quoted: msg }
   );

 } catch (e) {

   console.log("Audio send failed, trying document...");

   return client.sendMessage(
     jid,
     {
       document: { url: mediaUrl },
       mimetype: "audio/mpeg",
       fileName: `${info.title.replace(/[\\/:*?"<>|]/g,"")}.mp3`
     },
     { quoted: msg }
   );

 }

}

module.exports = {
 meta: {
   name: "play",
   aliases: ["yta", "song", "ytaudio", "playaudio"],
   category: "media",   
   description: "Download and play audio from YouTube.",
   cooldownSeconds: 10,
   access: "user",
   chat: "both",
   usage: "<song name/link>"
 },

 async execute(ctx) {

  const arg = ctx.args.join(" ").trim();

  
  const client =
    ctx.client ||
    ctx.sock ||
    ctx.conn;

  const msg = ctx.msg;

  const jid =
    msg?.key?.remoteJid ||
    ctx.from;

  if (!client?.sendMessage) {
    return ctx.reply("❌ WhatsApp client not available.");
  }

  if (!arg) {
    return ctx.reply("❗ Provide a YouTube link or song name.");
  }

  try {

    let info;
    let url;

    const validYT =
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//;

    const isLink = validYT.test(arg);

    if (isLink) {

      const idMatch = arg.match(
        /(?:v=|\/)([0-9A-Za-z_-]{11})/
      );

      if (!idMatch) {
        return ctx.reply("❗ Invalid YouTube link.");
      }

      info = await yts({ videoId: idMatch[1] });
      url = arg;

    } else {

      const { videos } = await yts(arg);

      if (!videos?.length) {
        return ctx.reply("❗ Song not found.");
      }

      info = videos[0];
      url = info.url;
    }

    await ctx.reply(`🎵 Preparing: *${info.title}*`);
       try {

      console.log("Trying API1...");

      const { data } = await axios.get(
        `https://apis.davidcyril.name.ng/play?query=${encodeURIComponent(url)}`,
        { timeout: 120000 }
      );

      if (data?.status && data?.result?.download_url) {

        console.log("API1 success");

        return await sendAudioSafe(
          client,
          jid,
          data.result.download_url,
          info,
          url,
          msg
        );
      }

    } catch (e) {
      console.log("API1 failed:", e.message);
    }

   try {

      console.log("Trying API2...");

      const API_BASE = "https://space2bnhz.tail9ef80b.ts.net";

      const res = await axios.post(
        `${API_BASE}/song/download`,
        { title: info.title },
        { timeout: 120000 }
      );

      if (res.data?.file_url) {

        return await sendAudioSafe(
          client,
          jid,
          res.data.file_url.replace(
            "http://127.0.0.1:5000",
            API_BASE
          ),
          info,
          url,
          msg
        );
      }

    } catch (e) {
      console.log("API2 failed:", e.message);
    }

    try {

      console.log("Trying API3...");

      const { data } = await axios.get(
        `https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(url)}`
      );

      const dl =
        data?.result?.download ||
        data?.download ||
        data?.url;

      if (dl) {

        return await sendAudioSafe(
          client,
          jid,
          dl,
          info,
          url,
          msg
        );
      }

    } catch (e) {
      console.log("API3 failed:", e.message);
    }

    return ctx.reply("❌ All download sources failed.");

  } catch (err) {

    console.error(err);

    return ctx.reply("❌ Unexpected error occurred.");
  }

 }
};
