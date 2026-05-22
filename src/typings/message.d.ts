import type { WAMessage } from 'baileys'
import type {
    MessageType,
    Mimetype
} from '../core/types.js'
import type {
    IExtendedGroupMetadata
} from './index.js'

export type { WAMessage }

export interface ISimplifiedMessage {
    readonly type: MessageType | string
    readonly content: string | null
    readonly args: string[]

    reply(
        content: string | Buffer,
        type?: MessageType | string,
        mime?: Mimetype | string,
        mention?: string[],
        caption?: string,
        thumbnail?: Buffer
    ): Promise<any>

    mentioned: string[]

    readonly groupMetadata:
        | IExtendedGroupMetadata
        | null

    readonly chat: 'group' | 'dm'

    readonly from: string

    readonly pushName?: string

    readonly sender: {
        jid: string
        username: string
        isAdmin: boolean
    }

    readonly quoted?: {
        message?: WAMessage | null
        sender?: string | null
    } | null

    readonly WAMessage: WAMessage

    readonly urls: string[]

    /** @internal Set by MessagePipeline to prevent duplicate processing. */
    _pipelineProcessed?: boolean
    /** @internal Set by media commands to persist context across menu selections. */
    _session?: { commandName: string }
}
