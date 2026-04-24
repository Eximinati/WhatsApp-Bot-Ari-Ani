const express = require("express");
const path = require("path");
const qrcode = require("qrcode");

function createHttpServer({ config, logger, runtimeState }) {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      status: runtimeState.connectionStatus,
      qrReady: Boolean(runtimeState.qr),
      startedAt: runtimeState.startedAt,
    });
  });

  app.get("/qr", async (req, res) => {
    const token =
      req.query.token ||
      req.query.session ||
      req.headers["x-qr-token"] ||
      req.headers["x-session-id"];
    if (String(token || "").trim() !== String(config.qrToken).trim()) {
      return res.status(403).json({ error: "Invalid QR token" });
    }

    if (runtimeState.connectionStatus === "open") {
      return res.status(409).json({ error: "Session already connected" });
    }

    if (!runtimeState.qr) {
      return res.status(404).json({ error: "QR code not ready" });
    }

    const qrBuffer = await qrcode.toBuffer(runtimeState.qr);
    res.setHeader("Content-Type", "image/png");
    res.send(qrBuffer);
  });

  if (config.publicDir) {
    app.use("/", express.static(path.resolve(config.publicDir)));
  }

  const server = app.listen(config.port);

  return new Promise((resolve, reject) => {
    server.once("listening", () => {
      logger.info({ port: config.port }, "HTTP server listening");
      resolve({
        app,
        server,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }
              closeResolve();
            });
          }),
      });
    });

    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        logger.error(
          { port: config.port },
          "HTTP port is already in use. Stop the old bot process or change PORT in .env",
        );
      } else {
        logger.error({ error }, "HTTP server failed");
      }
      reject(error);
    });
  });
}

module.exports = {
  createHttpServer,
};
