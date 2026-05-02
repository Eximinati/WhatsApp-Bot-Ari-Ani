const axios = require("axios");
const yts = require("yt-search");
const { isSpotifyLink, fetchSpotifyMetadata, PLAYLIST_LIMIT, TRACK_DELAY_MS, delay } = require("../../services/spotify-service");
const { getBestMatch } = require("../../services/playlist-service");

function splitBatches(tracks, batchSize = PLAYLIST_LIMIT) {
  const batches = [];
  for (let i = 0; i < tracks.length; i += batchSize) {
    batches.push(tracks.slice(i, i + batchSize));
  }
  return batches;
}

function isOwnerOrMod(permission, userSettings) {
  console.log("[PlaylistBatch] Permission check:", JSON.stringify({ 
    isOwner: permission?.isOwner, 
    isMod: permission?.isMod,
    isStaff: permission?.isStaff,
    role: userSettings?.role,
    senderId: permission?.senderId 
  }));
  
  // Check permission object (isStaff covers both owner and mod)
  if (permission?.isStaff === true) return true;
  if (permission?.isOwner === true) return true;
  if (permission?.isMod === true) return true;
  
  // Check userSettings role
  const role = userSettings?.role?.toLowerCase();
  if (role === "owner" || role === "mod") return true;
  
  return false;
}

