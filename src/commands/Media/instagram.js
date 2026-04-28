const axios = require("axios");

// 🔥 SAFE DOWNLOADER (FIX FOR YOUR ERROR)
const fetchBuffer = async (url) => {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "*/*",
      "Referer": "https://www.instagram.com/"
    }
  });

  return Buffer.from(res.data, "binary");
};

module.exports = {
  meta: {
    name: "instagram",
    aliases: ["ig", "insta"],
    category: "media",
    cooldownSeconds: 4,
    access: "user",
    chat: "both",
    usage: "instagram <url> [--all | --1 | --2]",
    description: "Download Instagram posts, reels, and carousels"
  },

  async execute(ctx) {
    const client = ctx.client || ctx.sock || ctx.conn;
    const msg = ctx.msg;
    const jid = msg?.key?.remoteJid || ctx.from;

    if (!client?.sendMessage) {
      return ctx.reply("❌ WhatsApp client not available.");
    }

    const arg = ctx.args.join(" ").trim();

    if (!arg) {
      return ctx.reply("❌ Please provide an Instagram URL");
    }

    const parts = arg.split(" ").filter(Boolean);
    const url = parts[0];
    const flag = parts[1];

    if (!url.includes("instagram.com/")) {
      return ctx.reply("❌ Invalid Instagram URL");
    }

    const getDownloadUrl = (m) => {
      if (!m) return null;
      return (
        m.downloadUrl ||
        m.download_url ||
        m.url ||
        m.videoUrl ||
        m.mediaUrl ||
        m.src ||
        m.href ||
        null
      );
    };

    try {
      const res = await axios.get(
        `https://neo-apii.vercel.app/api/igdl?url=${encodeURIComponent(url)}`,
        { timeout: 20000 }
      );

      const data = res.data;

      if (!data || (!data.status && !data.result)) {
        return ctx.reply("❌ No media found or unsupported post.");
      }

      let mediaList = [];

      if (Array.isArray(data.result?.media)) {
        mediaList = data.result.media;
      } else if (data.result?.media) {
        mediaList = [data.result.media];
      } else if (Array.isArray(data.media)) {
        mediaList = data.media;
      } else if (data.media) {
        mediaList = [data.media];
      }

      // fallback single link extraction
      if (!mediaList.length && data.result) {
        const keys = ["downloadUrl", "url", "video", "videoUrl", "mediaUrl", "src"];
        const found = keys.map(k => data.result[k]).find(Boolean);

        if (found) {
          mediaList = [{
            type: found.includes(".mp4") ? "video" : "image",
            downloadUrl: found
          }];
        }
      }

      if (!mediaList.length) {
        return ctx.reply("❌ No media found in this post.");
      }

      // ================= MULTI MEDIA =================
      if (mediaList.length > 1) {

        if (!flag) {
          return ctx.reply(
`❌ Multiple media found:

Use:

• instagram <url> --1
• instagram <url> --2
• instagram <url> --all`
          );
        }

        // ALL MEDIA
        if (flag === "--all") {
          for (let i = 0; i < mediaList.length; i++) {
            const m = mediaList[i];
            const downloadUrl = getDownloadUrl(m);

            if (!downloadUrl) continue;

            const isVideo =
              (m.type || "").includes("video") ||
              /\.mp4(\?|$)/i.test(downloadUrl);

            try {
              const buffer = await fetchBuffer(downloadUrl);

              await client.sendMessage(
                jid,
                { [isVideo ? "video" : "image"]: buffer },
                { quoted: msg }
              );

            } catch (e) {
              await client.sendMessage(
                jid,
                {
                  text: `⚠ Slide ${i + 1} failed: ${downloadUrl || "N/A"}`
                },
                { quoted: msg }
              );
            }
          }
          return;
        }

        // SINGLE INDEX
        let index = null;

        if (flag.startsWith("--")) {
          const n = flag.replace("--", "");
          if (/^\d+$/.test(n)) index = parseInt(n) - 1;
        } else if (/^\d+$/.test(flag)) {
          index = parseInt(flag) - 1;
        }

        if (index === null || index < 0 || index >= mediaList.length) {
          return ctx.reply(`❌ Invalid selection. Total items: ${mediaList.length}`);
        }

        const selected = mediaList[index];
        const downloadUrl = getDownloadUrl(selected);

        if (!downloadUrl) {
          return ctx.reply("❌ Invalid media URL from API");
        }

        const isVideo =
          (selected.type || "").includes("video") ||
          /\.mp4(\?|$)/i.test(downloadUrl);

        try {
          const buffer = await fetchBuffer(downloadUrl);

          return await client.sendMessage(
            jid,
            { [isVideo ? "video" : "image"]: buffer },
            { quoted: msg }
          );

        } catch (e) {
          return client.sendMessage(
            jid,
            { text: `🔗 Failed to load media: ${downloadUrl}` },
            { quoted: msg }
          );
        }
      }

      // ================= SINGLE MEDIA =================
      const media = mediaList[0];
      const downloadUrl = getDownloadUrl(media);

      if (!downloadUrl) {
        return ctx.reply("❌ Invalid media URL");
      }

      const isVideo =
        (media.type || "").includes("video") ||
        /\.mp4(\?|$)/i.test(downloadUrl);

      try {
        const buffer = await fetchBuffer(downloadUrl);

        return await client.sendMessage(
          jid,
          { [isVideo ? "video" : "image"]: buffer },
          { quoted: msg }
        );

      } catch (e) {
        return client.sendMessage(
          jid,
          { text: `🔗 Could not fetch media: ${downloadUrl}` },
          { quoted: msg }
        );
      }

    } catch (err) {
      console.error("Instagram Command Error:", err);
      return ctx.reply("❌ Failed to fetch Instagram content.");
    }
  }
};
