const { initAuthCreds, proto } = require("@whiskeysockets/baileys");
const Session = require("../../models/session");
const SessionKey = require("../../models/session-key");
const { BufferJSON } = require("../../utils/buffer-json");
const { decryptString, encryptString } = require("../../utils/secure-store");

class MongoAuthStore {
  constructor({ sessionId, logger, encryptionKey }) {
    this.sessionId = sessionId;
    this.logger = logger;
    this.encryptionKey = encryptionKey;
    this.keyMap = {
      "pre-key": "preKeys",
      session: "sessions",
      "sender-key": "senderKeys",
      "app-state-sync-key": "appStateSyncKeys",
      "app-state-sync-version": "appStateVersions",
      "sender-key-memory": "senderKeyMemory",
      "device-list": "deviceLists",
      "identity-key": "identityKeys",
      "lid-mapping": "lidMappings",
      tctoken: "tcTokens",
    };
    this.reverseKeyMap = Object.fromEntries(
      Object.entries(this.keyMap).map(([type, key]) => [key, type]),
    );
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
    let legacySessionDetected = false;

    const storedState = this.parseStoredState(document?.session);
    if (storedState) {
      creds = storedState.creds || creds;
      keys = storedState.keys || {};
    } else {
      const legacyState = await this.loadLegacyState(document);
      if (legacyState) {
        creds = legacyState.creds || creds;
        keys = legacyState.keys || {};
        legacySessionDetected = true;
        await this.persistState({ creds, keys, clearLegacyStorage: true });
      }
    }

    const persistCreds = async () => {
      await this.persistState({ creds, keys });
    };

    const keyStore = {
      get: async (type, ids) => {
        const storeKey = this.keyMap[type] || type;
        const bucket = keys[storeKey] || {};

        return ids.reduce((accumulator, id) => {
          let value = bucket[id];
          if (!value) {
            return accumulator;
          }

          if (type === "app-state-sync-key") {
            const appStateSyncKeyProto =
              proto.AppStateSyncKeyData || proto.Message?.AppStateSyncKeyData;
            value = appStateSyncKeyProto.fromObject(value);
          }

          accumulator[id] = value;
          return accumulator;
        }, {});
      },
      set: async (data) => {
        for (const [type, values] of Object.entries(data || {})) {
          const storeKey = this.keyMap[type] || type;
          keys[storeKey] = keys[storeKey] || {};

          for (const [id, value] of Object.entries(values || {})) {
            if (value === null || typeof value === "undefined") {
              delete keys[storeKey][id];
            } else {
              keys[storeKey][id] = value;
            }
          }
        }

        await this.persistState({ creds, keys });
      },
    };

    return {
      state: {
        creds,
        keys: keyStore,
      },
      saveCreds: persistCreds,
      legacySessionDetected,
      clear: async () => {
        await Promise.all([
          Session.deleteOne({ sessionId: this.sessionId }),
          SessionKey.deleteMany({ sessionId: this.sessionId }),
        ]);
      },
    };
  }

  parseStoredState(serializedState) {
    if (!serializedState) {
      return null;
    }

    try {
      return JSON.parse(
        decryptString(serializedState, this.encryptionKey),
        BufferJSON.reviver,
      );
    } catch (error) {
      this.logger.warn({ error }, "Failed to parse stored WhatsApp auth session payload");
      return null;
    }
  }

  async loadLegacyState(document) {
    const legacyCreds = this.parseLegacyCreds(document?.creds);
    const legacyKeys = await this.loadLegacyKeys();

    if (!legacyCreds && Object.keys(legacyKeys).length === 0) {
      return;
    }

    return {
      creds: legacyCreds || initAuthCreds(),
      keys: legacyKeys,
    };
  }

  parseLegacyCreds(serializedCreds) {
    if (!serializedCreds) {
      return null;
    }

    try {
      return JSON.parse(
        decryptString(serializedCreds, this.encryptionKey),
        BufferJSON.reviver,
      );
    } catch (error) {
      this.logger.warn({ error }, "Failed to parse legacy stored WhatsApp creds");
      return null;
    }
  }

  async loadLegacyKeys() {
    const records = await SessionKey.find({
      sessionId: this.sessionId,
    }).lean();

    const keys = {};
    for (const record of records) {
      const storeKey = this.reverseKeyMap[record.category] || record.category;
      keys[storeKey] = keys[storeKey] || {};
      keys[storeKey][record.keyId] = this.deserializeValue(record.value, record.category);
    }

    return keys;
  }

  async persistState({ creds, keys, clearLegacyStorage = false }) {
    const payload = encryptString(
      JSON.stringify({ creds, keys }, BufferJSON.replacer, 2),
      this.encryptionKey,
    );

    await Session.updateOne(
      { sessionId: this.sessionId },
      {
        $set: {
          session: payload,
          creds: "",
        },
      },
    );

    if (clearLegacyStorage) {
      await SessionKey.deleteMany({ sessionId: this.sessionId });
    }
  }

  serializeValue(value) {
    return encryptString(
      JSON.stringify(value, BufferJSON.replacer),
      this.encryptionKey,
    );
  }

  deserializeValue(value, type) {
    let parsed = JSON.parse(
      decryptString(value, this.encryptionKey),
      BufferJSON.reviver,
    );

    if (type === "app-state-sync-key" && parsed) {
      const appStateSyncKeyProto =
        proto.AppStateSyncKeyData || proto.Message?.AppStateSyncKeyData;
      parsed = appStateSyncKeyProto.fromObject(parsed);
    }

    return parsed;
  }
}

module.exports = {
  MongoAuthStore,
};
