import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'eval',
            description: 'Evaluate JavaScript code',
            category: 'dev',
            dm: true,
            usage: `${client.config.prefix}eval <code>`,
            modsOnly: true,
            baseXp: 0
        })
    }

    run = async (
        M: ISimplifiedMessage,
        parsedArgs: IParsedArgs
    ): Promise<void> => {
        const code = parsedArgs.joined

        if (!code) {
            return void M.reply(
                `❌ Usage:\n${this.client.config.prefix}eval <JS code>`
            )
        }

        let result: string

        try {
            const output = eval(code)

            result =
                typeof output === 'string'
                    ? output
                    : JSON.stringify(output, null, 2) ||
                      'undefined'
        } catch (err: any) {
            result = err?.message || String(err)
        }

        const text =
`💻 EVAL RESULT

${result.slice(0, 1000)}`

        await M.reply(text)
    }
}
