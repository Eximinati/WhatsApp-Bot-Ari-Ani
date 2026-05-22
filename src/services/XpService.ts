import type DataStore from '../pipeline/DataStore.js'

export default class XpService {
    constructor(private DB: DataStore) {}

    setXp = async (jid: string, min: number, max: number): Promise<void> => {
        const Xp = Math.floor(Math.random() * max) + min
        await this.DB.user.findOneAndUpdate(
            { jid },
            { $inc: { Xp }, $setOnInsert: { jid } },
            { upsert: true, setDefaultsOnInsert: true }
        )
    }
}
