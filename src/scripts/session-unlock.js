const { config } = require("../config/env");
const { createLogger } = require("../config/logger");
const { connectDatabase, disconnectDatabase } = require("../core/database");
const RuntimeLease = require("../models/runtime-lease");

async function main() {
  if (!process.argv.includes("--confirm")) {
    process.stderr.write(
      "Refusing to clear the runtime lease without --confirm.\nUsage: npm run session:unlock -- --confirm\n",
    );
    process.exitCode = 1;
    return;
  }

  const logger = createLogger(config);

  try {
    await connectDatabase({ config, logger });
    const key = `whatsapp-session:${config.sessionId}`;
    const result = await RuntimeLease.deleteOne({ key });
    logger.warn(
      {
        area: "RUNTIME",
        sessionId: config.sessionId,
        deletedCount: result?.deletedCount || 0,
      },
      "Cleared runtime lease for current WhatsApp session",
    );
  } finally {
    await disconnectDatabase({ logger }).catch(() => {});
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exit(1);
});
