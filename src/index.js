const { bootstrap } = require("./core/bootstrap");

module.exports = bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
