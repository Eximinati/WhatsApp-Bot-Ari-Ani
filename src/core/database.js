const mongoose = require("mongoose");

async function connectDatabase({ config, logger }) {
  mongoose.set("strictQuery", true);

  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 15_000,
    connectTimeoutMS: 15_000,
  });

  logger.info("MongoDB connected");
  return mongoose.connection;
}

async function disconnectDatabase({ logger }) {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info("MongoDB disconnected");
  }
}

async function pingDatabase() {
  if (mongoose.connection.readyState !== 1) {
    return false;
  }

  await mongoose.connection.db.admin().ping();
  return true;
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  pingDatabase,
};
