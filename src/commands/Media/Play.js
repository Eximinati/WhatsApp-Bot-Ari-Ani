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

 try{

   return await client.sendMessage(
     jid,
     {
       audio:{ url: mediaUrl },
       mimetype:"audio/mpeg",
       ptt:false,
       fileName:`${
         info.title.replace(/[\\/:*?"<>|]/g,"")
       }.mp3`,

       contextInfo:{
         externalAdReply:{
           title: info.title,
           body: info.author?.name || "Music",
           thumbnailUrl: info.thumbnail,
           mediaType:2,
           mediaUrl: ytUrl,
           sourceUrl: ytUrl
         }
       }

     },
     { quoted: msg }
   );

 } catch(e){

   console.log(
    "Audio send failed, trying document..."
   );

   return await client.sendMessage(
     jid,
     {
       document:{ url: mediaUrl },
       mimetype:"audio/mpeg",
       fileName:`${
         info.title.replace(/[\\/:*?"<>|]/g,"")
       }.mp3`
     },
     { quoted: msg }
   );

 }

}

module.exports = {
 meta:{
   name:"play",
   aliases:["yta","song","ytaudio","playaudio"],
   category:"media",
   description:"Download and play audio from YouTube.",
   cooldownSeconds:10,
   access:"user",
   chat:"both",
   usage:"<song name/link>"
 },

 async execute(ctx){

  const arg = ctx.args.join(" ").trim();
  const client = ctx.client;
  const msg = ctx.msg;

  const jid =
    msg?.key?.remoteJid ||
    ctx.from;

  if(!arg){
   return ctx.reply(
    "❗ Provide a YouTube link or song name."
   );
  }

  if(ctx.react){
   await ctx.react("✅");
  }

  try{

   const search = async term=>{
    const { videos } = await yts(term);
    return videos?.length
      ? videos[0]
      : null;
   };

   const validYT =
    /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//;

   const isLink = validYT.test(arg);

   let info;
   let url;

   if(isLink){

    const idMatch =
      arg.match(
       /(?:v=|\/)([0-9A-Za-z_-]{11})/
      );

    if(!idMatch){
      return ctx.reply(
       "❗ Invalid YouTube link."
      );
    }

    info = await yts({
      videoId:idMatch[1]
    });

    url = arg;

   } else {

    info = await search(arg);

    if(!info){
      return ctx.reply(
       "❗ Song not found."
      );
    }

    url = info.url;

   }

   if(!info){
    return ctx.reply(
     "❗ Could not retrieve video details."
    );
   }

   if(Number(info.seconds) > 10800){
    return ctx.reply(
      "❌ Cannot download audio longer than 3 hours."
    );
   }

   await ctx.reply(
    `🎵 Preparing audio: *${info.title}*`
   );


   /* ======================
      API 1
   ====================== */

   try{

    console.log("Trying API1...");

    const apiUrl =
     `https://apis.davidcyril.name.ng/play?query=${encodeURIComponent(url)}`;

    const { data } =
     await axios.get(apiUrl,{
      timeout:120000
     });

    if(
      data?.status &&
      data?.result?.download_url
    ){

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

   } catch(err){

    console.log(
      "API1 failed:",
      err.response?.data || err.message
    );

   }


   /* ======================
      API 2
   ====================== */

   try{

    console.log("Trying API2...");

    const API_BASE =
      "https://space2bnhz.tail9ef80b.ts.net";

    const response =
     await axios.post(
      `${API_BASE}/song/download`,
      {
        title: info.title
      },
      {
       headers:{
        "Content-Type":"application/json"
       },
       timeout:120000
      }
     );

    const data = response.data;

    if(!data?.file_url){
      throw new Error(
       "Invalid API2 response"
      );
    }

    console.log("API2 success");

    const fixedUrl =
      data.file_url.replace(
       "http://127.0.0.1:5000",
       API_BASE
      );

    return await sendAudioSafe(
      client,
      jid,
      fixedUrl,
      info,
      url,
      msg
    );

   } catch(err){

    console.log(
      "API2 failed:",
      err.response?.data || err.message
    );

   }


   /* ======================
      API 3
   ====================== */

   try{

    console.log("Trying API3...");

    const api3 =
      `https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(url)}`;

    const { data } =
      await axios.get(api3,{
       timeout:120000
      });

    const downloadUrl =
      data?.result?.download ||
      data?.download ||
      data?.url;

    if(!downloadUrl){
      throw new Error(
       "Invalid API3 response"
      );
    }

    console.log("API3 success");

    return await sendAudioSafe(
      client,
      jid,
      downloadUrl,
      info,
      url,
      msg
    );

   } catch(err){

    console.log(
      "API3 failed:",
      err.response?.data || err.message
    );

   }


   console.log(
    "All download sources failed"
   );

   return ctx.reply(
    "❌ Failed to download audio after trying all sources."
   );

  } catch(error){

   console.error(
    "Unexpected error:",
    error
   );

   return ctx.reply(
    "❌ Unexpected error occurred."
   );

  }

 }
};
