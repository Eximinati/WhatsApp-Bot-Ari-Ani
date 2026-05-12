import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'eval',
            description: 'Evaluates JavaScript',
            category: 'dev',
            dm: true,
            usage: `${client.config.prefix}eval [JS CODE]`,
            modsOnly: true,
            baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage, parsedArgs: IParsedArgs): Promise<void> => {
        let out: string
        try {
            const output = eval(parsedArgs.joined) || 'Executed JS Successfully!'
            out = typeof output === 'string' ? output : JSON.stringify(output)
        } catch (err: any) {
            out = err.message
        }
        let text = `╭──────────────────────────────╮\n│      💻  EVAL RESULT            │\n├──────────────────────────────┤\n│ ${out.substring(0,28).padEnd(28)}│\n╰──────────────────────────────╯`
        return void M.reply(text)
    }
}
