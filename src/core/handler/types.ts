import type { NormalizedMessage } from '../serializer/types.js'
import type { ExecutionContext } from '../transport/types.js'
import type { HandlerResult } from '../middleware/types.js'

export interface DispatcherHandler {
    readonly name: string
    readonly category: string
    readonly description: string
    readonly aliases?: readonly string[]

    execute(context: ExecutionContext, message: NormalizedMessage): Promise<HandlerResult>
}

export abstract class BaseHandler implements DispatcherHandler {
    abstract readonly name: string
    abstract readonly category: string
    abstract readonly description: string

    abstract execute(context: ExecutionContext, message: NormalizedMessage): Promise<HandlerResult>

    protected sendText(context: ExecutionContext, text: string): void {
        context.transport.queueText(context.message.chatJid, text)
    }

    protected sendReply(context: ExecutionContext, text: string): void {
        if (context.message.id) {
            context.transport.queueQuote(context.message.chatJid, text, context.message.id)
        } else {
            this.sendText(context, text)
        }
    }

    protected async downloadMedia(context: ExecutionContext, messageId: string): Promise<Buffer | null> {
        return context.transport.downloadMedia(messageId)
    }
}