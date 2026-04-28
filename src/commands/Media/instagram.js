const axios = require("axios");

module.exports = {
  meta: {
    name: "instagram",
    aliases: ["ig", "insta"],
    category: "media",
    cooldownSeconds: 4,
    access: "user",
    chat: "both",
    usage: "instagram <url> [--all | --1 | --2]",
    description: "Download media from Instagram, supports carousel posts"
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
      return ctx.reply("🟥 Please provide an Instagram URL");
    }

    const parts = arg.split(" ").filter(Boolean);
    const url = parts[0];
    const flag = parts[1];

    if (!url.includes("instagram.com/")) {
      return ctx.reply("🟥 Invalid URL. Please provide a valid Instagram link.");
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
        return ctx.reply("🟥 No media found or link not supported.");
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

      if (mediaList.length === 0 && data.result) {
        const fallbackKeys = ["downloadUrl", "url", "video", "videoUrl", "mediaUrl", "src"];
        const found = fallbackKeys.map(k => data.result[k]).find(Boolean);

        if (found) {
          mediaList = [{
            type: found.endsWith(".mp4") ? "video" : "image",
            downloadUrl: found
          }];
        }
      }

      if (!mediaList.length) {
        return ctx.reply("🟥 No media found or unsupported post.");
      }

      // MULTI MEDIA HANDLING
      if (mediaList.length > 1) {
        if (!flag) {
          return ctx.reply(
`🟥 Multiple slides found:
 
Use:

• instagram <url> --1
• instagram <url> --all
• instagram <url> --2`
          );
        }

        if (flag === "--all") {
          for (let i = 0; i < mediaList.length; i++) {
            const m = mediaList[i];
            const downloadUrl = getDownloadUrl(m);

            const type =
              (m.type || "").includes("video") || downloadUrl?.endsWith(".mp4")
                ? "video"
                : "image";

            try {
              if (!downloadUrl) throw new Error("No URL");

              const buffer = await client.utils.getBuffer(downloadUrl);

              await client.sendMessage(
                jid,
                { [type]: buffer },
                { quoted: msg }
              );

            } catch (e) {
              await client.sendMessage(
                jid,
                {
                  text: `🔗 Slide ${i + 1} failed. Open manually: ${downloadUrl || "N/A"}`
                },
                { quoted: msg }
              );
            }
          }
          return;
        }

        let index = null;

        if (flag.startsWith("--")) {
          const n = flag.replace("--", "");
          if (/^\d+$/.test(n)) index = parseInt(n) - 1;
        } else if (/^\d+$/.test(flag)) {
          index = parseInt(flag) - 1;
        }

        if (index === null || index < 0 || index >= mediaList.length) {
          return ctx.reply(`🟥 Invalid selection. This post has ${mediaList.length} items.`);
        }

        const selected = mediaList[index];
        const downloadUrl = getDownloadUrl(selected);

        const type =
          (selected.type || "").includes("video") || downloadUrl?.endsWith(".mp4")
            ? "video"
            : "image";

        try {
          const buffer = await client.utils.getBuffer(downloadUrl);

          return await client.sendMessage(
            jid,
            { [type]: buffer },
            { quoted: msg }
          );

        } catch (e) {
          return client.sendMessage(
            jid,
            { text: `🔗 Failed to fetch media: ${downloadUrl || "N/A"}` },
            { quoted: msg }
          );
        }
      }

      // SINGLE MEDIA
      const media = mediaList[0];
      const downloadUrl = getDownloadUrl(media);

      const type =
        (media.type || "").includes("video") || downloadUrl?.endsWith(".mp4")
          ? "video"
          : "image";

      try {
        const buffer = await client.utils.getBuffer(downloadUrl);

        return await client.sendMessage(
          jid,
          { [type]: buffer },
          { quoted: msg }
        );

      } catch (e) {
        return client.sendMessage(
          jid,
          { text: `🔗 Could not fetch media: ${downloadUrl || "N/A"}` },
          { quoted: msg }
        );
      }

    } catch (err) {
      console.error("Instagram Command Error:", err);
      return ctx.reply("🟥 Failed to fetch Instagram content.");
    }
  }
};
