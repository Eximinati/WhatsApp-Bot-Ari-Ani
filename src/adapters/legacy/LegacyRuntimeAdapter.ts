import RuntimeClient from '../../core/RuntimeClient.js'
import type { WAMessage } from 'baileys'

export class LegacyRuntimeAdapter {
    constructor(private _client: RuntimeClient) {}

    get client(): RuntimeClient {
        return this._client
    }

    private asRecord(value: unknown): Record<string, unknown> | null {
        if (typeof value !== 'object' || value === null) {
            return null
        }
        return value as unknown as Record<string, unknown>
    }

    validateIncomingMessage(raw: unknown): raw is WAMessage {
        const msg = this.asRecord(raw)
        if (!msg) return false

        const keyRecord = this.asRecord(msg.key)
        if (!keyRecord || !keyRecord.id) return false
        if (!keyRecord.remoteJid) return false

        return true
    }

    validateMediaMessage(raw: unknown): raw is WAMessage {
        if (!this.validateIncomingMessage(raw)) {
            return false
        }
        const msg = this.asRecord(raw)
        if (!msg) return false

        const msgObj = this.asRecord(msg.message)
        if (!msgObj) return false

        const hasMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage']
            .some(type => type in msgObj)
        return hasMedia
    }

    safeNormalize(raw: unknown): WAMessage | null {
        if (!this.validateIncomingMessage(raw)) {
            return null
        }
        return raw as WAMessage
    }

    safeNormalizeMedia(raw: unknown): WAMessage | null {
        if (!this.validateMediaMessage(raw)) {
            return null
        }
        return raw as WAMessage
    }
}