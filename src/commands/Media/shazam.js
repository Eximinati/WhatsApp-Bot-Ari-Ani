const acrcloud = require("acrcloud");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const yts = require("yt-search");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

function safeString(value, fallback = "Unknown") {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || fallback;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  return fallback;
}

function joinNamedValues(items, fallback = "Unknown") {
  if (!Array.isArray(items) || !items.length) {
    return fallback;
  }

  const parts = items
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }

      if (item && typeof item.name === "string") {
        return item.name.trim();
      }

      return "";
    })
    .filter(Boolean);

  return parts.length ? parts.join(", ") : fallback;
}

function isUsableUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function buildCaption(details) {
  return [
    "🎶 *Song Identified*",
    "",
    `*Title:* ${details.title}`,
    `*Artist:* ${details.artists}`,
    `*Album:* ${details.album}`,
    `*Genre:* ${details.genres}`,
    `*Released:* ${details.release}`,
  ].join("\n");
}

async function renderSongCard(details, coverUrl) {
  const width = 900;
  const height = 600;
  const canvas = createCanvas(width, height);
  const c = canvas.getContext("2d");

  c.fillStyle = "#121212";
  c.fillRect(0, 0, width, height);

  let image = null;

  if (isUsableUrl(coverUrl)) {
    try {
      image = await loadImage(coverUrl.trim());
    } catch {
      image = null;
    }
  }

  if (image) {
    c.save();
    c.globalAlpha = 0.25;
    c.filter = "blur(40px)";
    c.drawImage(image, -200, -200, width + 400, height + 400);
    c.restore();
  }

  c.filter = "none";

  const size = 300;

  if (image) {
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
    c.drawImage(image, x, y, size, size);
    c.restore();
  }

  c.fillStyle = "#ffffff";
  c.font = "bold 42px Arial";
  c.fillText(details.title, 400, 120);

  c.fillStyle = "#b3b3b3";
  c.font = "28px Arial";
  c.fillText(details.artists, 400, 180);
  c.fillText(`Album: ${details.album}`, 400, 240);
  c.fillText(`Genre: ${details.genres}`, 400, 300);
  c.fillText(`Released: ${details.release}`, 400, 360);

  c.fillStyle = "#1DB954";
  c.fillRect(400, 420, 350, 8);

  c.beginPath();
  c.arc(520, 424, 10, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = "#1DB954";
  c.font = "bold 26px Arial";
  c.fillText("Deryl Music Recognition", 50, 520);

  c.fillStyle = "#888";
  c.font = "22px Arial";
  c.fillText("Powered by ACRCloud", 50, 550);

  return canvas.toBuffer("image/png");
}

module.exports = {
  meta: {
    name: "shazam",
    aliases: ["findsong", "musicid"],
    category: "media",
    cooldownSeconds: 4,
    access: "user",
    chat: "both",
    usage: "reply audio/video with shazam",
    description: "Identify songs from audio/video"
  },

  async execute(ctx) {
    const client = ctx.client || ctx.sock || ctx.conn;
    const msg = ctx.msg;
    const jid = msg?.key?.remoteJid || ctx.from;

    if (!client?.sendMessage) {
      return ctx.reply("❌ WhatsApp client not available.");
    }

    try {
      const quotedMsg =
        msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!quotedMsg) {
        return ctx.reply("🎵 Reply to an audio or video file.");
      }

      const media = quotedMsg.audioMessage || quotedMsg.videoMessage;

      if (!media) {
        return ctx.reply("❌ Please reply to valid media only.");
      }

      const type = media.mimetype?.includes("video") ? "video" : "audio";
      const stream = await downloadContentFromMessage(media, type);

      let buffer = Buffer.from([]);

      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      if (!buffer || buffer.length < 1000) {
        return ctx.reply("❌ Media too small or invalid.");
      }

      const acr = new acrcloud({
        host: "identify-ap-southeast-1.acrcloud.com",
        access_key: "26afd4eec96b0f5e5ab16a7e6e05ab37",
        access_secret: "wXOZIqdMNZmaHJP1YDWVyeQLg579uK2CfY6hWMN8"
      });

      const { status, metadata } = await acr.identify(buffer);

      if (status.code !== 0 || !metadata?.music?.length) {
        return ctx.reply("❌ Song not recognizable.");
      }

      const song = metadata.music[0];
      const details = {
        title: safeString(song?.title),
        artists: joinNamedValues(song?.artists),
        album: safeString(song?.album?.name),
        genres: joinNamedValues(song?.genres),
        release: safeString(song?.release_date),
      };

      let coverUrl =
        song?.album?.coverart ||
        song?.external_metadata?.spotify?.album?.images?.[0]?.url ||
        song?.external_metadata?.deezer?.album?.cover ||
        song?.external_metadata?.itunes?.album?.cover ||
        null;

      if (!isUsableUrl(coverUrl)) {
        try {
          const search = await yts(`${details.title} ${details.artists}`);
          coverUrl = search?.videos?.[0]?.thumbnail || null;
        } catch {
          coverUrl = null;
        }
      }

      const caption = buildCaption(details);

      try {
        const finalImage = await renderSongCard(details, coverUrl);
        return await client.sendMessage(
          jid,
          {
            image: finalImage,
            caption,
          },
          { quoted: msg }
        );
      } catch (renderError) {
        console.error("Shazam render error:", renderError);
        return await ctx.reply(caption);
      }
    } catch (err) {
      console.error("Shazam Error:", err);
      return ctx.reply("❌ Could not recognize the song.");
    }
  }
};
