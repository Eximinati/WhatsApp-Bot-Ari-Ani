const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const archiver = require("archiver");
const yts = require("yt-search");
const { getBestMatch } = require("./playlist-service");
const { PLAYLIST_LIMIT } = require("./spotify-service");

const MAX_ZIP_SIZE_MB = 90;
const MAX_ZIP_SIZE_BYTES = MAX_ZIP_SIZE_MB * 1024 * 1024;

async function getDownloadUrl(url, title) {
  console.log("[ZIP-DOWNLOAD] getDownloadUrl called with url:", url, "title:", title);
  
  if (!url || typeof url !== "string") {
    console.log("[ZIP-DOWNLOAD] Invalid URL passed to getDownloadUrl");
    return "";
  }

  let mediaUrl = "";

  try {
    console.log("[ZIP-DOWNLOAD] API1: calling...");
    const { data } = await axios.get(
      `https://apis.davidcyril.name.ng/play?query=${encodeURIComponent(url)}`,
      { timeout: 120000 },
    );
    console.log("[ZIP-DOWNLOAD] API1 response:", JSON.stringify({ status: data?.status, hasUrl: !!data?.result?.download_url }));
    if (data?.status && data?.result?.download_url) {
      mediaUrl = String(data.result.download_url);
      console.log("[ZIP-DOWNLOAD] API1 got URL:", mediaUrl.substring(0, 50));
    }
  } catch (e) {
    console.log("[ZIP-DOWNLOAD] API1 failed:", e.message);
  }

  if (!mediaUrl || typeof mediaUrl !== "string") {
    try {
      console.log("[ZIP-DOWNLOAD] API2: calling...");
      const apiBase = "https://space2bnhz.tail9ef80b.ts.net";
      const response = await axios.post(
        `${apiBase}/song/download`,
        { title: String(title || "") },
        { timeout: 120000 },
      );
      console.log("[ZIP-DOWNLOAD] API2 response:", JSON.stringify({ hasFileUrl: !!response.data?.file_url }));
      if (response.data?.file_url) {
        mediaUrl = String(response.data.file_url).replace("http://127.0.0.1:5000", apiBase);
        console.log("[ZIP-DOWNLOAD] API2 got URL:", mediaUrl.substring(0, 50));
      }
    } catch (e) {
      console.log("[ZIP-DOWNLOAD] API2 failed:", e.message);
    }
  }

  if (!mediaUrl || typeof mediaUrl !== "string") {
    try {
      console.log("[ZIP-DOWNLOAD] API3: calling...");
      const { data } = await axios.get(
        `https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(url)}`,
        { timeout: 120000 },
      );
      console.log("[ZIP-DOWNLOAD] API3 response:", JSON.stringify({ hasDownload: !!data?.result?.download, hasUrl: !!data?.url }));
      const downloaded = data?.result?.download || data?.download || data?.url;
      if (downloaded && typeof downloaded === "string") {
        mediaUrl = String(downloaded);
        console.log("[ZIP-DOWNLOAD] API3 got URL:", mediaUrl.substring(0, 50));
      }
    } catch (e) {
      console.log("[ZIP-DOWNLOAD] API3 failed:", e.message);
    }
  }

  console.log("[ZIP-DOWNLOAD] Final mediaUrl:", mediaUrl ? "valid" : "empty");
  return mediaUrl || "";
}

