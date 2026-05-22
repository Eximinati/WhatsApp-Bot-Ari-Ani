import { existsSync, mkdirSync, promises as fsPromises } from 'fs'
import { join } from 'path'
import { downloadMediaMessage as baileysDownloadMediaMessage, extractMessageContent, type WAMessage, type WAMessageContent } from 'baileys'

/** TTL for view-once snapshots before background eviction (7 days). */
const VIEW_ONCE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export default class ViewOnceService {
    constructor(
        private viewOnceDir: string,
        private log: (msg: string, isError?: boolean) => void
    ) {}

    /** Detect any view-once wrapper in `M.message` and download+save the inner
     * media to disk indexed by message id. WhatsApp's CDN expires view-once
     * media quickly, so this must run on receipt — deferred downloads fail. */
    captureViewOnce = async (M: WAMessage): Promise<void> => {
        if (!M.key.id || !M.message) return
        const msg = M.message as Record<string, unknown> & {
            viewOnceMessage?: { message?: WAMessageContent } | null
            viewOnceMessageV2?: { message?: WAMessageContent } | null
            viewOnceMessageV2Extension?: { message?: WAMessageContent } | null
        }
        const wrapper =
            msg.viewOnceMessage || msg.viewOnceMessageV2 || msg.viewOnceMessageV2Extension
        const inner = wrapper?.message || extractMessageContent(M.message)
        if (!inner) return
        const innerCast = inner as { imageMessage?: unknown; videoMessage?: unknown }
        if (!innerCast.imageMessage && !innerCast.videoMessage) return

        try {
            if (!existsSync(this.viewOnceDir)) mkdirSync(this.viewOnceDir, { recursive: true })
            const downloadable = { key: M.key, message: inner } as WAMessage
            const buffer = (await baileysDownloadMediaMessage(downloadable, 'buffer', {})) as Buffer
            const kind = innerCast.imageMessage ? 'image' : 'video'
            const path = join(this.viewOnceDir, `${M.key.id}.bin`)
            const metaPath = join(this.viewOnceDir, `${M.key.id}.json`)
            await fsPromises.writeFile(path, buffer)
            await fsPromises.writeFile(
                metaPath,
                JSON.stringify({
                    type: kind,
                    capturedAt: Date.now(),
                    from: M.key.remoteJid,
                    sender: M.key.participant || M.key.remoteJid
                })
            )
        } catch (err) {
            this.log(`Failed to capture view-once ${M.key.id}: ${String(err)}`)
        }
    }

    /** Background pruner: deletes view-once snapshots older than the TTL.
     * Runs once on connect and then every 6 hours. Idempotent and safe to skip
     * on errors (e.g. cache dir doesn't exist yet). */
    pruneViewOnce = async (): Promise<void> => {
        try {
            if (!existsSync(this.viewOnceDir)) return
            const entries = await fsPromises.readdir(this.viewOnceDir)
            const cutoff = Date.now() - VIEW_ONCE_TTL_MS
            for (const entry of entries) {
                const full = join(this.viewOnceDir, entry)
                try {
                    const stat = await fsPromises.stat(full)
                    if (stat.mtimeMs < cutoff) await fsPromises.unlink(full)
                } catch {
                    /* ignore single-file errors */
                }
            }
        } catch {
            /* ignore directory-level errors */
        }
    }

    /** Look up a captured view-once media by the original message id. Returns
     * undefined if we never saw it or the snapshot was deleted. */
    getCapturedViewOnce = async (
        id: string | null | undefined
    ): Promise<{ buffer: Buffer; type: 'image' | 'video' } | undefined> => {
        if (!id) return undefined
        const path = join(this.viewOnceDir, `${id}.bin`)
        const metaPath = join(this.viewOnceDir, `${id}.json`)
        try {
            const [buffer, metaRaw] = await Promise.all([
                fsPromises.readFile(path),
                fsPromises.readFile(metaPath, 'utf8')
            ])
            const meta = JSON.parse(metaRaw) as { type: 'image' | 'video' }
            return { buffer, type: meta.type }
        } catch {
            return undefined
        }
    }
}
