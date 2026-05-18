import { initAuthCreds, proto } from 'baileys'
import SessionModel from './Mongo/Models/Session.js'
import SessionKeyModel from './Mongo/Models/SessionKey.js'
import { BufferJSON } from '../utils/buffer-json.js'
import { decryptString, encryptString } from '../utils/secure-store.js'

export class MongoAuthStore {
    private sessionId: string
    private logger: { warn: (obj: object, msg: string) => void }
    private encryptionKey: string
    private keyMap: Record<string, string> = {
        "pre-key": "preKeys",
        session: "sessions",
        "sender-key": "senderKeys",
        "app-state-sync-key": "appStateSyncKeys",
        "app-state-sync-version": "appStateVersions",
        "sender-key-memory": "senderKeyMemory",
        "device-list": "deviceLists",
        "identity-key": "identityKeys",
        "lid-mapping": "lidMappings",
        tctoken: "tcTokens"
    }
    private reverseKeyMap: Record<string, string>

    constructor({ sessionId, logger, encryptionKey }: { sessionId: string; logger: { warn: (obj: object, msg: string) => void }; encryptionKey: string }) {
        this.sessionId = sessionId
        this.logger = logger
        this.encryptionKey = encryptionKey
        this.reverseKeyMap = Object.fromEntries(Object.entries(this.keyMap).map(([type, key]) => [key, type]))
    }

    async loadDocument() {
        const document = await SessionModel.findOneAndUpdate(
            { sessionId: this.sessionId },
            { $setOnInsert: { sessionId: this.sessionId, encryptionKey: this.encryptionKey } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        )
        return document
    }

    async getAuthState() {
        const document = await this.loadDocument()
        let creds = initAuthCreds()
        let keys: Record<string, Record<string, unknown>> = {}
        let legacySessionDetected = false

        if (document && (document as { encryptionKey?: string }).encryptionKey) {
            const storedKey = (document as { encryptionKey: string }).encryptionKey
            if (storedKey && storedKey !== this.encryptionKey) {
                this.logger.warn({}, `Encryption key mismatch — using stored key for session`)
                this.encryptionKey = storedKey
            }
        }

        const storedState = this.parseStoredState(document?.session as string | null)
        if (storedState) {
            creds = storedState.creds || creds
            keys = storedState.keys || {}
        } else {
            const legacyState = await this.loadLegacyState(document)
            if (legacyState) {
                creds = legacyState.creds || creds
                keys = legacyState.keys || {}
                legacySessionDetected = true
                await this.persistState({ creds, keys, clearLegacyStorage: true })
            }
        }

        const persistCreds = async () => {
            await this.persistState({ creds, keys })
        }

        const keyStore = {
            get: async (type: string, ids: string[]) => {
                const storeKey = this.keyMap[type] || type
                const bucket = keys[storeKey] || {}

                const result: Record<string, unknown> = {}
                for (const id of ids) {
                    let value = bucket[id]
                    if (!value) continue

                    if (type === "app-state-sync-key") {
                        const appStateSyncKeyProto = (proto as unknown as { AppStateSyncKeyData?: { fromObject: (v: unknown) => unknown } }).AppStateSyncKeyData || (proto as unknown as { Message?: { AppStateSyncKeyData?: { fromObject: (v: unknown) => unknown } } }).Message?.AppStateSyncKeyData
                        if (appStateSyncKeyProto) {
                            value = appStateSyncKeyProto.fromObject(value)
                        }
                    }

                    result[id] = value
                }
                return result
            },
            set: async (data: Record<string, Record<string, unknown>>) => {
                for (const [type, values] of Object.entries(data || {})) {
                    const storeKey = this.keyMap[type] || type
                    keys[storeKey] = keys[storeKey] || {}

                    for (const [id, value] of Object.entries(values || {})) {
                        if (value === null || typeof value === "undefined") {
                            delete keys[storeKey][id]
                        } else {
                            keys[storeKey][id] = value
                        }
                    }
                }

                await this.persistState({ creds, keys })
            }
        }

        return {
            state: { creds, keys: keyStore },
            saveCreds: persistCreds,
            legacySessionDetected,
            clear: async () => {
                await Promise.all([
                    SessionModel.deleteOne({ sessionId: this.sessionId }),
                    SessionKeyModel.deleteMany({ sessionId: this.sessionId })
                ])
            }
        }
    }

    parseStoredState(serializedState: string | null | undefined) {
        if (!serializedState) return null
        try {
            return JSON.parse(decryptString(serializedState, this.encryptionKey), BufferJSON.reviver)
        } catch (error) {
            this.logger.warn({ error }, "Failed to parse stored WhatsApp auth session payload")
            return null
        }
    }

    async loadLegacyState(document: unknown) {
        const legacyCreds = this.parseLegacyCreds((document as { creds?: string })?.creds)
        const legacyKeys = await this.loadLegacyKeys()
        if (!legacyCreds && Object.keys(legacyKeys).length === 0) return
        return { creds: legacyCreds || initAuthCreds(), keys: legacyKeys }
    }

    parseLegacyCreds(serializedCreds: string | null | undefined) {
        if (!serializedCreds) return null
        try {
            return JSON.parse(decryptString(serializedCreds, this.encryptionKey), BufferJSON.reviver)
        } catch (error) {
            this.logger.warn({ error }, "Failed to parse legacy stored WhatsApp creds")
            return null
        }
    }

    async loadLegacyKeys() {
        const records = await SessionKeyModel.find({ sessionId: this.sessionId }).lean()
        const keys: Record<string, Record<string, unknown>> = {}
        for (const record of records as { category: string; keyId: string; value: string }[]) {
            const storeKey = this.reverseKeyMap[record.category] || record.category
            keys[storeKey] = keys[storeKey] || {}
            keys[storeKey][record.keyId] = this.deserializeValue(record.value, record.category)
        }
        return keys
    }

    async persistState({ creds, keys, clearLegacyStorage = false }: { creds: unknown; keys: Record<string, Record<string, unknown>>; clearLegacyStorage?: boolean }) {
        const payload = encryptString(JSON.stringify({ creds, keys }, BufferJSON.replacer, 2), this.encryptionKey)
        await SessionModel.updateOne(
            { sessionId: this.sessionId },
            { $set: { session: payload, creds: "", encryptionKey: this.encryptionKey } }
        )
        if (clearLegacyStorage) {
            await SessionKeyModel.deleteMany({ sessionId: this.sessionId })
        }
    }

    deserializeValue(value: string, type: string) {
        let parsed = JSON.parse(decryptString(value, this.encryptionKey), BufferJSON.reviver)
        if (type === "app-state-sync-key" && parsed) {
            const appStateSyncKeyProto = (proto as unknown as { AppStateSyncKeyData?: { fromObject: (v: unknown) => unknown } }).AppStateSyncKeyData || (proto as unknown as { Message?: { AppStateSyncKeyData?: { fromObject: (v: unknown) => unknown } } }).Message?.AppStateSyncKeyData
            if (appStateSyncKeyProto) {
                parsed = appStateSyncKeyProto.fromObject(parsed)
            }
        }
        return parsed
    }
}