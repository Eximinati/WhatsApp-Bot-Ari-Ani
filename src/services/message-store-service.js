const MessageRecord = require("../models/message-record");
const { BufferJSON } = require("../utils/buffer-json");

class MessageStoreService {
  async saveMessage(rawMessage, options = {}) {
    if (!rawMessage?.key?.id || !rawMessage?.key?.remoteJid) {
      return null;
    }

    const storeKey = this.createStoreKey(rawMessage.key);
    const messageType = rawMessage.message ? Object.keys(rawMessage.message)[0] : "";
    const timestampValue = rawMessage.messageTimestamp;
    const timestamp = typeof timestampValue === "object" && typeof timestampValue?.low === "number"
      ? timestampValue.low
      : Number(timestampValue || 0);

    return MessageRecord.findOneAndUpdate(
      { storeKey },
      {
        $set: {
          remoteJid: rawMessage.key.remoteJid,
          participant: rawMessage.key.participant || "",
          messageId: rawMessage.key.id,
          fromMe: Boolean(rawMessage.key.fromMe),
          pushName: rawMessage.pushName || "",
          messageType,
          rawJson: JSON.stringify(rawMessage, BufferJSON.replacer),
          timestamp,
          isStatus: Boolean(options.isStatus || rawMessage.key.remoteJid === "status@broadcast"),
          expiresAt: options.expiresAt || null,
        },
        $setOnInsert: { storeKey },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  async saveMessages(messages, options = {}) {
    for (const message of messages || []) {
      await this.saveMessage(message, options);
    }
  }

  async getMessage(key) {
    const storeKey = this.createStoreKey(key);
    const record = await MessageRecord.findOne({ storeKey }).lean();
    if (!record?.rawJson) {
      return undefined;
    }

    const parsed = JSON.parse(record.rawJson, BufferJSON.reviver);
    return parsed.message;
  }

  async getRecord(key) {
    const storeKey = this.createStoreKey(key);
    return MessageRecord.findOne({ storeKey }).lean();
  }

  async findStatusRecord({ messageId, participant }) {
    const exact = await MessageRecord.findOne({
      remoteJid: "status@broadcast",
      messageId,
      participant: participant || { $exists: true },
    }).lean();
    if (exact) {
      return exact;
    }

    return MessageRecord.findOne({
      remoteJid: "status@broadcast",
      messageId,
    }).lean();
  }

  async applyUpdates(updates) {
    for (const update of updates || []) {
      const storeKey = this.createStoreKey(update.key);
      await MessageRecord.updateOne(
        { storeKey },
        {
          $set: {
            lastUpdateJson: JSON.stringify(update, BufferJSON.replacer),
          },
        },
      );
    }
  }

  async markDeleted(item) {
    const keys = Array.isArray(item?.keys) ? item.keys : Array.isArray(item) ? item : [];
    for (const key of keys) {
      await MessageRecord.updateOne(
        { storeKey: this.createStoreKey(key) },
        {
          $set: {
            deletedAt: new Date(),
          },
        },
      );
    }
  }

  async applyReactions(reactions) {
    for (const reaction of reactions || []) {
      await MessageRecord.updateOne(
        { storeKey: this.createStoreKey(reaction.key) },
        {
          $set: {
            reactionsJson: JSON.stringify(reaction, BufferJSON.replacer),
          },
        },
      );
    }
  }

  async applyReceipts(receipts) {
    for (const receipt of receipts || []) {
      await MessageRecord.updateOne(
        { storeKey: this.createStoreKey(receipt.key) },
        {
          $set: {
            receiptsJson: JSON.stringify(receipt, BufferJSON.replacer),
          },
        },
      );
    }
  }

  createStoreKey(key) {
    return [
      key?.remoteJid || "",
      key?.participant || "",
      key?.id || "",
    ].join(":");
  }
}

module.exports = {
  MessageStoreService,
};
