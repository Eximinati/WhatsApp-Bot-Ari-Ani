const { config } = require("./config/env");
const { createLogger } = require("./config/logger");
const { installTerminalOutputFilter } = require("./config/terminal-output");
const { bootstrap } = require("./core/bootstrap");

installTerminalOutputFilter();
const logger = createLogger(config);

module.exports = bootstrap().catch((error) => {
  logger.fatal({ area: "BOOT", error }, "Bootstrap failed");
  process.exit(1);
});
