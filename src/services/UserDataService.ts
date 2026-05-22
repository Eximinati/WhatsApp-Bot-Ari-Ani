import DatabaseHandler from '../pipeline/DataStore.js'
import { IGroupModel, IUserModel } from '../typings/index.js'

export default class UserDataService {
    constructor(private DB: DatabaseHandler) {}

    getUser = async (jid: string): Promise<IUserModel> =>
        (await this.DB.user.findOneAndUpdate(
            { jid },
            { $setOnInsert: { jid } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        )) as IUserModel

    getGroupData = async (jid: string): Promise<IGroupModel> =>
        (await this.DB.group.findOneAndUpdate(
            { jid },
            { $setOnInsert: { jid } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        )) as IGroupModel

    getMediaPreference = async (jid: string): Promise<'document' | 'audio' | 'video'> => {
        const user = await this.getUser(jid)
        return user.mediaPreference || 'video'
    }

    setMediaPreference = async (jid: string, pref: 'document' | 'audio' | 'video'): Promise<void> => {
        await this.DB.user.updateOne(
            { jid },
            { $set: { mediaPreference: pref } },
            { upsert: true }
        )
    }

    resetMediaPreference = async (jid: string): Promise<void> => {
        await this.DB.user.updateOne(
            { jid },
            { $unset: { mediaPreference: 1 } }
        )
    }

    banUser = async (jid: string, reason?: string): Promise<void> => {
        const $set: Record<string, unknown> = { ban: true }
        if (reason) $set.banReason = reason
        await this.DB.user.findOneAndUpdate(
            { jid },
            { $set, $setOnInsert: { jid } },
            { upsert: true, setDefaultsOnInsert: true }
        )
    }

    unbanUser = async (jid: string): Promise<void> => {
        await this.DB.user.findOneAndUpdate(
            { jid },
            { $set: { ban: false }, $unset: { banReason: 1 }, $setOnInsert: { jid } },
            { upsert: true, setDefaultsOnInsert: true }
        )
    }

    getBannedUsers = async (): Promise<Array<{ jid: string; banReason?: string }>> => {
        const docs = await this.DB.user
            .find({ ban: true })
            .sort({ _id: -1 })
            .limit(50)
            .lean()
        return docs.map((d: Record<string, unknown>) => ({
            jid: d.jid as string,
            banReason: d.banReason as string | undefined
        }))
    }
}
