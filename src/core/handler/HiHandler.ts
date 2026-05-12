import { BaseHandler } from './types.js'
import type { ExecutionContext } from '../transport/types.js'
import type { NormalizedMessage } from '../serializer/types.js'

export class HiHandler extends BaseHandler {
    readonly name = 'hi'
    readonly category = 'general'
    readonly description = 'Greets the user'

    async execute(context: ExecutionContext, message: NormalizedMessage): Promise<{ success: boolean; response?: string }> {
        const sender = message.sender?.username || 'User'
        const greeting = message.chatType === 'dm'
            ? `Hello ${sender}! 👋`
            : `Hey ${sender}! 👋`

        this.sendText(context, greeting)
        return { success: true }
    }
}