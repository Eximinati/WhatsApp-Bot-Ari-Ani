const { BufferJSON } = require("../utils/buffer-json");
const { downloadMessageBuffer } = require("../utils/media");

function createStatusHandler({ logger, services }) {
  function parseRecord(record) {
    if (!record?.rawJson) {
      return null;
    }

    return JSON.parse(record.rawJson, BufferJSON.reviver);
  }

  function extractStatusPayload(rawMessage) {
    const message = rawMessage?.message || {};
    if (message.conversation || message.extendedTextMessage?.text) {
      return {
        text: message.conversation || message.extendedTextMessage?.text,
      };
    }

    if (message.imageMessage) {
      return {
        type: "image",
        caption: message.imageMessage.caption || "",
      };
    }

    if (message.videoMessage) {
      return {
        type: "video",
        caption: message.videoMessage.caption || "",
      };
    }

    return null;
  }

  return {
    async capture(rawMessage) {
      try {
        await services.messages.saveMessage(rawMessage, {
          isStatus: true,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          source: "status",
        });

        logger.info(
          {
            from: rawMessage?.key?.participant || rawMessage?.key?.remoteJid,
            messageId: rawMessage?.key?.id,
          },
          "Status captured",
        );
      } catch (error) {
        logger.error({ error }, "Failed to capture status message");
      }
    },
    async maybeResend({ sock, message }) {
      const rawText = String(message.text || "").trim().toLowerCase();
      if (!["send", "/send"].includes(rawText) || !message.quoted?.id) {
        return false;
      }

      const record = await services.messages.findStatusRecord({
        messageId: message.quoted.id,
        participant: message.quoted.sender,
      });

      if (!record) {
        await message.reply("That status was not captured or is no longer available.");
        logger.info(
          {
            area: "STATUS",
            sender: message.sender.split("@")[0],
            quotedId: message.quoted.id,
            status: "missing",
          },
          "Status resend skipped",
        );
        return true;
      }

      try {
        const rawMessage = parseRecord(record);
        const payload = extractStatusPayload(rawMessage);
        if (!payload) {
          await message.reply("That captured status type is not supported yet.");
          return true;
        }

        if (payload.type === "image" || payload.type === "video") {
          const media = await downloadMessageBuffer({
            msg: rawMessage.message[payload.type === "image" ? "imageMessage" : "videoMessage"],
            mtype: `${payload.type}Message`,
          });

          await sock.sendMessage(
            message.from,
            {
              [payload.type]: media,
              caption: payload.caption,
            },
            { quoted: message.raw },
          );
        } else {
          await sock.sendMessage(
            message.from,
            { text: payload.text },
            { quoted: message.raw },
          );
        }

        logger.info(
          {
            area: "STATUS",
            sender: message.sender.split("@")[0],
            quotedId: message.quoted.id,
            status: "resent",
          },
          "Status resend completed",
        );
      } catch (error) {
        logger.warn(
          {
            area: "STATUS",
            sender: message.sender.split("@")[0],
            quotedId: message.quoted.id,
            error,
          },
          "Status resend failed",
        );
        await message.reply("I found that status, but I could not resend it.");
      }

      return true;
    },
  };
}

module.exports = {
  createStatusHandler,
};
