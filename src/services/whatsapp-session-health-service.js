class WhatsAppSessionHealthService {
  constructor({ logger, runtimeState, sessionId }) {
    this.logger = logger;
    this.runtimeState = runtimeState;
    this.sessionId = sessionId;
    this.windowMs = 2 * 60 * 1000;
    this.threshold = 3;
    this.senderKeyFailures = [];
    this.legacySessionLogged = false;
    this.unhealthyLogged = false;
  }

  resetTransientState() {
    this.senderKeyFailures = [];
  }

  recordLegacySessionDetected() {
    if (this.legacySessionLogged) {
      return;
    }

    this.legacySessionLogged = true;
    this.logger.warn(
      {
        area: "WA_SESSION",
        sessionId: this.sessionId,
      },
      "Legacy WhatsApp auth state detected. Run `npm run session:reset -- --confirm`, restart the bot, and relink with a fresh QR.",
    );
  }

  recordInboundSenderKeyFailure({ error, rawMessage }) {
    const now = Date.now();
    this.senderKeyFailures = this.senderKeyFailures.filter(
      (timestamp) => now - timestamp < this.windowMs,
    );
    this.senderKeyFailures.push(now);

    this.logger.warn(
      {
        area: "WA_SESSION",
        sessionId: this.sessionId,
        participant: rawMessage?.key?.participant,
        chat: rawMessage?.key?.remoteJid,
        messageId: rawMessage?.key?.id,
        failuresInWindow: this.senderKeyFailures.length,
      },
      "Sender-key distribution message hit a missing session",
    );

    if (this.senderKeyFailures.length >= this.threshold) {
      this.markUnhealthy({
        reason: "relink-required",
        participant: rawMessage?.key?.participant,
        chat: rawMessage?.key?.remoteJid,
      });
    }
  }

  recordOutboundSendFailure({ jid, error }) {
    this.markUnhealthy({
      reason: "outbound-send-session-failure",
      jid,
      error,
    });
  }

  markUnhealthy(context = {}) {
    this.runtimeState.whatsappSessionHealth = "unhealthy";

    if (this.unhealthyLogged) {
      return;
    }

    this.unhealthyLogged = true;
    this.logger.error(
      {
        area: "WA_SESSION",
        sessionId: this.sessionId,
        ...context,
      },
      "WhatsApp auth session is unhealthy. Run `npm run session:reset -- --confirm`, restart the bot, and relink with a fresh QR.",
    );
  }
}

module.exports = {
  WhatsAppSessionHealthService,
};
