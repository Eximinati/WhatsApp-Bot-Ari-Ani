const acrcloud = require("acrcloud");
const { createCanvas, loadImage } = require("canvas");
const yts = require("yt-search");

module.exports = {
  meta: {
    name: "shazam",
    aliases: ["findsong", "musicid"],
    category: "media",
    cooldownSeconds: 4,
    access: "user",
    chat: "both",
    usage: "reply audio/video with shazam",
    description: "Identifies a song from audio or short video"
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
      ctx.msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quoted) {
      return ctx.reply("🎵 Reply to an audio or video file.");
    }

    let mime =
      quoted?.audioMessage?.mimetype ||
      quoted?.videoMessage?.mimetype ||
      quoted?.message?.audioMessage?.mimetype ||
      quoted?.message?.videoMessage?.mimetype ||
      "";

    if (!/audio|video/.test(mime)) {
      return ctx.reply("🎵 Please reply to a valid audio or video file.");
    }

    try {
      
      const buffer = await new Promise(async (resolve, reject) => {
        try {
          const data = await ctx.quoted.download();
          resolve(data);
        } catch (e) {
          reject(e);
        }
      });

      if (!buffer) {
        return ctx.reply("❌ Failed to read media buffer.");
      }

     
      const acr = new acrcloud({
        host: "identify-ap-southeast-1.acrcloud.com",
        access_key: "26afd4eec96b0f5e5ab16a7e6e05ab37",
        access_secret: "wXOZIqdMNZmaHJP1YDWVyeQLg579uK2CfY6hWMN8"
      });

      const { status, metadata } = await acr.identify(buffer);

      if (status?.code !== 0 || !metadata?.music?.length) {
        return ctx.reply("❌ Song not recognized.");
      }

      const song = metadata.music[0];

      const title = song.title || "Unknown";
      const artists =
        song.artists?.map(a => a.name).join(", ") || "Unknown";
      const album = song.album?.name || "Unknown";
      const genres =
        song.genres?.map(g => g.name).join(", ") || "Unknown";
      const release = song.release_date || "Unknown";

     
      let coverUrl =
        song.album?.coverart ||
        song.external_metadata?.spotify?.album?.images?.[0]?.url ||
        song.external_metadata?.deezer?.album?.cover ||
        song.external_metadata?.itunes?.album?.cover ||
        null;

      if (!coverUrl) {
        try {
          const search = await yts(`${title} ${artists}`);
          coverUrl = search?.videos?.[0]?.thumbnail || null;
        } catch {}
      }

    
      const width = 900;
      const height = 600;

      const canvas = createCanvas(width, height);
      const c = canvas.getContext("2d");

      c.fillStyle = "#121212";
      c.fillRect(0, 0, width, height);

      let img = null;

      try {
        if (coverUrl) img = await loadImage(coverUrl);
      } catch {}

      
      if (img) {
        c.save();
        c.globalAlpha = 0.25;
        c.filter = "blur(40px)";
        c.drawImage(img, -200, -200, width + 400, height + 400);
        c.restore();
      }

      c.filter = "none";

    
      const size = 300;

      if (img) {
        c.save();

        const x = 50;
        const y = 50;
        const r = 25;

        c.beginPath();
        c.moveTo(x + r, y);
        c.lineTo(x + size - r, y);
        c.quadraticCurveTo(x + size, y, x + size, y + r);
        c.lineTo(x + size, y + size - r);
        c.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
        c.lineTo(x + r, y + size);
        c.quadraticCurveTo(x, y + size, x, y + size - r);
        c.lineTo(x, y + r);
        c.quadraticCurveTo(x, y, x + r, y);
        c.closePath();

        c.clip();

        c.drawImage(img, x, y, size, size);

        c.restore();
      }

      
      c.fillStyle = "#fff";
      c.font = "bold 42px Arial";
      c.fillText(title, 400, 120);

      c.fillStyle = "#b3b3b3";
      c.font = "28px Arial";
      c.fillText(artists, 400, 180);
      c.fillText(`Album: ${album}`, 400, 240);
      c.fillText(`Genre: ${genres}`, 400, 300);
      c.fillText(`Released: ${release}`, 400, 360);

      
      c.fillStyle = "#1DB954";
      c.fillRect(400, 420, 350, 8);

      c.beginPath();
      c.arc(520, 424, 10, 0, Math.PI * 2);
      c.fill();

      
      c.fillStyle = "#1DB954";
      c.font = "bold 26px Arial";
      c.fillText("Music Recognition Bot", 50, 520);

      c.fillStyle = "#888";
      c.font = "22px Arial";
      c.fillText("Powered by ACRCloud", 50, 550);

      const finalImage = canvas.toBuffer();

      return await client.sendMessage(
        jid,
        {
          image: finalImage,
          caption: `🎶 *Song Identified*\n\n*${title}* — ${artists}`
        },
        { quoted: msg }
      );

    } catch (err) {
      console.error("Shazam Error:", err);
      return ctx.reply("❌ Could not recognize the song.");
    }
  }
};