async function downloadTrack(track, index) {
  try {
    const title = track?.title || "Unknown";
    const artist = track?.artist || "Unknown";
    const query = track?.query || `${artist} - ${title}`;

    console.log("[ZIP] Processing:", title, "Artist:", artist);
    console.log("[ZIP] Track object:", JSON.stringify({ title: typeof title, artist: typeof artist, query: typeof query }));

    console.log("[ZIP] Step 1 - Creating safe names");
    console.log("[ZIP] Step 1 - Creating safe names");
    const safeTitle = String(title || "").replace(/[<>:"/\\|?*]/g, "_").slice(0, 50);
    const safeArtist = String(artist || "").replace(/[<>:"/\\|?*]/g, "_").slice(0, 30);
    const fileName = `${index + 1}_${safeArtist}_${safeTitle}.mp3`;
    const tempDir = path.join(os.tmpdir(), "playlist-zip-temp");

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, fileName);

    console.log("[ZIP] Searching YouTube for:", query);
    const searchResult = await yts(query + " official audio");

    console.log("[ZIP] Search result:", JSON.stringify({ videosCount: searchResult?.videos?.length }));

    if (!searchResult?.videos?.length) {
      console.log("[ZIP] No videos found for:", query);
      return { success: false, track: { title, artist }, error: "Not found on YouTube" };
    }

    console.log("[ZIP] Calling getBestMatch with track:", JSON.stringify({ title: typeof title, artist: typeof artist }));
    const info = getBestMatch(searchResult.videos.slice(0, 5), { title, artist, query });

    if (!info || !info.url) {
      console.log("[ZIP] No valid YouTube match for:", query);
      return { success: false, track: { title, artist }, error: "No valid YouTube match" };
    }

    console.log("[ZIP] Selected video:", info.title, "URL:", info.url);

    const videoTitle = info?.title || title;
    const mediaUrl = await getDownloadUrl(info.url, videoTitle);

    if (!mediaUrl || typeof mediaUrl !== "string") {
      console.log("[ZIP] Download URL invalid for:", title);
      return { success: false, track: { title, artist }, error: "Could not get download URL" };
    }

    console.log("[ZIP] Downloading:", title);

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

    if (!fs.existsSync(filePath)) {
      return { success: false, track: { title, artist }, error: "File not created" };
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      fs.unlinkSync(filePath);
      return { success: false, track: { title, artist }, error: "Downloaded file is empty" };
    }

    console.log("[ZIP] Saved:", filePath, "Size:", stats.size);

    return {
      success: true,
      track: { title, artist },
      filePath,
      fileName: `${artist} - ${title}.mp3`,
      size: stats.size
    };
  } catch (err) {
    console.log("[ZIP TRACK ERROR]", err.message);
    console.log("[ZIP STACK]", err.stack);
    return { success: false, track: { title: title || "Unknown", artist: artist || "Unknown" }, error: err.message };
  }
}

async function createZip(files, zipPath) {
  console.log("[ZIP-CREATE] createZip called with", files?.length, "files");
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log("[ZIP-CREATE] ZIP created, size:", archive.pointer());
      resolve(archive.pointer());
    });
    archive.on("error", (err) => {
      console.error("[ZIP-CREATE] Archive error:", err.message);
      reject(err);
    });

    archive.pipe(output);

    for (const file of files) {
      const filePath = file?.filePath;
      const fileName = file?.fileName;
      
      if (file?.success && filePath && typeof filePath === "string" && fs.existsSync(filePath)) {
        const safeName = typeof fileName === "string" ? fileName : "unknown.mp3";
        console.log("[ZIP-CREATE] Adding file:", safeName, "path:", filePath);
        archive.file(filePath, { name: safeName });
      } else {
        console.log("[ZIP-CREATE] Skipping file:", fileName || "undefined", "success:", file?.success);
      }
    }

    archive.finalize();
  });
}

