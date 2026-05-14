import Economy, { IEconomy } from '../core/Economy.js'

export default async function getEconomy(
    userId: string
): Promise<IEconomy> {
    let data = await Economy.findOne({ userId })

    if (!data) {
        data = await Economy.create({
            userId
        })
    }

    return data
}
