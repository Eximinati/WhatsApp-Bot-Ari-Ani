function createStatusHandler({ logger, services }) {
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
  };
}

module.exports = {
  createStatusHandler,
};
