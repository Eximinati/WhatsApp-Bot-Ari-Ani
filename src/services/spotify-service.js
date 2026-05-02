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

async function getPlaylistInfo(playlistId, limit = null) {
  try {
    console.log("[Spotify] Fetching playlist:", playlistId, "with limit:", limit);
    const tracks = await getTracks(`https://open.spotify.com/playlist/${playlistId}`);
    console.log("[Spotify] Raw tracks count:", tracks?.length);
    const effectiveLimit = limit !== null ? limit : PLAYLIST_LIMIT;
    const mapped = (tracks || []).slice(0, effectiveLimit).map(t => ({
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

async function fetchSpotifyMetadata(url, limit = null) {
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
    const info = await getPlaylistInfo(parsed.id, limit);
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

let spotifyAccessToken = null;
let spotifyTokenExpiry = 0;

async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log("[SpotifyAPI] Missing credentials - check SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET env vars");
    return null;
  }

  if (spotifyAccessToken && Date.now() < spotifyTokenExpiry) {
    return spotifyAccessToken;
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    const data = await response.json();
    if (data.access_token) {
      spotifyAccessToken = data.access_token;
      spotifyTokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
      console.log("[SpotifyAPI] Got new access token");
      return spotifyAccessToken;
    }
  } catch (e) {
    console.log("[SpotifyAPI] Token fetch failed:", e.message);
  }
  return null;
}

async function getFullPlaylistTracks(playlistId, maxTracks = 500) {
  const token = await getSpotifyAccessToken();
  
  if (!token) {
    console.log("[SpotifyAPI] No token - falling back to old method");
    return null;
  }

  console.log("[SpotifyAPI] Fetching full playlist:", playlistId);

  try {
    let tracks = [];
    let offset = 0;
    const limit = 100;
    let total = 0;
    let playlistName = "Playlist";

    // First call to get playlist name and total
    const initialResponse = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}`,
      {
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!initialResponse.ok) {
      console.log("[SpotifyAPI] Initial fetch failed:", initialResponse.status, initialResponse.statusText);
      const errorText = await initialResponse.text();
      console.log("[SpotifyAPI] Error response:", errorText);
      return null;
    }

    const initialData = await initialResponse.json();
    total = initialData.tracks?.total || 0;
    playlistName = initialData.name || "Playlist";

    console.log("[SpotifyAPI] Playlist name:", playlistName, "total:", total);

    // Paginate through all tracks
    while (offset < total && tracks.length < maxTracks) {
      const response = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`,
        {
          headers: { 
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      if (!response.ok) {
        console.log("[SpotifyAPI] Pagination fetch failed:", response.status, response.statusText);
        break;
      }

      const data = await response.json();
      const items = data.items || [];

      if (items.length === 0) break;

      for (const item of items) {
        const track = item?.track;
        if (!track) continue;

        const title = track.name || "Unknown";
        const artist = track.artists?.[0]?.name || "Unknown Artist";

        tracks.push({
          title,
          artist,
          query: `${artist} - ${title}`
        });
      }

      offset += limit;
      console.log("[SpotifyAPI] Fetched", tracks.length, "tracks so far");
    }

    // Slice to max
    if (tracks.length > maxTracks) {
      tracks = tracks.slice(0, maxTracks);
      console.log("[SpotifyAPI] Limited to", maxTracks, "tracks");
    }

    console.log("[SpotifyAPI] Total tracks fetched:", tracks.length);

    return {
      type: "playlist",
      name: playlistName,
      total: tracks.length,
      tracks
    };

  } catch (e) {
    console.log("[SpotifyAPI] Error:", e.message);
    return null;
  }
}

module.exports = {
  isSpotifyLink,
  fetchSpotifyMetadata,
  parseSpotifyUrl,
  getTrackInfo,
  getPlaylistInfo,
  getFullPlaylistTracks,
  getSpotifyAccessToken,
  PLAYLIST_LIMIT,
  TRACK_DELAY_MS,
  delay
};