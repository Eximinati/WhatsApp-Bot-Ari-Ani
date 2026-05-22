import MessagePipeline from '../pipeline/MessagePipeline.js'
import { ICommand, ICommandContext, IParsedArgs, ISimplifiedMessage } from '../typings/index.js'

export default class CommandModule implements ICommand {
    constructor(public client: ICommandContext, public handler: MessagePipeline, public config: ICommand['config']) {}

    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    run = (M: ISimplifiedMessage, parsedArgs: IParsedArgs): Promise<void | never> | void | never => {
        throw new Error('run method should be defined')
    }
}