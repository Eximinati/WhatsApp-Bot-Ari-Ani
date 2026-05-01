const axios = require("axios");
const yts = require("yt-search");
const { pipeline } = require("stream");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Parse Spotify URL
function parseSpotifyUrl(url) {
  const trackMatch = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
  const playlistMatch = url.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
  const albumMatch = url.match(/spotify\.com\/album\/([a-zA-Z0-9]+)/);
  
  if (trackMatch) return { type: "track", id: trackMatch[1] };
  if (playlistMatch) return { type: "playlist", id: playlistMatch[1] };
  if (albumMatch) return { type: "album", id: albumMatch[1] };
  
  return null;
}

// Get track info from Spotify
async function getTrackInfo(trackId) {
  // Try spotifydown API first
  try {
    const response = await axios.get(
      `https://api.spotifydown.com/track/${trackId}`,
      { timeout: 10000 }
    );
    if (response.data?.success && response.data?.result) {
      return response.data.result;
    }
  } catch (e) {
    // Continue to fallback
  }
  
  // Fallback: construct basic info
  return {
    title: `Track ${trackId}`,
    artists: "Unknown Artist",
    album: "Unknown Album",
    cover: null,
    duration: null
  };
}

// Search YouTube for the track
async function searchYouTube(title, artist) {
  const query = `${title} ${artist} official audio`;
  
  try {
    const { videos } = await yts(query);
    if (videos?.length > 0) {
      // Prefer videos under 10 minutes and with "official" or "audio" in title
      const filtered = videos.filter(v => 
        v.duration?.seconds <= 600 && 
        (v.title.toLowerCase().includes("official") || 
         v.title.toLowerCase().includes("audio") ||
         v.title.toLowerCase().includes("lyrics"))
      );
      
      return filtered.length > 0 ? filtered[0] : videos[0];
    }
  } catch (e) {
    // Try without filters
    try {
      const { videos } = await yts(`${title} ${artist}`);
      if (videos?.length > 0) {
        return videos[0];
      }
    } catch (e2) {}
  }
  
  return null;
}

// Download YouTube audio using API
async function downloadYouTubeAudio(videoUrl, onProgress) {
  // Try different download APIs
  const apis = [
    // API 1: ytmp3 download
    async (url) => {
      const encodeUrl = encodeURIComponent(url);
      const response = await axios.get(
        `https://api.davidcyril.name.ng/youtube/mp3?url=${encodeUrl}`,
        { timeout: 120000 }
      );
      if (response.data?.status && response.data?.result?.download_url) {
        return { url: response.data.result.download_url, title: response.data.result.title };
      }
      return null;
    },
    // API 2: alternative
    async (url) => {
      const encodeUrl = encodeURIComponent(url);
      const response = await axios.get(
        `https://apis.davidcyril.name.ng/download/ytmp3?url=${encodeUrl}`,
        { timeout: 120000 }
      );
      if (response.data?.status && response.data?.result?.download_url) {
        return { url: response.data.result.download_url, title: response.data.result.title };
      }
      return null;
    },
    // API 3: rapidapi-ytdl
    async (url) => {
      const response = await axios.post(
        "https://yt-api.p.rapidapi.com/download",
        { url, quality: "128" },
        { 
          headers: {
            "Content-Type": "application/json",
            "X-RapidAPI-Key": "YOUR-RAPIDAPI-KEY",
            "X-RapidAPI-Host": "yt-api.p.rapidapi.com"
          },
          timeout: 120000
        }
      );
      if (response.data?.downloadUrl) {
        return { url: response.data.downloadUrl, title: response.data.title };
      }
      return null;
    }
  ];
  
  for (const api of apis) {
    try {
      const result = await api(videoUrl);
      if (result?.url) {
        return result;
      }
    } catch (e) {
      continue;
    }
  }
  
  return null;
}

module.exports = {
  meta: {
    name: "spotify",
    aliases: ["sp", "spotifydl", "spotifydown"],
    category: "music",
    description: "Download Spotify track via YouTube",
    cooldownSeconds: 60,
    access: "user",
    chat: "both",
    usage: "<spotify_url>",
  },
  async execute(ctx) {
    const { args, reply } = ctx;
    
    if (!args[0]) {
      await reply(
        "🎵 *Spotify Downloader*\n\n" +
        "Usage: /spotify <spotify_track_url>\n" +
        "Example: /spotify https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT\n\n" +
        "Note: Downloads via YouTube for legal, publicly available versions."
      );
      return;
    }
    
    const url = args.join(" ");
    const parsed = parseSpotifyUrl(url);
    
    if (!parsed) {
      await reply("❌ Invalid Spotify URL. Use a Spotify track, playlist, or album link.");
      return;
    }
    
    if (parsed.type !== "track") {
      await reply(`❌ Currently only Spotify tracks are supported.`);
      return;
    }
    
    try {
      // Step 1: Get Spotify track info
      await reply("🎵 Fetching track info from Spotify...");
      const trackInfo = await getTrackInfo(parsed.id);
      
      if (!trackInfo) {
        await reply("❌ Could not fetch track info from Spotify.");
        return;
      }
      
      const title = trackInfo.title || "Unknown";
      const artist = trackInfo.artists || "Unknown Artist";
      
      await reply(`🔍 Found: ${title} - ${artist}\n\n🔎 Searching YouTube...`);
      
      // Step 2: Search YouTube
      const youtubeResult = await searchYouTube(title, artist);
      
      if (!youtubeResult) {
        await reply(`❌ Could not find "${title}" on YouTube.`);
        return;
      }
      
      await reply(`📹 Found: ${youtubeResult.title}\n\n⏬ Initiating download...`);
      
      // Step 3: Download from YouTube
      const downloadResult = await downloadYouTubeAudio(youtubeResult.url);
      
      if (!downloadResult) {
        // Fallback: send YouTube link
        await reply(
          `🎵 *${title}*\n` +
          `👤 ${artist}\n\n` +
          `⚠️ Could not download audio directly.\n` +
          `📺 Watch on YouTube: ${youtubeResult.url}`
        );
        return;
      }
      
      // Build message
      let message = `🎵 *${title}*\n👤 ${artist}`;
      
      // Send thumbnail if available
      if (trackInfo.cover) {
        try {
          const thumbResponse = await axios.get(trackInfo.cover, {
            timeout: 10000,
            responseType: "arraybuffer"
          });
          await ctx.reply(thumbResponse.data, "image", undefined, undefined, message);
        } catch (e) {
          await reply(message);
        }
      } else {
        await reply(message);
      }
      
      // Download and send audio
      await reply("⬇️ Downloading audio...");
      
      try {
        const audioResponse = await axios.get(downloadResult.url, {
          timeout: 120000,
          responseType: "arraybuffer"
        });
        
        // Save to temp file
        const tempPath = path.join(os.tmpdir(), `spotify_${Date.now()}.mp3`);
        fs.writeFileSync(tempPath, audioResponse.data);
        
        // Send audio
        await ctx.reply(fs.readFileSync(tempPath), "audio");
        
        // Cleanup
        fs.unlinkSync(tempPath);
        
        await reply("✅ Download complete!");
        
      } catch (audioError) {
        await reply(`⚠️ Audio download failed: ${audioError.message}\n📺 YouTube: ${youtubeResult.url}`);
      }
      
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
};