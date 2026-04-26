const { config } = require("../config/env");
const { createLogger } = require("../config/logger");
const { connectDatabase, disconnectDatabase } = require("../core/database");
const { resetSessionState } = require("../services/session-reset-service");

async function main() {
  if (!process.argv.includes("--confirm")) {
    process.stderr.write(
      "Refusing to reset WhatsApp auth state without --confirm.\nUsage: npm run session:reset -- --confirm\n",
    );
    process.exitCode = 1;
    return;
  }

  const logger = createLogger(config);

  try {
    await connectDatabase({ config, logger });
    const result = await resetSessionState({ sessionId: config.sessionId });
    logger.info(
      {
        area: "WA_SESSION",
        sessionId: config.sessionId,
        ...result,
      },
      "WhatsApp auth session state cleared",
    );
  } finally {
    await disconnectDatabase({ logger }).catch(() => {});
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exit(1);
});