function parseTrackRange(arg) {
  // Match patterns like "1-100", "101-200", "1-100" at end of string
  const rangeMatch = arg.match(/(\d+)-(\d+)\s*$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (start > 0 && end >= start) {
      return { start, end };
    }
  }
  return null;
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
    usage: "<song name/link> [start-end] [--ask]",
  },

  async execute(ctx) {
    const client = ctx.client || ctx.sock || ctx.conn;
    const msg = ctx.msg;
    const jid = msg?.key?.remoteJid || ctx.from;

    if (!client?.sendMessage) {
      return ctx.reply("❌ WhatsApp client not available.");
    }

    const { args, forcePrompt } = ctx.services.media.extractControlFlags(ctx.args);
    let arg = args.join(" ").trim();
    if (!arg) {
      return ctx.reply("❗ Provide a YouTube link or song name.");
    }

    // Handle Spotify links
    if (isSpotifyLink(arg)) {
      // Parse track range flag (e.g., "1-100" or "101-200")
      const trackRange = parseTrackRange(arg);
      if (trackRange) {
        arg = arg.replace(/-\d+\s*$/, "").trim();
      }
      
      // Check if owner/mod - bypass pagination BEFORE fetching
      const isPrivileged = isOwnerOrMod(ctx.permission, ctx.userSettings);
      const fetchLimit = isPrivileged ? 5000 : 100; // Get all tracks for privileged users
      
      console.log("[Play] Fetching Spotify with limit:", fetchLimit);
      const spotifyData = await fetchSpotifyMetadata(arg, fetchLimit);
      if (!spotifyData) {
        return ctx.reply("❌ Failed to fetch Spotify data.");
      }

      // Handle playlist with queue
      if (spotifyData.type === "playlist") {
        console.log("[Play] Spotify tracks fetched:", spotifyData.tracks.length);
        console.log("[Play] Spotify total:", spotifyData.total);
        
        // Apply track range if specified
        let tracks = spotifyData.tracks;
        if (trackRange) {
          const startIndex = trackRange.start - 1;
          const endIndex = trackRange.end;
          tracks = tracks.slice(startIndex, endIndex);
          console.log("[Play] Using range:", trackRange.start, "-", trackRange.end, "tracks:", tracks.length);
        }
        
        const senderId = ctx.msg.senderId;
        const totalTracks = tracks.length;
        
        // If user specified a range OR user is privileged OR tracks <= limit, skip batch selection
        const useRange = trackRange !== null;
        
        if (isPrivileged || totalTracks <= PLAYLIST_LIMIT || useRange) {
          console.log("[PlaylistUX] isPrivileged:", isPrivileged, "totalTracks:", totalTracks, "useRange:", useRange);
          
          // Create playlist data with the tracks (already sliced if range specified)
          const playlistToSave = { ...spotifyData, tracks: tracks };
          
          console.log("[PlaylistUX] Saving tracks count:", playlistToSave.tracks.length);
          console.log("[PlaylistUX] SAVE:", senderId);
          await ctx.services.media.saveMenuState(senderId, {
            step: "playlistDelivery",
            playlistData: playlistToSave,
            expiresAt: Date.now() + 30000,
            commandName: "play",
            chatJid: ctx.from,
          });

          const label = useRange ? ` (tracks ${trackRange.start}-${trackRange.end})` : (isPrivileged ? " (full playlist)" : "");
          return ctx.reply(`📦 Playlist detected: ${spotifyData.name} (${totalTracks} tracks)${label}

Choose how you want it:

1 - Stream one by one (audio)
2 - Download as ZIP file
0 - Cancel`);
        }

        // More than 10 tracks - show batch selection
        console.log("[PlaylistBatch] SAVE:", senderId);
        const batches = splitBatches(tracks, PLAYLIST_LIMIT);
        
        await ctx.services.media.saveMenuState(senderId, {
          step: "playlistBatchSelect",
          playlistData: { ...spotifyData, tracks: tracks },
          batches: batches,
          expiresAt: Date.now() + 30000,
          commandName: "play",
          chatJid: ctx.from,
        });

        let batchMenu = `📦 Playlist detected: ${spotifyData.name} (${totalTracks} tracks)\n\nChoose range:\n`;
        batches.forEach((batch, index) => {
          const start = index * PLAYLIST_LIMIT + 1;
          const end = Math.min((index + 1) * PLAYLIST_LIMIT, totalTracks);
          batchMenu += `\n${index + 1} - Tracks ${start}–${end}`;
        });
        batchMenu += `\n\n0 - Cancel`;

        return ctx.reply(batchMenu);
      }

      // Single track or album - convert to query and continue normal flow
      const track = spotifyData.tracks[0];
      await ctx.reply(`🎵 Spotify detected: ${track.artist} - ${track.title}`);
      arg = track.query + " official audio";
    }

    try {
      let info;
      let url;

      const validYT = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//;
      const isLink = validYT.test(arg);

      if (isLink) {
        const idMatch = arg.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
        if (!idMatch) {
          return ctx.reply("❗ Invalid YouTube link.");
        }

        info = await yts({ videoId: idMatch[1] });
        url = arg.trim();
      } else {
        const { videos } = await yts(arg);
        if (!videos?.length) {
          return ctx.reply("❗ Song not found.");
        }

        info = getBestMatch(videos.slice(0, 5), { title: arg, artist: "", query: arg, duration: null });
        url = info.url;
      }

      await ctx.reply(`🎵 Preparing: *${info.title}*`);

      let mediaUrl = "";

      try {
        const { data } = await axios.get(
          `https://apis.davidcyril.name.ng/play?query=${encodeURIComponent(url)}`,
          { timeout: 120000 },
        );

        if (data?.status && data?.result?.download_url) {
          mediaUrl = data.result.download_url;
        }
      } catch (error) {
        console.log("play API1 failed:", error.message);
      }

      if (!mediaUrl) {
        try {
          const apiBase = "https://space2bnhz.tail9ef80b.ts.net";
          const response = await axios.post(
            `${apiBase}/song/download`,
            { title: info.title },
            { timeout: 120000 },
          );

          if (response.data?.file_url) {
            mediaUrl = response.data.file_url.replace("http://127.0.0.1:5000", apiBase);
          }
        } catch (error) {
          console.log("play API2 failed:", error.message);
        }
      }

      if (!mediaUrl) {
        try {
          const { data } = await axios.get(
            `https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(url)}`,
            { timeout: 120000 },
          );

          mediaUrl = data?.result?.download || data?.download || data?.url || "";
        } catch (error) {
          console.log("play API3 failed:", error.message);
        }
      }

      if (!mediaUrl) {
        return ctx.reply("❌ All download sources failed.");
      }

      return ctx.services.media.sendOrPrompt({
        sock: client,
        message: {
          from: jid,
          senderId: msg?.senderId || ctx.msg?.senderId,
          reply: ctx.reply,
          quoted: msg,
        },
        userSettings: ctx.userSettings,
        commandName: "play",
        forcePrompt,
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
    } catch (error) {
      console.error("Play Command Error:", error);
      return ctx.reply("❌ Unexpected error occurred.");
    }
  },
};
