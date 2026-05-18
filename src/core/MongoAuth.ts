/* eslint-disable @typescript-eslint/no-explicit-any */
import { BufferJSON, initAuthCreds } from 'baileys'
import SessionModel from './Mongo/Models/Session.js'

export async function useMongoAuthState(sessionId: string): Promise<any> {
    let creds = initAuthCreds()
    let keys: Record<string, Record<string, any>> = {}
    
    console.log('[MongoAuth] Starting auth state loader for:', sessionId)

    try {
        const doc = await SessionModel.findOne({ sessionId }).lean().exec()
        if (doc?.session) {
            try {
                const parsed = typeof doc.session === 'string' 
                    ? JSON.parse(doc.session, BufferJSON.reviver)
                    : doc.session
                if (parsed?.creds) {
                    creds = parsed.creds
                }
                if (parsed?.keys) {
                    keys = parsed.keys
                    const keyCount = Object.values(keys).reduce((acc, val) => acc + Object.keys(val || {}).length, 0)
                    console.log('[MongoAuth] Keys loaded, count:', keyCount)
                }
                console.log('[MongoAuth] Session restored from MongoDB')
            } catch (parseErr) {
                console.warn('[MongoAuth] Failed to parse session data:', parseErr)
                console.warn('[MongoAuth] Starting with fresh credentials')
            }
        } else {
            console.log('[MongoAuth] No existing session found, will create new')
        }
    } catch (err) {
        console.error('[MongoAuth] Database error:', err)
    }

    let saveTimeout: NodeJS.Timeout | null = null
    
    const scheduleSave = () => {
        if (saveTimeout) {
            clearTimeout(saveTimeout)
        }
        saveTimeout = setTimeout(async () => {
            saveTimeout = null
            try {
                const stateStr = JSON.stringify({ creds, keys }, BufferJSON.replacer)
                const state = JSON.parse(stateStr, BufferJSON.reviver)
                
                await SessionModel.findOneAndUpdate(
                    { sessionId },
                    { $set: { session: state, sessionId } },
                    { upsert: true }
                )
                console.log('[MongoAuth] Session saved to MongoDB')
            } catch (err) {
                console.error('[MongoAuth] Save error:', err)
            }
        }, 200)
    }

    return {
        state: {
            creds,
            keys: {
                get: async (type: string, ids: string[]) => {
                    const bucket = (keys[type] || {}) as Record<string, any>
                    const result: Record<string, any> = {}
                    for (const id of ids) {
                        if (bucket[id]) {
                            result[id] = bucket[id]
                        }
                    }
                    return result
                },
                set: async (data: Record<string, any>) => {
                    for (const [type, values] of Object.entries(data)) {
                        if (!keys[type]) {
                            keys[type] = {}
                        }
                        for (const [id, value] of Object.entries(values as Record<string, any>)) {
                            if (value == null) {
                                delete keys[type][id]
                            } else {
                                keys[type][id] = value
                            }
                        }
                    }
                    scheduleSave()
                }
            }
        },
        saveCreds: async () => {
            if (saveTimeout) {
                clearTimeout(saveTimeout)
            }
            try {
                const stateStr = JSON.stringify({ creds, keys }, BufferJSON.replacer)
                const state = JSON.parse(stateStr, BufferJSON.reviver)
                
                await SessionModel.findOneAndUpdate(
                    { sessionId },
                    { $set: { session: state, sessionId } },
                    { upsert: true }
                )
                console.log('[MongoAuth] Creds saved')
            } catch (err) {
                console.error('[MongoAuth] Creds save error:', err)
            }
        },
        clear: async () => {
            await SessionModel.deleteOne({ sessionId })
        }
    }
}