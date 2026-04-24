const { initAuthCreds } = require("@whiskeysockets/baileys");
const { proto } = require("@whiskeysockets/baileys/WAProto");
const Session = require("../../models/session");
const { BufferJSON } = require("../../utils/buffer-json");
const { decryptString, encryptString } = require("../../utils/secure-store");

class MongoAuthStore {
  constructor({ sessionId, logger, encryptionKey }) {
    this.sessionId = sessionId;
    this.logger = logger;
    this.encryptionKey = encryptionKey;
  }

  async loadDocument() {
    const document = await Session.findOneAndUpdate(
      { sessionId: this.sessionId },
      { $setOnInsert: { sessionId: this.sessionId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return document;
  }

  async getAuthState() {
    const document = await this.loadDocument();
    let creds = initAuthCreds();
    let keys = {};

    if (document.session) {
      try {
        const parsed = JSON.parse(
          decryptString(document.session, this.encryptionKey),
          BufferJSON.reviver,
        );
        creds = parsed.creds || creds;
        keys = parsed.keys || keys;
      } catch (error) {
        this.logger.warn({ error }, "Failed to parse auth session, resetting state");
      }
    }

    const persist = async () => {
      const payload = encryptString(
        JSON.stringify({ creds, keys }, BufferJSON.replacer, 2),
        this.encryptionKey,
      );
      await Session.updateOne(
        { sessionId: this.sessionId },
        { $set: { session: payload } },
      );
    };

    const keyStore = {
      get: async (type, ids) => {
        const key = this.mapKey(type);
        return ids.reduce((accumulator, id) => {
          let value = keys[key]?.[id];
          if (value && type === "app-state-sync-key") {
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
          }

          if (value) {
            accumulator[id] = value;
          }
          return accumulator;
        }, {});
      },
      set: async (data) => {
        for (const type of Object.keys(data)) {
          const key = this.mapKey(type);
          keys[key] = keys[key] || {};
          Object.assign(keys[key], data[type]);
        }

        await persist();
      },
    };

    return {
      state: {
        creds,
        keys: keyStore,
      },
      saveCreds: persist,
      clear: async () => {
        await Session.deleteOne({ sessionId: this.sessionId });
      },
    };
  }

  mapKey(type) {
    return {
      "pre-key": "preKeys",
      session: "sessions",
      "sender-key": "senderKeys",
      "app-state-sync-key": "appStateSyncKeys",
      "app-state-sync-version": "appStateVersions",
      "sender-key-memory": "senderKeyMemory",
    }[type];
  }
}

module.exports = {
  MongoAuthStore,
};
