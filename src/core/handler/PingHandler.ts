import { BaseHandler } from './types.js'
import type { ExecutionContext } from '../transport/types.js'
import type { NormalizedMessage } from '../serializer/types.js'

export class PingHandler extends BaseHandler {
    readonly name = 'PingHandler'
    readonly category = 'general'
    readonly description = 'Responds with Pong!'
    readonly aliases = ['ping', 'p']

    async execute(context: ExecutionContext, message: NormalizedMessage): Promise<{ success: boolean; response?: string }> {
        this.sendReply(context, 'Pong! 🏓')
        return { success: true }
    }
}