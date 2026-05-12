import type { WAMessage } from 'baileys'
import type { NormalizedMessage, ValidationResult } from './types.js'

export interface ISerializer {
    normalize(raw: WAMessage): Promise<NormalizedMessage>
    validate(raw: WAMessage): ValidationResult
}

export interface ISerializerDependencies {
    getGroupMetadata(jid: string): Promise<import('baileys').GroupMetadata | null>
    downloadMedia(message: WAMessage): Promise<Buffer | null>
    getContact(jid: string): { notify?: string; name?: string; vname?: string }
    getConfig(): { prefix: string }
    isMe(jid: string): boolean
}