import { dirname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import CommandModule from '../core/CommandModule.js'
import RuntimeClient from '../core/RuntimeClient.js'
import { ICommand, IParsedArgs, ISimplifiedMessage } from '../typings/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default class MessagePipeline {
    commands = new Map<string, ICommand>()
    aliases = new Map<string, ICommand>()
    constructor(public client: RuntimeClient) {}

    handleMessage = async (M: ISimplifiedMessage): Promise<void> => {
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

        if (M.from.includes('status')) return void null
        const { args, groupMetadata, sender } = M
        if (!M.groupMetadata && !(M.chat === 'dm')) return void null

        if ((await this.client.getGroupData(M.from)).mod && this.client.isBotAdmin(M.groupMetadata))
            this.moderate(M)
        if (!args[0] || !args[0].startsWith(this.client.config.prefix)) {
            // New unified menu handler
            const menuHandled = await this.client.menus.handleReply(M)
            if (menuHandled) return

            // Non-command message. In DMs where a mod has enabled chat for this
            // user, route into the LLM. Group messages without a prefix are never
            // auto-answered (would spam unrelated chatter).
            if (
                M.chat === 'dm' &&
                !M.WAMessage.key?.fromMe &&
                this.client.isFeature('chatbot')
            ) {
                await this.handleAutoChat(M)
            }
            return void this.client.log(
                `MSG from ${sender.username} in ${groupMetadata?.subject || 'DM'}`
            )
        }
        const cmd = args[0].slice(this.client.config.prefix.length).toLowerCase()
        const allowedCommands = ['activate', 'deactivate', 'act', 'deact']
        if (!(allowedCommands.includes(cmd) || (await this.client.getGroupData(M.from)).cmd))
            return void this.client.log(
                `CMD ${args[0]}[${args.length - 1}] from ${sender.username} in ${groupMetadata?.subject || 'DM'}`
            )
        const command = this.commands.get(cmd) || this.aliases.get(cmd)
        this.client.log(
            `CMD ${args[0]}[${args.length - 1}] from ${sender.username} in ${groupMetadata?.subject || 'DM'}`
        )
        if (!command) return void M.reply('No Command Found! Try using one from the help list.')
        const user = await this.client.getUser(M.sender.jid)
        if (user.ban) return void M.reply("You're Banned from using commands.")
        const state = await this.client.DB.disabledcommands.findOne({ command: command.config.command })
        if (state) return void M.reply(`❌ This command is disabled${state.reason ? ` for ${state.reason}` : ''}`)
        // DM is allowed for every command. Commands that need group context
        // (admin checks, group metadata) fail gracefully on their own — see
        // adminOnly below and individual command guards for !M.groupMetadata.
        if (command.config?.modsOnly && !this.client.isMod(M.sender.jid)) {
            return void M.reply(`Only MODS are allowed to use this command`)
        }
        if (command.config?.adminOnly && !M.sender.isAdmin)
            return void M.reply(`Only admins are allowed to use this command`)
        try {
            await command.run(M, this.parseArgs(args))
            if (command.config.baseXp) {
                await this.client.setXp(M.sender.jid, command.config.baseXp || 10, 50)
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            return void this.client.log(message, true)
        }
    }

    /** DM auto-reply path: routes the user's message (text or voice note) into
     * the LLM provider chain. Quota-gated; opt-in per user via `!chat start`. */
    handleAutoChat = async (M: ISimplifiedMessage): Promise<void> => {
        const user = await this.client.getUser(M.sender.jid)
        if (user.ban) return
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

        const { MessageType, Mimetype } = await import('../core/types.js')
        const command = (M as any)._session?.commandName || 'media'

        try {
            this.client.log(`[Media] Selection: ${mode} for ${mediaInfo.title} (URL: ${mediaInfo.url})`)
            
            if (mediaInfo.type === 'audio' && (mode === 'audio' || mode === 'document')) {
                const YT = (await import('../core/YT.js')).default
                const yt = new YT(mediaInfo.url, 'audio')
                
                await M.reply(`📥 Downloading audio: *${mediaInfo.title}*...`)
                const buffer = await yt.getBuffer()
                this.client.log(`[Media] Download complete: ${mediaInfo.title} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`)
                
                await M.reply(`📤 Sending audio as ${mode.toUpperCase()}...`)
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
                const YT = (await import('../core/YT.js')).default
                const yt = new YT(mediaInfo.url, 'video')
                
                await M.reply(`📥 Downloading video: *${mediaInfo.title}*...`)
                const buffer = await yt.getBuffer()
                this.client.log(`[Media] Download complete: ${mediaInfo.title} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`)
                
                await M.reply(`📤 Sending video as ${mode.toUpperCase()}...`)
                if (mode === 'document') {
                    await this.client.sendMessage(M.from, buffer, MessageType.document, {
                        mimetype: Mimetype.mp4,
                        quoted: M.WAMessage,
                        caption: mediaInfo.title || 'video'
                    })
                } else {
                    await this.client.sendMessage(M.from, buffer, MessageType.video, {
                        quoted: M.WAMessage
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

    sendPlaylistFromReply = async (M: ISimplifiedMessage, selection: string, data: any): Promise<void> => {
        const { tracks, name } = data
        if (!tracks || !tracks.length) {
            console.error('[Spotify] ERROR: No tracks found in playlist data')
            return void M.reply('❌ No tracks found in playlist.')
        }

        const { MessageType, Mimetype } = await import('../core/types.js')
        const YT = (await import('../core/YT.js')).default
        const archiver = (await import('archiver')).default
        const yts = (await import('yt-search')).default

        const total = tracks.length

        if (selection === '1') {
            console.log(`[Spotify] START Stream - Playlist: "${name}" (${total} tracks) - User: ${M.sender.jid}`)
            await M.reply(`📥 You selected option *1* (Stream). Now downloading *${total}* tracks one by one...`)

            for (let i = 0; i < total; i++) {
                const track = tracks[i]
                const trackNum = i + 1
                const query = `${track.artists[0]} - ${track.name}`

                if (i === 0) {
                    await M.reply(`🎵 Downloading first track: *${track.name}*...`)
                }

                try {
                    await M.reply(`🔍 [${trackNum}/${total}] Searching: *${track.name}*...`)
                    console.log(`[Spotify Stream] Searching track ${trackNum}/${total}: "${track.name}"`)
                    const { videos } = await yts(query)
                    if (!videos || !videos.length) {
                        console.warn(`[Spotify Stream] WARN: Not found on YouTube: "${track.name}"`)
                        await M.reply(`❌ [${trackNum}/${total}] Not found: ${track.name}`)
                        continue
                    }

                    const url = videos[0].url
                    const yt = new YT(url, 'audio')

                    await M.reply(`⬇️ [${trackNum}/${total}] Downloading: *${track.name}*...`)
                    console.log(`[Spotify Stream] Downloading track ${trackNum}/${total}: "${track.name}" from ${url}`)
                    const buffer = await yt.getBuffer()

                    console.log(`[Spotify Stream] SUCCESS track ${trackNum}/${total}: "${track.name}" (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`)
                    await M.reply(`📤 [${trackNum}/${total}] Sending: *${track.name}*...`)
                    await this.client.sendMessage(M.from, buffer, MessageType.audio, {
                        mimetype: Mimetype.m4a,
                        quoted: M.WAMessage
                    })
                } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : String(err)
                    console.error(`[Spotify Stream] ERROR track ${trackNum}/${total}: "${track.name}" - ${errorMsg}`)
                    await M.reply(`⚠️ [${trackNum}/${total}] Failed: ${track.name}`)
                }
            }
            console.log(`[Spotify] END Stream - Playlist: "${name}" completed`)
            await M.reply(`✅ Playlist *${name}* streaming complete!`)
        } else if (selection === '2') {
            console.log(`[Spotify ZIP] START - Playlist: "${name}" (${total} tracks) - User: ${M.sender.jid}`)
            await M.reply(`📦 You selected option *2* (ZIP). Now downloading *${total}* tracks and packaging them...`)
            await M.reply(`🎵 Downloading first track: *${tracks[0].name}*...`)
            
            const archive = archiver('zip', { zlib: { level: 9 } })
            const chunks: Buffer[] = []
            
            archive.on('data', (chunk: Buffer) => chunks.push(chunk))

            for (let i = 0; i < total; i++) {
                const track = tracks[i]
                const trackNum = i + 1
                const query = `${track.artists[0]} - ${track.name}`

                if (i === 0) {
                    await M.reply(`⬇️ [1/${total}] Downloading first track: *${track.name}*...`)
                }

                try {
                    await M.reply(`⬇️ [${trackNum}/${total}] Downloading: *${track.name}*...`)
                    console.log(`[Spotify ZIP] Downloading track ${trackNum}/${total}: "${track.name}"`)
                    const { videos } = await yts(query)
                    if (!videos || !videos.length) {
                        console.warn(`[Spotify ZIP] WARN: Not found on YouTube: "${track.name}"`)
                        continue
                    }

                    const yt = new YT(videos[0].url, 'audio')
                    const buffer = await yt.getBuffer()

                    console.log(`[Spotify ZIP] SUCCESS added ${trackNum}/${total}: "${track.name}" (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`)
                    archive.append(buffer, { name: `${track.artists[0]} - ${track.name}.mp3` })

                    await M.reply(`✅ [${trackNum}/${total}] Ready: *${track.name}*`)
                } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : String(err)
                    console.error(`[Spotify ZIP] ERROR track ${trackNum}/${total}: "${track.name}" - ${errorMsg}`)
                    await M.reply(`⚠️ [${trackNum}/${total}] Failed: ${track.name}`)
                }
            }

            await M.reply(`🗜️ Finalizing ZIP file...`)
            console.log(`[Spotify ZIP] Finalizing ZIP: "${name}.zip"`)
            
            const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
                archive.on('end', () => resolve(Buffer.concat(chunks)))
                archive.on('error', (err: Error) => {
                    console.error(`[Spotify ZIP] ARCHIVE ERROR: ${err.message}`)
                    reject(err)
                })
                archive.finalize()
            })

            console.log(`[Spotify ZIP] SUCCESS: ZIP finalized - ${name}.zip (${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB)`)
            await M.reply(`📤 Sending ZIP: *${name}.zip* (${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB)`)
            try {
                await this.client.sendMessage(M.from, zipBuffer, MessageType.document, {
                    mimetype: 'application/zip',
                    quoted: M.WAMessage,
                    caption: `${name}.zip`
                })
                console.log(`[Spotify ZIP] COMPLETE: Sent ${name}.zip to ${M.from}`)
                await M.reply(`✅ Playlist *${name}* ZIP sent successfully!`)
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err)
                console.error(`[Spotify ZIP] SEND ERROR: ${errorMsg}`)
                await M.reply(`❌ Failed to send ZIP: ${errorMsg}`)
            }
        }
    }

    moderate = async (M: ISimplifiedMessage): Promise<void> => {
        if (M.sender.isAdmin) return void null
        if (!M.urls.length) return
        const groupinvites = M.urls.filter((url) => url.includes('chat.whatsapp.com'))
        if (!groupinvites.length) return
        // Fetch our own group's invite code once, not once per URL.
        const ourCode = await this.client.groupInviteCode(M.from).catch(() => undefined)
        for (const invite of groupinvites) {
            const splitInvite = invite.split('/')
            const code = splitInvite[splitInvite.length - 1]
            if (code === ourCode) continue
            this.client.log(
                `SEC Group Invite by ${M.sender.username} in ${M.groupMetadata?.subject || 'Group'}`
            )
            await this.client.groupRemove(M.from, [M.sender.jid]).catch(() => undefined)
            return
        }
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

    loadFeatures = (): void => {
        this.client.log('Loading features...')
        this.client.setFeatures().then(() => {
            this.client.log(`Loaded ${this.client.features.size} features`)
        })
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
