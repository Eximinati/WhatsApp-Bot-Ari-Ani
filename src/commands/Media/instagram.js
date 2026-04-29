const axios = require("axios");

function getDownloadUrl(media) {
  if (!media) {
    return null;
  }

  return (
    media.downloadUrl ||
    media.download_url ||
    media.url ||
    media.videoUrl ||
    media.mediaUrl ||
    media.src ||
    media.href ||
    null
  );
}

function isVideoMedia(media, downloadUrl) {
  return (
    (media?.type || "").includes("video") ||
    /\.mp4(\?|$)/i.test(downloadUrl || "")
  );
}

module.exports = {
  meta: {
    name: "instagram",
    aliases: ["ig", "insta"],
    category: "media",
    cooldownSeconds: 4,
    access: "user",
    chat: "both",
    usage: "instagram <url> [--all | --1 | --2 | --ask]",
    description: "Download Instagram posts, reels, and carousels",
  },

  async execute(ctx) {
    const client = ctx.client || ctx.sock || ctx.conn;
    const msg = ctx.msg;
    const jid = msg?.key?.remoteJid || ctx.from;

    if (!client?.sendMessage) {
      return ctx.reply("❌ WhatsApp client not available.");
    }

    const { args, forcePrompt } = ctx.services.media.extractControlFlags(ctx.args);
    const arg = args.join(" ").trim();
    if (!arg) {
      return ctx.reply("❌ Please provide an Instagram URL");
    }

    const parts = arg.split(" ").filter(Boolean);
    const url = parts[0];
    const flag = parts[1];

    if (!url.includes("instagram.com/")) {
      return ctx.reply("❌ Invalid Instagram URL");
    }

    try {
      const response = await axios.get(
        `https://neo-apii.vercel.app/api/igdl?url=${encodeURIComponent(url)}`,
        { timeout: 20000 },
      );
      const data = response.data;

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

      if (!mediaList.length && data.result) {
        const found = ["downloadUrl", "url", "video", "videoUrl", "mediaUrl", "src"]
          .map((key) => data.result[key])
          .find(Boolean);

        if (found) {
          mediaList = [{
            type: found.includes(".mp4") ? "video" : "image",
            downloadUrl: found,
          }];
        }
      }

      if (!mediaList.length) {
        return ctx.reply("❌ No media found in this post.");
      }

      if (mediaList.length > 1) {
        if (!flag) {
          return ctx.reply(
            [
              "❌ Multiple media found:",
              "",
              "Use:",
              "- instagram <url> --1",
              "- instagram <url> --2",
              "- instagram <url> --all",
            ].join("\n"),
          );
        }

        if (flag === "--all") {
          const preferredMode = ctx.services.media.getPreference(ctx.userSettings, "instagram");

          for (let index = 0; index < mediaList.length; index += 1) {
            const media = mediaList[index];
            const downloadUrl = getDownloadUrl(media);
            if (!downloadUrl) {
              continue;
            }

            try {
              if (!isVideoMedia(media, downloadUrl)) {
                await client.sendMessage(
                  jid,
                  { image: { url: downloadUrl } },
                  { quoted: msg },
                );
                continue;
              }

              await ctx.services.media.sendMediaByMode({
                sock: client,
                jid,
                quoted: msg,
                media: {
                  title: `Instagram Slide ${index + 1}`,
                  mediaUrl: downloadUrl,
                  messageType: "video",
                  mimetype: "video/mp4",
                  fileName: `instagram-slide-${index + 1}.mp4`,
                },
                mode: preferredMode === "document" ? "document" : "video",
              });
            } catch (error) {
              await client.sendMessage(
                jid,
                { text: `⚠ Slide ${index + 1} failed: ${downloadUrl || "N/A"}` },
                { quoted: msg },
              );
            }
          }

          return;
        }

        let index = null;
        if (flag.startsWith("--")) {
          const n = flag.replace("--", "");
          if (/^\d+$/.test(n)) {
            index = Number.parseInt(n, 10) - 1;
          }
        } else if (/^\d+$/.test(flag)) {
          index = Number.parseInt(flag, 10) - 1;
        }

        if (index === null || index < 0 || index >= mediaList.length) {
          return ctx.reply(`❌ Invalid selection. Total items: ${mediaList.length}`);
        }

        const selected = mediaList[index];
        const downloadUrl = getDownloadUrl(selected);
        if (!downloadUrl) {
          return ctx.reply("❌ Invalid media URL from API");
        }

        if (!isVideoMedia(selected, downloadUrl)) {
          return client.sendMessage(
            jid,
            { image: { url: downloadUrl } },
            { quoted: msg },
          );
        }

        return ctx.services.media.sendOrPrompt({
          sock: client,
          message: {
            from: jid,
            sender: msg?.sender || ctx.msg.sender,
            reply: ctx.reply,
            quoted: msg,
          },
          userSettings: ctx.userSettings,
          commandName: "instagram",
          forcePrompt,
          media: {
            title: `Instagram Slide ${index + 1}`,
            mediaUrl: downloadUrl,
            messageType: "video",
            mimetype: "video/mp4",
            fileName: `instagram-slide-${index + 1}.mp4`,
          },
        });
      }

      const media = mediaList[0];
      const downloadUrl = getDownloadUrl(media);
      if (!downloadUrl) {
        return ctx.reply("❌ Invalid media URL");
      }

      if (!isVideoMedia(media, downloadUrl)) {
        return client.sendMessage(
          jid,
          { image: { url: downloadUrl } },
          { quoted: msg },
        );
      }

      return ctx.services.media.sendOrPrompt({
        sock: client,
        message: {
          from: jid,
          sender: msg?.sender || ctx.msg.sender,
          reply: ctx.reply,
          quoted: msg,
        },
        userSettings: ctx.userSettings,
        commandName: "instagram",
        forcePrompt,
        media: {
          title: "Instagram Video",
          mediaUrl: downloadUrl,
          messageType: "video",
          mimetype: "video/mp4",
          fileName: "instagram-video.mp4",
        },
      });
    } catch (error) {
      console.error("Instagram Command Error:", error);
      return ctx.reply("❌ Failed to fetch Instagram content.");
    }
  },
};
