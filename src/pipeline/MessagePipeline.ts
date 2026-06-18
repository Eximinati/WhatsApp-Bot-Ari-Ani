import { dirname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import CommandModule from '../core/CommandModule.js'
import RuntimeClient from '../core/RuntimeClient.js'
import { ICommand, IParsedArgs, ISimplifiedMessage } from '../typings/index.js'
import { MessageType, Mimetype } from '../core/types.js'
import YT from '../core/YT.js'
import yts from 'yt-search'
import archiver from 'archiver'
import { createWriteStream, promises as fsPromises, unlink } from 'fs'
import { tmpdir } from 'os'
import { buildTrackListText } from '../utils/playlist.js'
import { fireAndForget } from '../utils/async.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mongoQueryCount = 0
let messageProcessDuration = 0
let messagesProcessed = 0

export function getPipelineMetrics() {
    return { mongoQueries: mongoQueryCount, avgDuration: messagesProcessed > 0 ? Math.round(messageProcessDuration / messagesProcessed) : 0, messagesProcessed }
}

export default class MessagePipeline {
    commands = new Map<string, ICommand>()
    aliases = new Map<string, ICommand>()
    private disabledCommandsCache = new Map<string, { disabled: boolean; reason?: string }>()

    /** Commands exceeding this wall-clock duration are timed out so the
     *  pipeline doesn't hang forever. The underlying promise is NOT aborted
     *  (JS can't cancel promises) — this only prevents the pipeline from
     *  waiting. */
    private static readonly COMMAND_TIMEOUT_MS = 120_000

    /** Wrap a promise to reject if it doesn't settle within `ms`.
     *  Timer cleaned up when either side settles first. */
    private static withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
        let timer: ReturnType<typeof setTimeout> | undefined
        const timeout = new Promise<T>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Command "${label}" timed out after ${ms}ms`)), ms)
        })
        return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
    }

    constructor(public client: RuntimeClient) {}

    handleMessage = async (M: ISimplifiedMessage): Promise<void> => {
        const pipelineStart = performance.now()
        let timing: Record<string, number> = {}
        try {
            if (M._pipelineProcessed) return
            M._pipelineProcessed = true

            const t0 = performance.now()
            // For messages sent from the bot's own phone, override the displayed
            // username so logs make sense. We DO want to process these — they let
            // the operator drive the bot from their own WhatsApp client. The
            // infinite-loop protection is in WAClient.sentByBot, which strips the
            // bot's own outbound message echoes before they reach this handler.
            if (M.WAMessage.key?.fromMe) {
                M.sender.jid = this.client.user.jid
                M.sender.username =
                    this.client.user.name || this.client.user.vname || this.client.user.short || 'Ari-Ani Bot'
            }
            timing.fromMeCheck = performance.now() - t0

            if (M.from.includes('status')) return void null
            const { args, groupMetadata, sender } = M
            if (M.chat === 'dm' && !M.groupMetadata) return void null

            const t1 = performance.now()
            // Deduplicate getUser() - resolve once per message
            let cachedUser: Awaited<ReturnType<RuntimeClient['getUser']>> | null = null
            const getUserOnce = async () => {
                if (!cachedUser) {
                    const uStart = performance.now()
                    cachedUser = await this.client.getUser(M.sender.jid)
                    timing.getUser = (timing.getUser || 0) + (performance.now() - uStart)
                    mongoQueryCount++
                }
                return cachedUser
            }

            // Fetch group data only when we actually need it (moderation / command gating).
            // Deduplicate groupAuth() - resolve once per message
            let cachedGroupAuth: { mod: boolean; cmd: boolean } | null = null
            const groupAuth = async (): Promise<{ mod: boolean; cmd: boolean }> => {
                if (cachedGroupAuth) return cachedGroupAuth
                if (!M.groupMetadata) {
                    cachedGroupAuth = { mod: false, cmd: true }
                    return cachedGroupAuth
                }
                const gStart = performance.now()
                const gd = await this.client.getGroupData(M.from)
                timing.getGroupData = (timing.getGroupData || 0) + (performance.now() - gStart)
                mongoQueryCount++
                cachedGroupAuth = { mod: !!gd.mod, cmd: !!gd.cmd }
                return cachedGroupAuth
            }
            timing.initDedupe = performance.now() - t1

            // Moderation: only for group messages + bot is admin.
            const modStart = performance.now()
            if (M.groupMetadata && this.client.isBotAdmin(M.groupMetadata)) {
                const { mod } = await groupAuth()
                if (mod) this.moderate(M)
            }
            timing.moderation = performance.now() - modStart

            if (!args[0] || !args[0].startsWith(this.client.config.prefix)) {
                // New unified menu handler
                const menuStart = performance.now()
                const menuHandled = await this.client.menus.handleReply(M)
                timing.menuCheck = performance.now() - menuStart
                if (menuHandled) return

                // Non-command message. In DMs where a mod has enabled chat for this
                // user, route into the LLM. Group messages without a prefix are never
                // auto-answered (would spam unrelated chatter).
                if (
                    M.chat === 'dm' &&
                    !M.WAMessage.key?.fromMe &&
                    this.client.isFeature('chatbot')
                ) {
                    const chatStart = performance.now()
                    await this.handleAutoChat(M, getUserOnce)
                    timing.autoChat = performance.now() - chatStart
                }
                return void this.client.log(
                    `MSG from ${sender.username} in ${groupMetadata?.subject || 'DM'}`
                )
            }
            const cmd = args[0].slice(this.client.config.prefix.length).toLowerCase()
            const allowedCommands = ['activate', 'deactivate', 'act', 'deact']
            const cmdCheckStart = performance.now()
            if (!(allowedCommands.includes(cmd) || (await groupAuth()).cmd))
                return void this.client.log(
                    `CMD ${args[0]}[${args.length - 1}] from ${sender.username} in ${groupMetadata?.subject || 'DM'}`
                )
            timing.cmdCheck = performance.now() - cmdCheckStart

            const command = this.commands.get(cmd) || this.aliases.get(cmd)
            this.client.log(
                `CMD ${args[0]}[${args.length - 1}] from ${sender.username} in ${groupMetadata?.subject || 'DM'}`
            )
            if (!command) return void M.reply('No Command Found! Try using one from the help list.')

            // Use cached user
            const userStart = performance.now()
            const user = await getUserOnce()
            timing.userFetch = performance.now() - userStart
            if (user.ban) return void M.reply("You're Banned from using commands.")

            // Use cached disabled commands check
            const cmdName = command.config.command
            const disabledStart = performance.now()
            let disabledState = this.disabledCommandsCache.get(cmdName)
            if (disabledState === undefined) {
                const result = await this.client.getDisabledCommandInfo(cmdName)
                mongoQueryCount++
                disabledState = result ? { disabled: true, reason: result.reason } : { disabled: false }
                this.disabledCommandsCache.set(cmdName, disabledState)
            }
            timing.disabledCheck = performance.now() - disabledStart
            if (disabledState.disabled) return void M.reply(`❌ This command is disabled${disabledState.reason ? ` for ${disabledState.reason}` : ''}`)

            // DM is allowed for every command. Commands that need group context
            // (admin checks, group metadata) fail gracefully on their own — see
            // adminOnly below and individual command guards for !M.groupMetadata.
            if (command.config?.modsOnly && !this.client.isMod(M.sender.jid)) {
                return void M.reply(`Only MODS are allowed to use this command`)
            }
            if (command.config?.adminOnly && !M.sender.isAdmin)
                return void M.reply(`Only admins are allowed to use this command`)
            const cmdRunStart = performance.now()
            try {
                await MessagePipeline.withTimeout(
                    Promise.resolve(command.run(M, this.parseArgs(args))),
                    MessagePipeline.COMMAND_TIMEOUT_MS,
                    command.config.command
                )
                timing.commandRun = performance.now() - cmdRunStart
                if (command.config.baseXp) {
                    const xpStart = performance.now()
                    await this.client.setXp(M.sender.jid, command.config.baseXp || 10, 50)
                    timing.xpSet = performance.now() - xpStart
                }
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err)
                return void this.client.log(message, true)
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            this.client.log(`[PIPELINE_ERROR] ${message}`, true)
        } finally {
            const totalDuration = performance.now() - pipelineStart
            messageProcessDuration += totalDuration
            messagesProcessed++
            
            // Build detailed timing string
            const timingParts = Object.entries(timing).map(([k, v]) => `${k}:${Math.round(v)}ms`).join(', ')
            this.client.log(`[PIPELINE_TIMING] total=${Math.round(totalDuration)}ms ${timingParts}`)
            
            if (totalDuration > 1000) {
                this.client.log(`Slow message pipeline: ${Math.round(totalDuration)}ms`, true)
            }
        }
    }

    /** DM auto-reply path: routes the user's message (text or voice note) into
     * the LLM provider chain. Quota-gated; opt-in per user via `!chat start`. */
    handleAutoChat = async (M: ISimplifiedMessage, getUserOnce: () => Promise<any>): Promise<void> => {
        const user = await getUserOnce()
        if (!user || user.ban) return
        if (!user.chatEnabled) return

        // Audio voice notes go to a multimodal provider with the raw buffer; text
        // messages go through the regular text chain.
        const isAudio = M.type === 'audioMessage'
        const text = (M.content || '').trim()
        if (!isAudio && !text) return

        let audio: { buffer: Buffer; mime: string } | undefined
        if (isAudio) {
            try {
                const buffer = await this.client.downloadMediaMessage(M.WAMessage)
                const audioMsg = (M.WAMessage.message as { audioMessage?: { mimetype?: string } } | null)
                    ?.audioMessage
                const mime = (audioMsg?.mimetype || 'audio/ogg').split(';')[0].trim()
                audio = { buffer, mime }
            } catch (err) {
                this.client.log(
                    `Failed to download voice note: ${err instanceof Error ? err.message : String(err)}`,
                    true
                )
                return void M.reply(`Couldn't read your voice note, sorry.`)
            }
        }

        const quota = await this.client.consumeChatQuota(M.sender.jid)
        if (!quota.allowed)
            return void M.reply(
                `You've used your ${quota.limit} chat messages for today. A mod can extend with ${this.client.config.prefix}quota extend.`
            )

        const result = await this.client.chatAI.chat({
            jid: M.from,
            kind: 'user',
            senderName: M.sender.username,
            text,
            audio
        })
        if (!result.ok) {
            this.client.log(`ChatAI error in DM ${M.from}: ${result.error}`, true)
            return void M.reply(`Hmm, my brain glitched. Try again in a sec.`)
        }
        return void M.reply(result.reply)
    }

    sendMediaFromReply = async (M: ISimplifiedMessage, mode: string, mediaInfo: any): Promise<void> => {
        if (!mediaInfo?.url) {
            await M.reply('❌ No media info found. Please run the command again.')
            return
        }

        const command = M._session?.commandName || 'media'

        try {
            this.client.log(`[Media] Selection: ${mode} for ${mediaInfo.title} (URL: ${mediaInfo.url})`)
            
            if (mediaInfo.type === 'audio' && (mode === 'audio' || mode === 'document')) {
                const yt = new YT(mediaInfo.url, 'audio')
                
                
                const buffer = await yt.getBuffer()
                this.client.log(`[Media] Download complete: ${mediaInfo.title} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`)
                
                
                if (mode === 'document') {
                    await this.client.sendMessage(M.from, buffer, MessageType.document, {
                        mimetype: 'audio/mpeg',
                        quoted: M.WAMessage,
                        caption: mediaInfo.title || 'audio'
                    })
                } else {
                    await this.client.sendMessage(M.from, buffer, MessageType.audio, {
                        mimetype: Mimetype.m4a,
                        quoted: M.WAMessage
                    })
                }
                this.client.log(`[Media] Sent successfully: ${mediaInfo.title}`)
                return
            }
            
            if (mediaInfo.type === 'video' && (mode === 'video' || mode === 'document')) {
                const yt = new YT(mediaInfo.url, 'video')
                
                await M.reply(`📥 Downloading video: *${mediaInfo.title}*...`)
                const buffer = await yt.getBuffer()
                this.client.log(`[Media] Download complete: ${mediaInfo.title} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`)
                
                await M.reply(`📤 Sending video as ${mode.toUpperCase()}...`)
                if (mode === 'document') {
                    const safeTitle = (mediaInfo.title || 'video').replace(/[<>:"/\\|?*]/g, '_')
                    await this.client.sendMessage(M.from, buffer, MessageType.document, {
                        mimetype: Mimetype.mp4,
                        quoted: M.WAMessage,
                        caption: `${safeTitle}.mp4`
                    })
                } else {
                    // Don't force mimetype — let Baileys sniff the buffer so it
                    // handles MP4, WebM, and whatever the download API returns.
                    await this.client.sendMessage(M.from, buffer, MessageType.video, {
                        quoted: M.WAMessage,
                        caption: mediaInfo.title || 'video'
                    })
                }
                this.client.log(`[Media] Sent successfully: ${mediaInfo.title}`)
                return
            }
            
            await M.reply('❌ Cannot send media in this format.')
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err)
            this.client.log(`[Media] ERROR processing ${mediaInfo.title}: ${errorMsg}`, true)
            await M.reply(`❌ Failed to send media: ${errorMsg}`)
        }
    }

    private static readonly MAX_PLAYLIST_TRACKS = 30

    sendPlaylistFromReply = async (M: ISimplifiedMessage, selection: string, data: any): Promise<void> => {
        const { tracks, name } = data
        if (!tracks || !tracks.length) {
            console.error('[Spotify] ERROR: No tracks found in playlist data')
            return void M.reply('❌ No tracks found in playlist.')
        }

        let total = tracks.length
        const capped = total > MessagePipeline.MAX_PLAYLIST_TRACKS
        if (capped) {
            total = MessagePipeline.MAX_PLAYLIST_TRACKS
            this.client.log(
                `[Spotify] Playlist capped from ${tracks.length} to ${MessagePipeline.MAX_PLAYLIST_TRACKS} tracks to prevent OOM`,
                true
            )
        }

        const capNote = capped ? `\n⚠️ Capped to ${total} tracks to prevent OOM` : ''

        if (selection === '1') {
            console.log(`[Spotify] START Stream - Playlist: "${name}" (${total} tracks) - User: ${M.sender.jid}`)
            
            await M.reply(buildTrackListText(tracks, total,
                `📥 *Stream Mode* - Playlist: *${name}*\n📋 *${total}* tracks to download:${capNote}`,
                `⬇️ Starting downloads...`))

            for (let i = 0; i < total; i++) {
                const track = tracks[i]
                const trackNum = i + 1
                const query = `${track.artists[0]} - ${track.name}`

                try {
                    console.log(`[Spotify Stream] [${trackNum}/${total}] Searching: "${track.name}"`)
                    const { videos } = await yts(query)
                    if (!videos || !videos.length) {
                        console.warn(`[Spotify Stream] WARN: Not found on YouTube: "${track.name}"`)
                        this.client.log(`[Spotify Stream] ❌ [${trackNum}/${total}] Not found: ${track.name}`)
                        continue
                    }

                    const url = videos[0].url
                    const yt = new YT(url, 'audio')

                    console.log(`[Spotify Stream] [${trackNum}/${total}] Downloading: "${track.name}" from ${url}`)
                    const buffer = await yt.getBuffer()

                    console.log(`[Spotify Stream] SUCCESS [${trackNum}/${total}]: "${track.name}" (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`)
                    this.client.log(`[Spotify Stream] 📤 [${trackNum}/${total}] Sending: ${track.name}`)
                    await this.client.sendMessage(M.from, buffer, MessageType.audio, {
                        mimetype: Mimetype.m4a,
                        quoted: M.WAMessage
                    })
                } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : String(err)
                    console.error(`[Spotify Stream] ERROR [${trackNum}/${total}]: "${track.name}" - ${errorMsg}`)
                    this.client.log(`[Spotify Stream] ⚠️ [${trackNum}/${total}] Failed: ${track.name}`, true)
                }
            }
            console.log(`[Spotify] END Stream - Playlist: "${name}" completed`)
            this.client.log(`[Spotify Stream] ✅ Playlist "${name}" streaming complete!`)
        } else if (selection === '2') {
            console.log(`[Spotify ZIP] START - Playlist: "${name}" (${total} tracks) - User: ${M.sender.jid}`)
            
            await M.reply(buildTrackListText(tracks, total,
                `📦 *ZIP Mode* - Playlist: *${name}*\n📋 *${total}* tracks to download:${capNote}`,
                `⬇️ Downloading all tracks... (progress in logs only)`))
            
            const archive = archiver('zip', { zlib: { level: 9 } })
            const tmpPath = join(tmpdir(), `spotify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.zip`)
            const ws = createWriteStream(tmpPath)

            try {
                archive.pipe(ws)

                for (let i = 0; i < total; i++) {
                    const track = tracks[i]
                    const trackNum = i + 1
                    const query = `${track.artists[0]} - ${track.name}`

                    try {
                        console.log(`[Spotify ZIP] [${trackNum}/${total}] Downloading: "${track.name}"`)
                        const { videos } = await yts(query)
                        if (!videos || !videos.length) {
                            console.warn(`[Spotify ZIP] WARN: Not found on YouTube: "${track.name}"`)
                            this.client.log(`[Spotify ZIP] ❌ [${trackNum}/${total}] Not found: ${track.name}`, true)
                            continue
                        }

                        const yt = new YT(videos[0].url, 'audio')
                        const buffer = await yt.getBuffer()

                        console.log(`[Spotify ZIP] SUCCESS [${trackNum}/${total}]: "${track.name}" (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`)
                        this.client.log(`[Spotify ZIP] ✅ [${trackNum}/${total}] Added to archive: ${track.name}`)
                        archive.append(buffer, { name: `${track.artists[0]} - ${track.name}.mp3` })
                    } catch (err) {
                        const errorMsg = err instanceof Error ? err.message : String(err)
                        console.error(`[Spotify ZIP] ERROR [${trackNum}/${total}]: "${track.name}" - ${errorMsg}`)
                        this.client.log(`[Spotify ZIP] ⚠️ [${trackNum}/${total}] Failed: ${track.name}`, true)
                    }
                }

                console.log(`[Spotify ZIP] Finalizing ZIP: "${name}.zip"`)
                this.client.log(`[Spotify ZIP] 🗜️ Finalizing ZIP archive...`)

                await new Promise<void>((resolve, reject) => {
                    ws.on('finish', () => resolve())
                    ws.on('error', (err: Error) => {
                        console.error(`[Spotify ZIP] STREAM ERROR: ${err.message}`)
                        reject(err)
                    })
                    archive.on('error', (err: Error) => {
                        console.error(`[Spotify ZIP] ARCHIVE ERROR: ${err.message}`)
                        reject(err)
                    })
                    archive.finalize()
                })

                const zipBuffer = await fsPromises.readFile(tmpPath)

                console.log(`[Spotify ZIP] SUCCESS: ZIP finalized - ${name}.zip (${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB)`)
                this.client.log(`[Spotify ZIP] 📤 Ready to send: ${name}.zip (${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB)`)

                await M.reply(`✅ ZIP ready! Sending *${name}.zip* (${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB)...`)
                try {
                    await this.client.sendMessage(M.from, zipBuffer, MessageType.document, {
                        mimetype: 'application/zip',
                        quoted: M.WAMessage,
                        caption: `${name}.zip`
                    })
                    console.log(`[Spotify ZIP] COMPLETE: Sent ${name}.zip to ${M.from}`)
                    this.client.log(`[Spotify ZIP] ✅ ZIP sent successfully: ${name}.zip`)
                } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : String(err)
                    console.error(`[Spotify ZIP] SEND ERROR: ${errorMsg}`)
                    await M.reply(`❌ Failed to send ZIP: ${errorMsg}`)
                }
            } finally {
                ws.close()
                unlink(tmpPath, () => {})
            }
        }
    }

    moderate = async (M: ISimplifiedMessage): Promise<void> => {
        if (M.sender.isAdmin) return void null
        if (!M.urls.length) return

        const senderName = M.sender.username
        const groupName = M.groupMetadata?.subject || 'Group'
        const groupJid = M.from

        this.client.log(`ANTILINK: ${senderName} sent link(s) in ${groupName}`)

        // Delete the message containing the link
        try {
            await this.client.deleteMessage(groupJid, M.WAMessage.key)
            this.client.log(`ANTILINK: Deleted message from ${senderName} in ${groupName}`)
        } catch (err) {
            this.client.log(
                `ANTILINK: Failed to delete message: ${err instanceof Error ? err.message : String(err)}`,
                true
            )
        }

        // Remove the sender
        fireAndForget(this.client.groupRemove(groupJid, [M.sender.jid]))
        this.client.log(`ANTILINK: Removed ${senderName} from ${groupName}`)
    }

    loadCommands = async (): Promise<void> => {
        this.client.log('Loading commands...')
        const path = join(__dirname, '..', 'commands')
        const files = this.client.util.readdirRecursive(path)
        for (const file of files) {
            const filename = file.split(/[\\/]/)
            if (filename[filename.length - 1].startsWith('_')) continue
            if (!file.endsWith('.js') && !file.endsWith('.ts')) continue
            const mod = await import(pathToFileURL(file).href)
            const Cmd = mod.default
            const command: CommandModule = new Cmd(this.client, this)
            const cmdName = command.config.command
            if (this.commands.has(cmdName)) {
                this.client.log(
                    `Skipping duplicate command "${cmdName}" from ${file} — already registered`,
                    true
                )
                continue
            }
            this.commands.set(cmdName, command)
            if (command.config.aliases) {
                for (const alias of command.config.aliases) {
                    // A command listing its own name as an alias is a no-op,
                    // not a collision. Skip silently.
                    if (alias === cmdName) continue
                    if (this.commands.has(alias) || this.aliases.has(alias)) {
                        this.client.log(
                            `Alias collision: "${alias}" (from ${cmdName}) already maps to another command — skipping`,
                            true
                        )
                        continue
                    }
                    this.aliases.set(alias, command)
                }
            }
            this.client.log(`Loaded: ${cmdName} from ${file}`)
        }
        this.client.log(`Successfully loaded ${this.commands.size} commands`)
    }

    loadFeatures = async (): Promise<void> => {
        this.client.log('Loading features...')
        await this.client.setFeatures()
        this.client.log(`Loaded ${this.client.getFeatureCount()} features`)
    }

    loadDisabledCommandsCache = async (): Promise<void> => {
        this.client.log('Loading disabled commands cache...')
        const docs = await this.client.getAllDisabledCommands()
        for (const doc of docs) {
            this.disabledCommandsCache.set(doc.command, { disabled: true, reason: doc.reason })
        }
        this.client.log(`Cached ${this.disabledCommandsCache.size} disabled commands`)
    }

    invalidateDisabledCommandCache = (command?: string): void => {
        if (command) {
            this.disabledCommandsCache.delete(command)
        } else {
            this.disabledCommandsCache.clear()
        }
    }

    parseArgs = (args: string[]): IParsedArgs => {
        const slicedArgs = args.slice(1)
        return {
            args: slicedArgs,
            flags: slicedArgs.filter((arg) => arg.startsWith('--')),
            joined: slicedArgs.join(' ').trim()
        }
    }
}
