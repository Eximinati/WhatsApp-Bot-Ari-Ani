import { ISimplifiedMessage } from '../typings/index.js'
import MediaMenu from '../core/MediaMenu.js'

export const handleFormatSelection = async (
    M: ISimplifiedMessage,
    session: any,
    index: number,
    commandKey: string,
    mediaMenu: MediaMenu,
    clearMenu: (jid: string, command?: string) => void,
    sendMedia: (M: ISimplifiedMessage, mode: string, data: any) => Promise<void>,
    statusReply?: string
): Promise<void> => {
    const actions = mediaMenu.createFormatActions(commandKey)
    const action = actions[String(index)]
    if (!action) {
        await M.reply('Reply with a valid number from the media format menu.')
        return
    }
    if (action.remember) {
        await mediaMenu.setPreference(M.sender.jid, commandKey, action.mode)
    }
    clearMenu(M.sender.jid, commandKey)
    if (statusReply) await M.reply(statusReply)
    return sendMedia(M, action.mode, session.data)
}
