import axios from "axios";
import yts from "yt-search";
import { TRACK_DELAY_MS, delay } from "./spotify-service";

interface Track {
    title: string;
    artist: string;
    query?: string;
    duration?: number;
}

interface Video {
    title?: string;
    url: string;
    author?: {
        name?: string;
        verified?: boolean;
    };
    duration?: {
        seconds?: number;
    };
    thumbnail?: string;
}

interface PlaylistData {
    name: string;
    tracks: Track[];
}

function normalize(text?: string): string {
    if (!text || typeof text !== "string") return "";
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function getBestMatch(videos: Video[], track: Track): Video | null {
    if (!videos?.length) return null;

    const normTitle = normalize(track.title);
    const normArtist = normalize(track.artist);

    const scored = videos.map((video) => {
        const title = video.title || "";
        const normVideoTitle = normalize(title);

        let score = 0;

        if (
            normArtist &&
            normTitle &&
            normVideoTitle.includes(normArtist) &&
            normVideoTitle.includes(normTitle)
        ) {
            score += 50;
        }

        if (
            title.toLowerCase().includes("official") ||
            title.toLowerCase().includes("official audio")
        ) {
            score += 30;
        }

        if (video.author?.verified) {
            score += 20;
        }

        const videoDuration = video.duration?.seconds;
        const trackDuration = track.duration;

        if (
            videoDuration &&
            trackDuration &&
            Math.abs(videoDuration - trackDuration) <= 10
        ) {
            score += 40;
        }

        if (title.toLowerCase().includes("lyrics")) score -= 10;
        if (title.toLowerCase().includes("remix")) score -= 20;
        if (title.toLowerCase().includes("cover")) score -= 20;
        if (
            title.toLowerCase().includes("sped up") ||
            title.toLowerCase().includes("slowed")
        ) {
            score -= 15;
        }

        return { ...video, score };
    });

    const best = scored.sort((a, b) => b.score - a.score)[0];

    console.log(
        "[MatchEngine] Selected:",
        best?.title,
        "Score:",
        (best as any)?.score
    );

    if (!best || (best as any).score < 40) {
        return videos[0];
    }

    return best;
}

export async function processStream(
    M: any,
    playlistData: PlaylistData
): Promise<any> {
    const client = M.client || M.sock || M.conn;
    const jid = M.from;
    const msg = M.message;

    const trackCount = playlistData.tracks.length;

    console.log("[Stream] Processing playlist:", trackCount);

    await M.reply(
        `📋 Processing playlist: *${playlistData.name}* (${trackCount} tracks)`
    );

    let successCount = 0;

    for (let i = 0; i < trackCount; i++) {
        const track = playlistData.tracks[i];

        await M.reply(
            `🎵 [${i + 1}/${trackCount}] Processing: ${track.artist} - ${track.title}`
        );

        try {
            const { videos } = await yts(
                `${track.query} official audio`
            );

            if (!videos?.length) {
                await M.reply(`❌ Not found: ${track.query}`);
                continue;
            }

            const info = getBestMatch(
                videos.slice(0, 5),
                track
            );

            if (!info) continue;

            const url = info.url;

            let mediaUrl = "";

            
            try {
                const { data } = await axios.get(
                    `https://apis.davidcyril.name.ng/play?query=${encodeURIComponent(url)}`,
                    { timeout: 120000 }
                );

                if (data?.result?.download_url) {
                    mediaUrl = data.result.download_url;
                }
            } catch {}

        
            if (!mediaUrl) {
                try {
                    const base =
                        "https://space2bnhz.tail9ef80b.ts.net";

                    const res = await axios.post(
                        `${base}/song/download`,
                        { title: info.title },
                        { timeout: 120000 }
                    );

                    const fileUrl = res.data?.file_url;

                    if (fileUrl) {
                        mediaUrl =
                            typeof fileUrl === "string"
                                ? fileUrl.replace(
                                      "http://127.0.0.1:5000",
                                      base
                                  )
                                : String(fileUrl);
                    }
                } catch {}
            }

    
            if (!mediaUrl) {
                try {
                    const { data } = await axios.get(
                        `https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(url)}`,
                        { timeout: 120000 }
                    );

                    mediaUrl =
                        data?.result?.download ||
                        data?.download ||
                        data?.url ||
                        "";
                } catch {}
            }

            if (mediaUrl) {
                await client.sendMessage(
                    jid,
                    {
                        audio: { url: mediaUrl },
                        mimetype: "audio/mpeg",
                        fileName: `${info.title}.mp3`,
                        contextInfo: {
                            externalAdReply: {
                                title: info.title,
                                body: info.author?.name || "Music",
                                mediaType: 2,
                                thumbnailUrl:
                                    info.thumbnail ||
                                    `https://i.ytimg.com/vi/${info.url.split("v=")[1]}/hqdefault.jpg`,
                                mediaUrl: url,
                                sourceUrl: url
                            }
                        }
                    },
                    { quoted: msg }
                );

                successCount++;
            } else {
                await M.reply(
                    `❌ Download failed: ${track.query}`
                );
            }
        } catch {
            await M.reply(`❌ Error: ${track.query}`);
        }

        if (i < trackCount - 1) {
            await delay(TRACK_DELAY_MS);
        }
    }

    return M.reply(
        `✅ Playlist complete! ${successCount}/${trackCount} tracks sent.`
    );
}
