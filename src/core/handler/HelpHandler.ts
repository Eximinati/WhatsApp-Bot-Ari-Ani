import { BaseHandler } from './types.js'
import type { ExecutionContext } from '../transport/types.js'
import type { NormalizedMessage } from '../serializer/types.js'

export class HelpHandler extends BaseHandler {
    readonly name = 'HelpHandler'
    readonly category = 'general'
    readonly description = 'Displays the help menu'
    readonly aliases = ['help', 'h']

    async execute(context: ExecutionContext, message: NormalizedMessage): Promise<{ success: boolean; response?: string }> {
        const helpText = `*Ari-Ani Command List*

❐ *General*
• ping - Pong!
• help - This menu
• hi - Greet the bot

❐ *Moderation*
• activate, deactivate - Enable/disable commands

❐ *Media*
• play - Play music
• sticker - Create sticker`

        this.sendText(context, helpText)
        return { success: true }
    }
}