async function processZip({ ctx, playlistData }) {
  const tmpDir = path.join(os.tmpdir(), `playlist_${Date.now()}`);
  const zipPath = path.join(os.tmpdir(), `playlist_${Date.now()}.zip`);

  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    const playlistName = playlistData?.name || "playlist";
    const tracks = playlistData?.tracks || [];

    if (tracks.length === 0) {
      await ctx.reply("❌ Playlist has no tracks.");
      return;
    }

    console.log("[ZIP] Processing playlist with tracks:", tracks.length);
    const trackCount = tracks.length;
    await ctx.reply(`📦 Preparing ZIP for: *${playlistName}* (${trackCount} tracks)`);

    await ctx.reply("⬇️ Downloading tracks...");

    const downloadedFiles = [];
    let successCount = 0;

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];

      const title = track?.title || "Unknown";
      const artist = track?.artist || "Unknown";

      await ctx.reply(`📥 [${i + 1}/${trackCount}] ${artist} - ${title}`);

      const result = await downloadTrack(track, i);

      if (result.success) {
        downloadedFiles.push(result);
        successCount++;
      } else {
        await ctx.reply(`⚠️ Skipped: ${title} (${result.error})`);
      }
    }

    if (downloadedFiles.length === 0) {
      await ctx.reply("❌ All tracks failed. Cannot create ZIP.");
      return;
    }

    if (successCount === 0) {
      await ctx.reply("❌ No tracks could be downloaded. Try stream mode instead.");
      return;
    }

    await ctx.reply("🗜️ Creating ZIP file...");

    const zipSize = await createZip(downloadedFiles, zipPath);

    if (zipSize > MAX_ZIP_SIZE_BYTES) {
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }
      await ctx.reply(`⚠️ ZIP too large (${(zipSize / 1024 / 1024).toFixed(1)}MB). Falling back to stream mode.`);

      for (const file of downloadedFiles) {
        if (file.filePath && fs.existsSync(file.filePath)) {
          try { fs.unlinkSync(file.filePath); } catch (e) { /* ignore */ }
        }
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });

      await ctx.services.playlist.processStream({ ctx, playlistData });
      return;
    }

    await ctx.reply("📤 Uploading ZIP...");

    console.log("[ZIP-UPLOAD] Step 1 - Preparing variables");
    const zipFileName = String(playlistName || "playlist") + ".zip";
    console.log("[ZIP-UPLOAD] zipFileName:", zipFileName);

    const fromJid = ctx.from || (ctx.msg?.key?.remoteJid);
    console.log("[ZIP-UPLOAD] fromJid:", fromJid);

    console.log("[ZIP-UPLOAD] Step 2 - Checking ctx.sock");
    const sock = ctx.sock || ctx.client || ctx.conn;
    console.log("[ZIP-UPLOAD] sock exists:", !!sock);
    console.log("[ZIP-UPLOAD] sock type:", typeof sock);

    console.log("[ZIP-UPLOAD] Step 3 - Checking zip file");
    console.log("[ZIP-UPLOAD] zipPath:", zipPath);
    console.log("[ZIP-UPLOAD] zipPath exists:", fs.existsSync(zipPath));
    console.log("[ZIP-UPLOAD] zipPath size:", fs.existsSync(zipPath) ? fs.statSync(zipPath).size : 0);

    console.log("[ZIP-UPLOAD] Step 4 - Validating zip file");
    if (!fs.existsSync(zipPath)) {
      await ctx.reply("❌ ZIP file not found.");
      return;
    }
    const zipStats = fs.statSync(zipPath);
    console.log("[ZIP-UPLOAD] zip exists, size:", zipStats.size);

    console.log("[ZIP-UPLOAD] Step 5 - Sending message");
    const msgOptions = ctx.msg ? { quoted: ctx.msg } : {};
    console.log("[ZIP-UPLOAD] msgOptions:", JSON.stringify({ hasQuoted: !!ctx.msg }));

    console.log("[ZIP-UPLOAD] Step 6 - Calling sendMessage with url");
    console.log("[ZIP-UPLOAD] sendMessage params:", {
      to: String(fromJid),
      mimetype: String("application/zip"),
      fileName: String(zipFileName),
      zipPath: zipPath
    });

    try {
      await sock.sendMessage(String(fromJid), {
        document: { url: zipPath },
        mimetype: String("application/zip"),
        fileName: String(zipFileName),
      }, msgOptions);
    } catch (sendErr) {
      console.error("[ZIP-UPLOAD] sendMessage failed:", sendErr.message);
      console.error("[ZIP-UPLOAD] sendMessage stack:", sendErr.stack);
      throw sendErr;
    }

    await ctx.reply(`✅ ZIP sent! (${successCount} tracks, ${(zipSize / 1024 / 1024).toFixed(1)}MB)`);

  } catch (err) {
    console.error("[PlaylistZip] ========== ERROR ==========");
    console.error("[PlaylistZip] Error:", err.message);
    console.error("[PlaylistZip] Name:", err.name);
    console.error("[PlaylistZip] Stack:", err.stack);
    console.error("[PlaylistZip] ========== CONTEXT ==========");
    console.error("[PlaylistZip] ctx.from:", ctx.from);
    console.error("[PlaylistZip] ctx.msg?.key?.remoteJid:", ctx.msg?.key?.remoteJid);
    console.error("[PlaylistZip] ctx.sock exists:", !!ctx.sock);
    console.error("[PlaylistZip] zipPath:", zipPath);
    console.error("[PlaylistZip] fs.exists(zipPath):", fs.existsSync(zipPath));
    await ctx.reply(`❌ ZIP failed: ${err.message}`);
  } finally {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
  }
}

module.exports = {
  processZip,
  getDownloadUrl,
};