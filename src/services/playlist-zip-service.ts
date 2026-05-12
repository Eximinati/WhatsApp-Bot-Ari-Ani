import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import archiver from "archiver";
import yts from "yt-search";
import { getBestMatch } from "./playlist-service";
import { PLAYLIST_LIMIT } from "./spotify-service";

const MAX_ZIP_SIZE_MB = 90;
const MAX_ZIP_SIZE_BYTES = MAX_ZIP_SIZE_MB * 1024 * 1024;

interface Track {
  title: string;
  artist: string;
  query?: string;
}

interface PlaylistData {
  name: string;
  tracks: Track[];
}

interface MessageContext {
  client?: any;
  sock?: any;
  conn?: any;
  from: string;
  msg?: any;
  reply: (text: string) => Promise<any> | any;
  services: any;
}

function getSock(ctx: MessageContext) {
  return ctx.sock || ctx.client || ctx.conn;
}

async function getDownloadUrl(url: string, title: string): Promise<string> {
  if (!url) return "";

  let mediaUrl = "";

  try {
    const { data } = await axios.get(
      `https://apis.davidcyril.name.ng/play?query=${encodeURIComponent(url)}`,
      { timeout: 120000 }
    );

    if (data?.status && data?.result?.download_url) {
      mediaUrl = String(data.result.download_url);
    }
  } catch {}

  if (!mediaUrl) {
    try {
      const apiBase = "https://space2bnhz.tail9ef80b.ts.net";
      const res = await axios.post(
        `${apiBase}/song/download`,
        { title },
        { timeout: 120000 }
      );

      if (res.data?.file_url) {
        mediaUrl = String(res.data.file_url).replace(
          "http://127.0.0.1:5000",
          apiBase
        );
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
        data?.result?.download || data?.download || data?.url || "";
    } catch {}
  }

  return mediaUrl;
}

async function downloadTrack(track: Track, index: number) {
  try {
    const title = track.title || "Unknown";
    const artist = track.artist || "Unknown";
    const query = track.query || `${artist} - ${title}`;

    const tempDir = path.join(os.tmpdir(), "playlist_zip");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const fileName = `${index + 1}_${artist}_${title}.mp3`
      .replace(/[<>:"/\\|?*]/g, "_")
      .slice(0, 80);

    const filePath = path.join(tempDir, fileName);

    const search = await yts(query + " official audio");
    if (!search?.videos?.length) {
      return { success: false, track, error: "Not found" };
    }

    const info = getBestMatch(search.videos.slice(0, 5), {
      title,
      artist,
    });

    if (!info?.url) {
      return { success: false, track, error: "No match" };
    }

    const mediaUrl = await getDownloadUrl(info.url, info.title);

    if (!mediaUrl) {
      return { success: false, track, error: "No download URL" };
    }

    const response = await axios.get(mediaUrl, {
      responseType: "stream",
      timeout: 180000,
    });

    const writer = fs.createWriteStream(filePath);

    await new Promise((resolve, reject) => {
      response.data.pipe(writer);
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    const stats = fs.statSync(filePath);
    if (!stats.size) return { success: false, track, error: "Empty file" };

    return {
      success: true,
      track,
      filePath,
      fileName,
      size: stats.size,
    };
  } catch (err: any) {
    return { success: false, track, error: err.message };
  }
}

async function createZip(files: any[], zipPath: string) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve(archive.pointer()));
    archive.on("error", reject);

    archive.pipe(output);

    for (const file of files) {
      if (file.success && fs.existsSync(file.filePath)) {
        archive.file(file.filePath, { name: file.fileName });
      }
    }

    archive.finalize();
  });
}

export async function processZip(
  ctx: MessageContext,
  playlistData: PlaylistData
) {
  const sock = getSock(ctx);
  const jid = ctx.from;

  const tmpDir = path.join(os.tmpdir(), `zip_${Date.now()}`);
  const zipPath = path.join(os.tmpdir(), `playlist_${Date.now()}.zip`);

  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    const tracks = playlistData.tracks || [];

    if (!tracks.length) {
      return ctx.reply("❌ Empty playlist");
    }

    await ctx.reply(
      `📦 ZIP: ${playlistData.name} (${tracks.length} tracks)`
    );

    const downloaded: any[] = [];

    for (let i = 0; i < tracks.length; i++) {
      await ctx.reply(`📥 ${i + 1}/${tracks.length}`);

      const res = await downloadTrack(tracks[i], i);
      if (res.success) downloaded.push(res);
    }

    if (!downloaded.length) {
      return ctx.reply("❌ Nothing downloaded");
    }

    await ctx.reply("🗜️ Creating ZIP...");

    const size = await createZip(downloaded, zipPath);

    if (size > MAX_ZIP_SIZE_BYTES) {
      return ctx.reply("⚠️ ZIP too large, use stream mode");
    }

    await ctx.reply("📤 Sending ZIP...");

    await sock.sendMessage(
      jid,
      {
        document: { url: zipPath },
        mimetype: "application/zip",
        fileName: `${playlistData.name}.zip`,
      },
      ctx.msg ? { quoted: ctx.msg } : {}
    );

    await ctx.reply("✅ ZIP sent!");
  } catch (err: any) {
    await ctx.reply(`❌ ZIP failed: ${err.message}`);
  } finally {
    try {
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    } catch {}
  }
}
