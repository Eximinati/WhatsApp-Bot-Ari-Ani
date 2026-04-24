class KeepaliveService {
  constructor({ config, logger, pingMongo }) {
    this.config = config;
    this.logger = logger;
    this.pingMongo = pingMongo;
    this.timer = null;
  }

  shouldStart() {
    return this.config.keepalive.enabled;
  }

  start() {
    if (!this.shouldStart() || this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      this.tick().catch((error) => {
        this.logger.warn({ area: "KEEPALIVE", error }, "Keepalive tick failed");
      });
    }, this.config.keepalive.intervalMs);

    this.logger.info(
      {
        area: "KEEPALIVE",
        intervalMs: this.config.keepalive.intervalMs,
        url: this.config.keepalive.url || undefined,
        pingMongo: this.config.keepalive.pingMongo,
        pingSelf: this.config.keepalive.pingSelf,
      },
      "Keepalive enabled",
    );
  }

  stop() {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this.config.keepalive.pingMongo) {
      await this.pingMongo();
    }

    if (this.config.keepalive.pingSelf && this.config.keepalive.url) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      try {
        const response = await fetch(this.config.keepalive.url, {
          method: "GET",
          headers: {
            "cache-control": "no-cache",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Self keepalive returned HTTP ${response.status}`);
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  }
}

module.exports = {
  KeepaliveService,
};
