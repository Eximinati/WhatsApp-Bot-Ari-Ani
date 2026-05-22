import RuntimeClient from '../core/RuntimeClient.js'
import { MessageType } from '../core/types.js'

export default class CallDispatcher {
    constructor(public client: RuntimeClient) {}

    rejectCall = async (caller: string, callID: string): Promise<void> => {
        await this.client.rejectCall(callID, caller)
        await this.client
            .sendMessage(caller, `I'm a Bot. I'm not able to pickup calls.`, MessageType.text)
            .catch(() => undefined)
    }
}