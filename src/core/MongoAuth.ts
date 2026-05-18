/* eslint-disable @typescript-eslint/no-explicit-any */
import { BufferJSON, initAuthCreds } from 'baileys'
import SessionModel from './Mongo/Models/Session.js'

export async function useMongoAuthState(sessionId: string): Promise<any> {
    let creds = initAuthCreds()

    try {
        const doc = await SessionModel.findOne({ ID: sessionId }).lean().exec()
        if (doc?.session) {
            creds = JSON.parse(JSON.stringify(doc.session), BufferJSON.reviver)
        }
    } catch {
        // fresh creds
    }

    const saveCreds = async () => {
        try {
            await SessionModel.findOneAndUpdate(
                { ID: sessionId },
                { $set: { session: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)) } },
                { upsert: true }
            )
        } catch (err) {
            console.error('[MongoAuth] Failed to save creds:', err)
        }
    }

    const keysGet = async (type: string, ids: string[]) => {
        try {
            const doc = await SessionModel.findOne({ ID: `${sessionId}:${type}` }).lean().exec()
            if (!doc?.session) return {}
            const sessionData = doc.session as any
            const keysMap: Record<string, any> = {}
            for (const id of ids) {
                const raw = JSON.stringify(sessionData[id] || {})
                keysMap[id] = Buffer.from(raw)
            }
            return keysMap
        } catch {
            return {}
        }
    }

    const keysSet = async (type: string, map: any) => {
        try {
            await SessionModel.findOneAndUpdate(
                { ID: `${sessionId}:${type}` },
                { $set: { session: JSON.parse(JSON.stringify(map, BufferJSON.replacer)) } },
                { upsert: true }
            )
        } catch (err) {
            console.error('[MongoAuth] Failed to save keys:', err)
        }
    }

    return {
        state: { creds, keys: { get: keysGet, set: keysSet } },
        saveCreds
    }
}