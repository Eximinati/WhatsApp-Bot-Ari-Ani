import type { WAMessage } from 'baileys'

export class LegacyRuntimeAdapter {
    private asRecord(value: unknown): Record<string, unknown> | null {
        if (typeof value !== 'object' || value === null) {
            return null
        }
        return value as unknown as Record<string, unknown>
    }

    safeNormalize(raw: unknown): WAMessage | null {
        const msg = this.asRecord(raw)
        if (!msg) return null

        const keyRecord = this.asRecord(msg.key)
        if (!keyRecord || !keyRecord.id) return null
        if (!keyRecord.remoteJid) return null

        return raw as WAMessage
    }
}