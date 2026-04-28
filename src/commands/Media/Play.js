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
      audio:{url:mediaUrl},
      mimetype:"audio/mpeg",
      ptt:false,
      fileName:`${info.title}.mp3`
    },
    {quoted:msg}
   );

 } catch(e){

   console.log(
    "Audio send failed, trying document..."
   );

   return client.sendMessage(
     jid,
     {
       document:{url:mediaUrl},
       mimetype:"audio/mpeg",
       fileName:`${info.title}.mp3`
     },
     {quoted:msg}
   );
 }

}

module.exports = {
meta:{
 name:"play",
 aliases:["yta","song"]
},

async execute(ctx){

 const arg = ctx.args.join(" ").trim();

 const client =
   ctx.client ||
   ctx.sock ||
   ctx.conn;

 if(!client?.sendMessage){
   return ctx.reply(
    "❌ WhatsApp client unavailable."
   );
 }

 const msg=ctx.msg;
 const jid=msg?.key?.remoteJid || ctx.from;

 if(!arg){
   return ctx.reply(
    "Provide a song name or link."
   );
 }

 try{

  let info;
  let url;

  if(/youtu\.?be/.test(arg)){

    const id=arg.match(
      /(?:v=|\/)([0-9A-Za-z_-]{11})/
    )?.[1];

    if(!id)
      return ctx.reply("Invalid link.");

    info=await yts({videoId:id});
    url=arg;

  }else{

    const {videos}=await yts(arg);

    if(!videos?.length)
      return ctx.reply("Song not found.");

    info=videos[0];
    url=info.url;
  }

  await ctx.reply(
   `🎵 Preparing ${info.title}`
  );


  /* API1 */

  try{

   console.log("Trying API1...");

   const {data}=await axios.get(
    `https://apis.davidcyril.name.ng/play?query=${encodeURIComponent(url)}`,
    {timeout:120000}
   );

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

  } catch(e){
   console.log(
    "API1 failed:",
    e.message
   );
  }


  /* API2 */

  try{

   console.log("Trying API2...");

   const API_BASE=
    "https://space2bnhz.tail9ef80b.ts.net";

   const res=await axios.post(
    `${API_BASE}/song/download`,
    {
      title:info.title
    },
    {
      timeout:120000
    }
   );

   if(res.data?.file_url){

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

  } catch(e){
   console.log(
    "API2 failed:",
    e.message
   );
  }


  /* API3 */

  try{

   console.log("Trying API3...");

   const {data}=await axios.get(
    `https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(url)}`
   );

   const dl=
    data?.result?.download||
    data?.download||
    data?.url;

   if(dl){

    return await sendAudioSafe(
      client,
      jid,
      dl,
      info,
      url,
      msg
    );

   }

  } catch(e){
   console.log(
    "API3 failed:",
    e.message
   );
  }

  return ctx.reply(
   "❌ All download sources failed."
  );

 }catch(e){

  console.error(e);

  return ctx.reply(
   "❌ Unexpected error."
  );

 }

}
};
