import fetch from "isomorphic-unfetch";
import { getPreview, getTracks } from "spotify-url-info";

const spotifyInfo = (getTracks as any)(fetch);
const spotifyPreview = (getPreview as any);

const PLAYLIST_LIMIT = 10;
const TRACK_DELAY_MS = 2000;

type SpotifyType = "track" | "playlist" | "album";

interface ParsedSpotify {
  type: SpotifyType;
  id: string;
}

interface TrackInfo {
  title: string;
  artist: string;
  cover: string | null;
  query?: string;
}

interface PlaylistInfo {
  name: string;
  tracks: TrackInfo[];
  total: number;
}

export function parseSpotifyUrl(url: string): ParsedSpotify | null {
  const trackMatch = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
  const playlistMatch = url.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
  const albumMatch = url.match(/spotify\.com\/album\/([a-zA-Z0-9]+)/);

  if (trackMatch) return { type: "track", id: trackMatch[1] };
  if (playlistMatch) return { type: "playlist", id: playlistMatch[1] };
  if (albumMatch) return { type: "album", id: albumMatch[1] };

  return null;
}

export function isSpotifyLink(text?: string): boolean {
  return /spotify\.com\/(track|playlist|album)\//.test(text || "");
}

export async function getTrackInfo(trackId: string): Promise<TrackInfo> {
  try {
    const preview = await spotifyPreview(
      `https://open.spotify.com/track/${trackId}`
    );

    return {
      title: preview?.track ?? preview?.title ?? "Unknown",
      artist: preview?.artist ?? "Unknown Artist",
      cover: preview?.image ?? null
    };
  } catch (err: any) {
    console.log("[Spotify] Track error:", err.message);
    return { title: "Unknown", artist: "Unknown Artist", cover: null };
  }
}

export async function getPlaylistInfo(
  playlistId: string,
  limit: number = PLAYLIST_LIMIT
): Promise<PlaylistInfo | null> {
  try {
    const tracks: any[] = await spotifyInfo(
      `https://open.spotify.com/playlist/${playlistId}`
    );

    if (!Array.isArray(tracks)) return null;

    const mapped: TrackInfo[] = tracks
      .filter((t) => t?.track || t?.name)
      .slice(0, limit)
      .map((t) => ({
        title: t.track ?? t.name ?? "Unknown",
        artist: t.artist ?? "Unknown Artist",
        cover: t.image ?? null
      }));

    return {
      name: "Playlist",
      tracks: mapped,
      total: tracks.length
    };
  } catch (err: any) {
    console.log("[Spotify Playlist] Error:", err.message);
    return null;
  }
}

export async function fetchSpotifyMetadata(
  url: string,
  limit: number = PLAYLIST_LIMIT
): Promise<
  | {
      type: SpotifyType;
      name?: string;
      total?: number;
      tracks: TrackInfo[];
    }
  | null
> {
  const parsed = parseSpotifyUrl(url);
  if (!parsed) return null;

  if (parsed.type === "track") {
    const info = await getTrackInfo(parsed.id);

    return {
      type: "track",
      tracks: [
        {
          ...info,
          query: `${info.artist} - ${info.title}`
        }
      ]
    };
  }

  if (parsed.type === "playlist" || parsed.type === "album") {
    const info = await getPlaylistInfo(parsed.id, limit);
    if (!info) return null;

    return {
      type: parsed.type,
      name: info.name,
      total: info.total,
      tracks: info.tracks.map((t) => ({
        ...t,
        query: `${t.artist} - ${t.title}`
      }))
    };
  }

  return null;
}

export { PLAYLIST_LIMIT, TRACK_DELAY_MS };
