const axios = require("axios");
const yts = require("yt-search");
const { PLAYLIST_LIMIT, TRACK_DELAY_MS, delay } = require("./spotify-service");

function normalize(text) {
  if (!text || typeof text !== "string") return "";
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function getBestMatch(videos, track) {
  if (!videos?.length) return null;

  const normTitle = normalize(track.title);
  const normArtist = normalize(track.artist);
  const normQuery = track.query ? normalize(track.query) : "";

  const scored = videos.map(video => {
    const title = video.title || "";
    const normVideoTitle = normalize(title);
    const authorName = normalize(video.author?.name || "");

    let score = 0;

    if (normArtist && normTitle) {
      if (normVideoTitle.includes(normArtist) && normVideoTitle.includes(normTitle)) {
        score += 50;
      }
    }

    if (title.toLowerCase().includes("official") || title.toLowerCase().includes("official audio")) {
      score += 30;
    }

    if (video.author?.verified) {
      score += 20;
    }

    const videoDuration = video.duration?.seconds;
    const trackDuration = track.duration;
    if (videoDuration && trackDuration && Math.abs(videoDuration - trackDuration) <= 10) {
      score += 40;
    }

    if (title.toLowerCase().includes("lyrics")) {
      score -= 10;
    }
    if (title.toLowerCase().includes("remix")) {
      score -= 20;
    }
    if (title.toLowerCase().includes("cover")) {
      score -= 20;
    }
    if (title.toLowerCase().includes("sped up") || title.toLowerCase().includes("slowed")) {
      score -= 15;
    }

    return { ...video, score };
  });

  const sorted = scored.sort((a, b) => b.score - a.score);
  const best = sorted[0];

  console.log("[MatchEngine] Query:", track.query);
  console.log("[MatchEngine] Selected:", best.title, "Score:", best.score);

  if (best.score < 40) {
    return videos[0];
  }

  return best;
}

async function processStream({ ctx, playlistData }) {
  const client = ctx.client || ctx.sock || ctx.conn;
  const jid = ctx.from;
  const msg = ctx.msg;

  console.log("[Stream] Processing playlist with tracks:", playlistData.tracks.length);
  const trackCount = playlistData.tracks.length;
  await ctx.reply(`📋 Processing playlist: *${playlistData.name}* (${trackCount} tracks)`);

  let successCount = 0;
  for (let i = 0; i < playlistData.tracks.length; i++) {
    const track = playlistData.tracks[i];
    await ctx.reply(`🎵 [${i + 1}/${trackCount}] Processing: ${track.artist} - ${track.title}`);

    try {
      const { videos } = await yts(track.query + " official audio");
      if (!videos?.length) {
        await ctx.reply(`❌ Not found: ${track.query}`);
        continue;
      }

      const info = getBestMatch(videos.slice(0, 5), track);
      const url = info.url;

      let mediaUrl = "";
      try {
        const { data } = await axios.get(
          `https://apis.davidcyril.name.ng/play?query=${encodeURIComponent(url)}`,
          { timeout: 120000 },
        );
        if (data?.status && data?.result?.download_url) {
          mediaUrl = data.result.download_url;
        }
      } catch (e) { /* fallbacks */ }

      if (!mediaUrl) {
        try {
          const apiBase = "https://space2bnhz.tail9ef80b.ts.net";
          const response = await axios.post(
            `${apiBase}/song/download`,
            { title: info.title },
            { timeout: 120000 },
          );
          if (response.data?.file_url) {
            const fileUrl = response.data.file_url;
            mediaUrl = typeof fileUrl === "string" ? fileUrl.replace("http://127.0.0.1:5000", apiBase) : String(fileUrl);
          }
        } catch (e) { /* fallbacks */ }
      }

      if (!mediaUrl) {
        try {
          const { data } = await axios.get(
            `https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(url)}`,
            { timeout: 120000 },
          );
          mediaUrl = data?.result?.download || data?.download || data?.url || "";
        } catch (e) { /* fallbacks */ }
      }

      if (mediaUrl) {
        await ctx.services.media.sendOrPrompt({
          sock: client,
          message: {
            from: jid,
            senderId: msg?.senderId || ctx.msg?.senderId,
            reply: ctx.reply,
            quoted: msg,
          },
          userSettings: ctx.userSettings,
          commandName: "play",
          forcePrompt: false,
          media: {
            title: info.title,
            mediaUrl,
            messageType: "audio",
            mimetype: "audio/mpeg",
            fileName: `${info.title}.mp3`,
            contextInfo: {
              externalAdReply: {
                title: info.title,
                body: info.author?.name || "Music",
                thumbnailUrl: info.thumbnail,
                mediaType: 2,
                mediaUrl: url,
                sourceUrl: url,
              },
            },
          },
        });
        successCount++;
      } else {
        await ctx.reply(`❌ Download failed: ${track.query}`);
      }
    } catch (err) {
      await ctx.reply(`❌ Error: ${track.query}`);
    }

    if (i < playlistData.tracks.length - 1) {
      await delay(TRACK_DELAY_MS);
    }
  }

  return ctx.reply(`✅ Playlist complete! ${successCount}/${trackCount} tracks sent.`);
}

module.exports = {
  processStream,
  getBestMatch,
};