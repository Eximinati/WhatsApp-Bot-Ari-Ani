import 'dotenv/config'
import mongoose from 'mongoose'
import crypto from 'crypto'
import { decryptString } from '../src/utils/secure-store.js'
import { BufferJSON } from '../src/utils/buffer-json.js'
import SessionModel from '../src/core/Mongo/Models/Session.js'
import SessionCredsModel from '../src/core/Mongo/Models/SessionCreds.js'
import SessionKeyModel from '../src/core/Mongo/Models/SessionKey.js'

const PREFIX = "enc:v1"

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

async function main() {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL
    if (!mongoUri) {
        console.error('MONGODB_URI or MONGO_URL not set')
        process.exit(1)
    }

    await mongoose.connect(mongoUri)
    console.log('[VALIDATION] Connected to MongoDB\n')

    const checks = {
        credsKeyConsistency: true,
        missingKeyCategories: [] as string[],
        orphanDetection: [] as string[],
        encryptionConsistency: true,
        sessionRestoreSimulation: true,
        storageStructure: true,
        multiSessionIsolation: true
    }

    console.log('=== STORAGE STRUCTURE VALIDATION ===\n')

    const oldSessions = await SessionModel.find({}).lean()
    const newCreds = await SessionCredsModel.find({}).lean()
    const totalKeys = await SessionKeyModel.countDocuments({}).lean().exec()

    console.log(`Old sessions collection docs: ${oldSessions.length}`)
    console.log(`session_creds collection docs: ${newCreds.length}`)
    console.log(`session_keys collection docs: ${totalKeys}\n`)

    const oldSessionWithData = oldSessions.filter(s => s.session || s.creds).length
    if (oldSessionWithData > 0) {
        console.log(`[WARNING] ${oldSessionWithData} old sessions still have data (not migrated)\n`)
        checks.storageStructure = false
    }

    console.log('=== CREDS/KEY CONSISTENCY CHECK ===\n')

    for (const credsDoc of newCreds) {
        const sessionId = credsDoc.sessionId
        const keyCount = await SessionKeyModel.countDocuments({ sessionId }).lean().exec()

        console.log(`Session "${sessionId}":`)
        console.log(`  - creds: ${credsDoc.creds ? 'present' : 'MISSING'}`)
        console.log(`  - keys: ${keyCount}`)

        if (!credsDoc.creds) {
            console.log(`  [ERROR] Creds missing for session "${sessionId}"`)
            checks.credsKeyConsistency = false
        }
    }

    console.log('\n=== KEY CATEGORY COVERAGE ===\n')

    const categories = Object.values(keyMap)
    const missingCategories: string[] = []

    for (const credsDoc of newCreds) {
        const sessionId = credsDoc.sessionId
        for (const category of categories) {
            const count = await SessionKeyModel.countDocuments({ sessionId, category }).lean().exec()
            if (count === 0 && category === 'preKeys') {
                console.log(`[WARNING] Session "${sessionId}" missing preKeys — QR may be required`)
                missingCategories.push(`${sessionId}:${category}`)
            }
        }
    }

    if (missingCategories.length === 0) {
        console.log('All sessions have required key categories')
    }
    checks.missingKeyCategories = missingCategories

    console.log('\n=== ORPHAN DETECTION ===\n')

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const orphanPreKeys = await SessionKeyModel.countDocuments({
        category: "preKeys",
        updatedAt: { $lt: thirtyDaysAgo }
    }).lean().exec()
    const orphanSenderKeys = await SessionKeyModel.countDocuments({
        category: "senderKeys",
        updatedAt: { $lt: thirtyDaysAgo }
    }).lean().exec()
    const orphanSessions = await SessionKeyModel.countDocuments({
        category: "sessions",
        updatedAt: { $lt: thirtyDaysAgo }
    }).lean().exec()

    console.log(`Stale preKeys (>30d): ${orphanPreKeys}`)
    console.log(`Stale senderKeys (>30d): ${orphanSenderKeys}`)
    console.log(`Stale sessions (>30d): ${orphanSessions}`)

    if (orphanPreKeys > 0 || orphanSenderKeys > 0 || orphanSessions > 0) {
        checks.orphanDetection = [
            `preKeys: ${orphanPreKeys}`,
            `senderKeys: ${orphanSenderKeys}`,
            `sessions: ${orphanSessions}`
        ]
        console.log('[MONITOR] Orphan keys detected — monitoring only, no auto-delete')
    }

    console.log('\n=== ENCRYPTION CONSISTENCY ===\n')

    const inconsistentSessions: string[] = []
    for (const credsDoc of newCreds) {
        if (!credsDoc.encryptionKey) {
            console.log(`[WARNING] Session "${credsDoc.sessionId}" has no encryptionKey stored`)
            inconsistentSessions.push(credsDoc.sessionId)
        }
    }

    const keysWithoutEncryption = await SessionKeyModel.countDocuments({ encryptionKey: "" }).lean().exec()
    if (keysWithoutEncryption > 0) {
        console.log(`[WARNING] ${keysWithoutEncryption} keys missing encryptionKey field`)
        checks.encryptionConsistency = false
    }

    if (inconsistentSessions.length === 0 && keysWithoutEncryption === 0) {
        console.log('Encryption consistency: OK')
    }

    console.log('\n=== SESSION RESTORE SIMULATION ===\n')

    for (const credsDoc of newCreds) {
        const sessionId = credsDoc.sessionId
        const encryptionKey = credsDoc.encryptionKey || process.env.APP_ENCRYPTION_KEY || ''

        if (!credsDoc.creds) {
            console.log(`[SIMULATE] ${sessionId}: QR required (no creds)`)
            continue
        }

        try {
            const creds = JSON.parse(decryptString(credsDoc.creds, encryptionKey), BufferJSON.reviver)
            const hasCreds = creds && typeof creds === 'object'
            console.log(`[SIMULATE] ${sessionId}: Restore ${hasCreds ? 'SUCCESS' : 'FAILED'}`)

            if (!hasCreds) {
                checks.sessionRestoreSimulation = false
            }

            const keyCount = await SessionKeyModel.countDocuments({ sessionId }).lean().exec()
            const sampleKeys = await SessionKeyModel.find({ sessionId }).limit(3).lean().exec()

            for (const key of sampleKeys as { keyId: string; category: string }[]) {
                try {
                    const fullKey = await SessionKeyModel.findOne({
                        sessionId,
                        category: key.category,
                        keyId: key.keyId
                    }).lean().exec()
                    if (fullKey?.value) {
                        const decrypted = decryptString(fullKey.value, encryptionKey)
                        const parsed = JSON.parse(decrypted, BufferJSON.reviver)
                        console.log(`[SIMULATE] ${sessionId}: Key "${key.category}/${key.keyId}" decrypted OK`)
                    }
                } catch {
                    console.log(`[ERROR] ${sessionId}: Key "${key.category}/${key.keyId}" decryption FAILED`)
                    checks.sessionRestoreSimulation = false
                }
            }
        } catch (error) {
            console.log(`[SIMULATE] ${sessionId}: Restore FAILED — ${error}`)
            checks.sessionRestoreSimulation = false
        }
    }

    console.log('\n=== MULTI-SESSION ISOLATION CHECK ===\n')

    if (newCreds.length > 1) {
        const sessionIds = newCreds.map(c => c.sessionId)
        console.log(`Multiple sessions detected: ${sessionIds.join(', ')}`)

        for (const sid1 of sessionIds) {
            for (const sid2 of sessionIds) {
                if (sid1 === sid2) continue
                const crossSessionKeys = await SessionKeyModel.countDocuments({
                    sessionId: sid1,
                    keyId: { $regex: `^${sid2}` }
                }).lean().exec()
                if (crossSessionKeys > 0) {
                    console.log(`[WARNING] Cross-session key leakage detected: ${sid1} has keys from ${sid2}`)
                    checks.multiSessionIsolation = false
                }
            }
        }

        const categories = Object.values(keyMap)
        for (const category of categories) {
            const allKeys = await SessionKeyModel.find({ category }).limit(1000).lean().exec()
            const bySession: Record<string, Set<string>> = {}
            for (const key of allKeys as { sessionId: string; keyId: string }[]) {
                if (!bySession[key.sessionId]) bySession[key.sessionId] = new Set()
                bySession[key.sessionId].add(key.keyId)
            }
            const sessions = Object.keys(bySession)
            if (sessions.length > 1) {
                const sharedKeyIds = new Set<string>()
                const firstKeys = bySession[sessions[0]]
                for (const keyId of firstKeys) {
                    let shared = true
                    for (let i = 1; i < sessions.length; i++) {
                        if (!bySession[sessions[i]].has(keyId)) {
                            shared = false
                            break
                        }
                    }
                    if (shared) sharedKeyIds.add(keyId)
                }
                if (sharedKeyIds.size > 0) {
                    console.log(`[INFO] Category "${category}" has ${sharedKeyIds.size} shared keyIds across sessions (expected for some types)`)
                }
            }
        }

        if (checks.multiSessionIsolation) {
            console.log('Multi-session isolation: OK')
        }
    } else {
        console.log('Single session — isolation check skipped')
    }

    console.log('\n=== CATEGORY GROWTH ANALYSIS ===\n')

    const categoryStats = await SessionKeyModel.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 }, avgSize: { $avg: { $strLenBytes: "$value" } } } },
        { $sort: { count: -1 } }
    ]).exec()

    console.log('Top categories by key count:')
    for (const stat of categoryStats.slice(0, 10) as { _id: string; count: number; avgSize: number }[]) {
        console.log(`  ${stat._id}: ${stat.count} keys, avg ${Math.round(stat.avgSize || 0)} bytes`)
    }

    console.log('\n=== RAILWAY SAFETY CHECK ===\n')

    const envKey = process.env.APP_ENCRYPTION_KEY
    if (!envKey) {
        console.log('[CRITICAL] APP_ENCRYPTION_KEY not set!')
        console.log('[RAILWAY] On ephemeral restarts, encryption key will change.')
        console.log('[RAILWAY] This will cause permanent session loss after redeploy.')
        console.log('[RAILWAY] ACTION REQUIRED: Set APP_ENCRYPTION_KEY env var on Railway.')
    } else {
        console.log('[RAILWAY] APP_ENCRYPTION_KEY is set')
        console.log('[RAILWAY] Sessions should survive redeploys')
    }

    console.log('\n=== VALIDATION SUMMARY ===\n')

    console.log(`Storage Structure:     ${checks.storageStructure ? 'PASS' : 'FAIL'}`)
    console.log(`Creds/Key Consistency: ${checks.credsKeyConsistency ? 'PASS' : 'FAIL'}`)
    console.log(`Session Restore Sim:   ${checks.sessionRestoreSimulation ? 'PASS' : 'FAIL'}`)
    console.log(`Encryption Consistency:${checks.encryptionConsistency ? 'PASS' : 'FAIL'}`)
    console.log(`Multi-Session Isol:    ${checks.multiSessionIsolation ? 'PASS' : 'FAIL'}`)
    console.log(`Missing Categories:    ${checks.missingKeyCategories.length === 0 ? 'NONE' : checks.missingKeyCategories.join(', ')}`)
    console.log(`Orphans Detected:      ${checks.orphanDetection.length === 0 ? 'NONE' : checks.orphanDetection.join(', ')}`)

    const allPass = checks.credsKeyConsistency && checks.encryptionConsistency &&
        checks.sessionRestoreSimulation && checks.storageStructure

    console.log(`\nOverall: ${allPass ? 'PASS' : 'NEEDS ATTENTION'}`)

    await mongoose.disconnect()
}

main().catch(console.error)