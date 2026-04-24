const qrcode = require("qrcode");

function createConnectionEventsHandler({ config, logger, runtimeState }) {
  return {
    async onCredsUpdate(saveCreds) {
      await saveCreds();
    },
    async onConnectionUpdate(update) {
      runtimeState.connectionStatus = update.connection || runtimeState.connectionStatus;
      if (update.qr) {
        runtimeState.qr = update.qr;
        try {
          const terminalQr = await qrcode.toString(update.qr, {
            type: "terminal",
            small: true,
          });
          logger.info(
            `Scan the QR in terminal or open http://localhost:${config.port}/qr?token=${config.qrToken}`,
          );
          process.stdout.write(`${terminalQr}\n`);
        } catch (error) {
          logger.warn({ error }, "Failed to render QR in terminal");
        }
      }

      if (update.connection === "open") {
        runtimeState.qr = null;
        logger.info("WhatsApp connection opened");
      }
    },
  };
}

module.exports = {
  createConnectionEventsHandler,
};
