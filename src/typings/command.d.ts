import MessagePipeline from '../pipeline/MessagePipeline.js'
import RuntimeClient from '../core/RuntimeClient.js'
import type {
    IParsedArgs,
    ISimplifiedMessage
} from './index.js'

export interface ICommand {
    client?: RuntimeClient
    handler?: MessagePipeline

    run(
        M: ISimplifiedMessage,
        parsedArgs: IParsedArgs
    ): Promise<void | never> | void | never

    config: {
        adminOnly?: boolean
        aliases?: string[]
        description?: string

        command: string

        id?: string
        name?: string

        category?: TCategory
        usage?: string

        dm?: boolean
        groupOnly?: boolean

        baseXp?: number
        modsOnly?: boolean
    }
}

export type TCategory =
    | 'anime'
    | 'bots'
    | 'config'
    | 'dev'
    | 'fun'
    | 'gaming'
    | 'educative'
    | 'general'
    | 'media'
    | 'moderation'
    | 'social'
    | 'utility'
    | 'whatsapp'
    | 'category'
    | 'system'
    | 'core'
    | 'information'
    | 'entertainment'
    | 'settings'
