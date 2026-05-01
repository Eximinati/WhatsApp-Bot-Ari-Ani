const fetch = require("isomorphic-unfetch");
const { getPreview, getTracks } = require("spotify-url-info")(fetch);

const PLAYLIST_LIMIT = 10;
const TRACK_DELAY_MS = 2000;

function parseSpotifyUrl(url) {
  const trackMatch = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
  const playlistMatch = url.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
  const albumMatch = url.match(/spotify\.com\/album\/([a-zA-Z0-9]+)/);

  if (trackMatch) return { type: "track", id: trackMatch[1] };
  if (playlistMatch) return { type: "playlist", id: playlistMatch[1] };
  if (albumMatch) return { type: "album", id: albumMatch[1] };

  return null;
}

function isSpotifyLink(text) {
  return text?.includes("spotify.com/track/") || 
         text?.includes("spotify.com/playlist/") || 
         text?.includes("spotify.com/album/");
}

async function getTrackInfo(trackId) {
  try {
    const preview = await getPreview(`https://open.spotify.com/track/${trackId}`);
    return {
      title: preview.track || preview.title || "Unknown",
      artist: preview.artist || "Unknown Artist",
      cover: preview.image || null,
      duration: null
    };
  } catch (e) {
    console.log("[Spotify] Error:", e.message);
  }
  return { title: "Unknown", artist: "Unknown Artist", cover: null, duration: null };
}

async function getPlaylistInfo(playlistId) {
  try {
    const tracks = await getTracks(`https://open.spotify.com/playlist/${playlistId}`);
    const mapped = (tracks || []).slice(0, PLAYLIST_LIMIT).map(t => ({
      title: t.track || t.name || "Unknown",
      artist: t.artist || "Unknown Artist",
      cover: t.image || null
    }));
    return {
      name: "Playlist",
      tracks: mapped,
      total: tracks?.length || mapped.length
    };
  } catch (e) {
    console.log("[Spotify Playlist] Error:", e.message);
  }
  return { name: "Unknown Playlist", tracks: [], total: 0 };
}

async function fetchSpotifyMetadata(url) {
  const parsed = parseSpotifyUrl(url);
  if (!parsed) return null;

  if (parsed.type === "track" || parsed.type === "album") {
    const info = await getTrackInfo(parsed.id);
    return {
      type: "track",
      tracks: [{ ...info, query: `${info.artist} - ${info.title}` }]
    };
  }

  if (parsed.type === "playlist") {
    const info = await getPlaylistInfo(parsed.id);
    return {
      type: "playlist",
      name: info.name,
      total: info.total,
      tracks: info.tracks.map(t => ({ ...t, query: `${t.artist} - ${t.title}` }))
    };
  }

  return null;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  isSpotifyLink,
  fetchSpotifyMetadata,
  parseSpotifyUrl,
  getTrackInfo,
  getPlaylistInfo,
  PLAYLIST_LIMIT,
  TRACK_DELAY_MS,
  delay
};