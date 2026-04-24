const RuntimeLease = require("../models/runtime-lease");

class ActiveInstanceService {
  constructor({ config, logger, key, ownerId, ownerLabel }) {
    this.config = config;
    this.logger = logger;
    this.key = key;
    this.ownerId = ownerId;
    this.ownerLabel = ownerLabel;
  }

  createExpiry(now = new Date()) {
    return new Date(now.getTime() + this.config.runtime.leaseMs);
  }

  async acquire() {
    const now = new Date();

    try {
      const document = await RuntimeLease.findOneAndUpdate(
        {
          key: this.key,
          $or: [
            { ownerId: this.ownerId },
            { expiresAt: { $lte: now } },
          ],
        },
        {
          $set: {
            ownerId: this.ownerId,
            ownerLabel: this.ownerLabel,
            expiresAt: this.createExpiry(now),
          },
          $setOnInsert: {
            key: this.key,
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      );

      return document?.ownerId === this.ownerId;
    } catch (error) {
      if (error?.code === 11000) {
        return false;
      }
      throw error;
    }
  }

  async renew() {
    const now = new Date();
    const document = await RuntimeLease.findOneAndUpdate(
      {
        key: this.key,
        ownerId: this.ownerId,
      },
      {
        $set: {
          ownerLabel: this.ownerLabel,
          expiresAt: this.createExpiry(now),
        },
      },
      {
        new: true,
      },
    );

    return Boolean(document);
  }

  async release() {
    await RuntimeLease.deleteOne({
      key: this.key,
      ownerId: this.ownerId,
    });
  }

  async waitForAcquire() {
    const deadline = Date.now() + this.config.runtime.acquireTimeoutMs;

    while (Date.now() < deadline) {
      if (await this.acquire()) {
        return true;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, this.config.runtime.acquireRetryMs);
      });
    }

    return false;
  }
}

module.exports = {
  ActiveInstanceService,
};
