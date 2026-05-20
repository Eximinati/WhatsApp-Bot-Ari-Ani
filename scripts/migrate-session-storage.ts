import 'dotenv/config'
import mongoose from 'mongoose'
import crypto from 'crypto'
import { decryptString } from '../src/utils/secure-store.js'
import { BufferJSON } from '../src/utils/buffer-json.js'
import SessionModel from '../src/core/Mongo/Models/Session.js'
import SessionCredsModel from '../src/core/Mongo/Models/SessionCreds.js'
import SessionKeyModel from '../src/core/Mongo/Models/SessionKey.js'

const PREFIX = "enc:v1"

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const apply = args.includes('--apply')

if (!dryRun && !apply) {
    console.log('Usage: npx tsx scripts/migrate-session-storage.ts [--dry-run|--apply]')
    process.exit(1)
}

const keyMap: Record<string, string> = {
    "pre-key": "preKeys",
    session: "sessions",
    "sender-key": "senderKeys",
    "app-state-sync-key": "appStateSyncKeys",
    "app-state-sync-version": "appStateVersions",
    "sender-key-memory": "senderKeyMemory",
    "device-list": "deviceLists",
    "identity-key": "identityKeys",
    "lid-mapping": "lidMappings",
    tctoken: "tcTokens"
}

function encryptString(value: string, secret: string): string {
    if (!secret || !value) return value
    const iv = crypto.randomBytes(12)
    const key = crypto.createHash("sha256").update(String(secret)).digest()
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
    const tag = cipher.getAuthTag()
    return [PREFIX, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":")
}

async function main() {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL
    if (!mongoUri) {
        console.error('MONGODB_URI or MONGO_URL not set')
        process.exit(1)
    }

    await mongoose.connect(mongoUri)
    console.log(`[MIGRATION] Connected to MongoDB`)

    const sessions = await SessionModel.find({}).lean()
    console.log(`[MIGRATION] Found ${sessions.length} sessions to migrate`)

    let migrated = 0
    let skipped = 0
    let errors = 0

    for (const session of sessions) {
        const sessionId = session.sessionId
        const encryptionKey = session.encryptionKey || process.env.APP_ENCRYPTION_KEY || ''

        if (!session.session && !session.creds) {
            console.log(`[MIGRATION] ${sessionId}: No data, skipping`)
            skipped++
            continue
        }

        let creds = null
        let keys: Record<string, Record<string, unknown>> = {}

        if (session.session) {
            try {
                const parsed = JSON.parse(decryptString(session.session as string, encryptionKey), BufferJSON.reviver)
                creds = parsed.creds
                keys = parsed.keys || {}
            } catch (error) {
                console.error(`[MIGRATION] ${sessionId}: Failed to parse session blob - ${error}`)
                errors++
                continue
            }
        }

        if (session.creds && !creds) {
            try {
                creds = JSON.parse(decryptString(session.creds as string, encryptionKey), BufferJSON.reviver)
            } catch {
                console.log(`[MIGRATION] ${sessionId}: Legacy creds parse failed`)
            }
        }

        if (!creds && Object.keys(keys).length === 0) {
            console.log(`[MIGRATION] ${sessionId}: Empty session, skipping`)
            skipped++
            continue
        }

        let keyCount = 0
        for (const keyRecords of Object.values(keys)) {
            keyCount += Object.keys(keyRecords as Record<string, unknown>).length
        }
        console.log(`[MIGRATION] ${sessionId}: creds=${creds ? 'yes' : 'no'}, keyCategories=${Object.keys(keys).length}, totalKeys=${keyCount}`)

        if (apply) {
            const bulkOps: { updateOne: { filter: object; update: object; upsert: boolean } }[] = []

            if (creds) {
                const credsPayload = encryptString(JSON.stringify(creds, BufferJSON.replacer, 2), encryptionKey)
                await SessionCredsModel.updateOne(
                    { sessionId },
                    { $set: { sessionId, creds: credsPayload, encryptionKey } },
                    { upsert: true }
                )
            }

            for (const [category, keyRecords] of Object.entries(keys)) {
                const storeKey = category
                for (const [keyId, value] of Object.entries(keyRecords as Record<string, unknown>)) {
                    if (value === null || typeof value === 'undefined') continue
                    const serialized = JSON.stringify(value, BufferJSON.replacer, 2)
                    const encrypted = encryptString(serialized, encryptionKey)
                    bulkOps.push({
                        updateOne: {
                            filter: { sessionId, category: storeKey, keyId },
                            update: { $set: { sessionId, category: storeKey, keyId, value: encrypted, encryptionKey } },
                            upsert: true
                        }
                    })
                }
            }

            if (bulkOps.length > 0) {
                await SessionKeyModel.bulkWrite(bulkOps, { ordered: true })
            }

            await SessionModel.updateOne(
                { sessionId },
                { $set: { session: '', creds: '' } }
            )

            console.log(`[MIGRATION] ${sessionId}: Applied ${bulkOps.length} key records`)
        }

        migrated++
    }

    console.log(`\n[MIGRATION] Summary: migrated=${migrated}, skipped=${skipped}, errors=${errors}`)

    if (dryRun) {
        console.log('[MIGRATION] Dry run complete - no changes made')
    } else {
        console.log('[MIGRATION] Migration complete - old sessions collection preserved')
        console.log('[MIGRATION] Run again without --apply to verify, or drop sessions collection manually')
    }

    await mongoose.disconnect()
}

main().catch(console.error)