import { MessageType } from '../../core/types.js'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import request from '../../core/request.js'
import Spotify, { SpotifyPlaylist, SpotifyTrack } from '../../core/Spotify.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

const PLAYLIST_LIMIT = 10

interface PlaylistState {
    name: string
    total: number
    tracks: SpotifyTrack[]
    ytResults: { url: string; title: string; artist: string; trackName: string }[]
    trackRange?: { start: number; end: number }
}

function parseTrackRange(args: string[]): { start: number; end: number } | null {
    const arg = args.join(' ')
    const match = arg.match(/--(\d+)-(\d+)/)
    if (match) {
        const start = parseInt(match[1], 10)
        const end = parseInt(match[2], 10)
        if (start > 0 && end >= start) {
            return { start, end }
        }
    }
    return null
}

function splitBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize))
    }
    return batches
}

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'spotify',
            description: 'Downloads given spotify track/playlist and sends it as Audio',
            category: 'media',
            usage: `${client.config.prefix}spotify [URL] [--1-100]`,
            baseXp: 20,
            aliases: ['sp'],
            since: '2026-05-17'
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!M.urls.length) return void M.reply(`🔎 Provide the Spotify Track/Playlist URL that you want to download`)
        
        const url = M.urls[0]
        const range = parseTrackRange(M.args)
        
        const spotify = new Spotify(url)
        const parsed = spotify.parseSpotifyUrl()
        if (!parsed) return void M.reply('⚓ Invalid Spotify URL')

        const jid = M.sender.jid
        if (await this.client.mediaMenu.hasPending(jid)) {
            return void M.reply('❌ You have a pending request. Reply with a number or wait.')
        }

        if (parsed.type === 'playlist' || parsed.type === 'album') {
            await this.handlePlaylist(M, spotify, jid, range)
            return
        }

        await this.handleTrack(M, spotify, jid)
    }

    private handleTrack = async (M: ISimplifiedMessage, spotify: Spotify, jid: string): Promise<void> => {
        const url = M.urls[0]
        let info: Awaited<ReturnType<Spotify['getInfo']>>
        try {
            info = await spotify.getInfo()
        } catch {
            return void M.reply(`⚓ Error fetching: ${url}. Check if the URL is valid.`)
        }
        if (info.error) return void M.reply(`⚓ Error Fetching: ${url}. Check if the url is valid and try again`)

        const caption = `📀 *Title:* ${info.name || ''}\n\n👤 *Artists:* ${(info.artists || []).join(', ')}\n\n💽 *Album:* ${info.album_name || ''}`

        if (info.cover_url) {
            try {
                const coverBuffer = await request.buffer(info.cover_url)
                await M.reply(coverBuffer, MessageType.image, undefined, undefined, caption)
            } catch {
                await M.reply(caption)
            }
        } else {
            await M.reply(caption)
        }

        const ytResult = await spotify.searchYouTube()
        if (!ytResult) {
            return void M.reply('⚓ Could not find the song on YouTube.')
        }

        try {
            await this.client.mediaMenu.saveMenuState(jid, {
                step: 'format',
                commandName: 'spotify',
                chatJid: M.from,
                mediaInfo: {
                    url: ytResult.url,
                    title: ytResult.title,
                    type: 'audio'
                },
                expiresAt: Date.now() + 600000
            })

            const menuText = this.client.mediaMenu.getMenuText('spotify', ytResult.title)
            return void M.reply(menuText)
        } catch (err) {
            await M.reply(`❌ Error: ${(err as Error).message}`)
        }
    }

    private handlePlaylist = async (M: ISimplifiedMessage, spotify: Spotify, jid: string, range: { start: number; end: number } | null): Promise<void> => {
        await M.reply('📂 Fetching playlist...')

        const playlist = await spotify.getPlaylist(100)
        if (!playlist) {
            return void M.reply('⚓ Failed to fetch playlist.')
        }

        const { name, total, tracks } = playlist

        // Apply range if specified
        let selectedTracks = tracks
        let displayTotal = total
        let rangeLabel = ''

        if (range) {
            const startIndex = Math.max(0, range.start - 1)
            const endIndex = Math.min(range.end, tracks.length)
            selectedTracks = tracks.slice(startIndex, endIndex)
            displayTotal = selectedTracks.length
            rangeLabel = ` (tracks ${range.start}-${range.end})`
        }

        const label = rangeLabel || (total <= 100 ? ' (full)' : '')

        // Save state for menu selection - we DON'T search YouTube here to keep it fast
        await this.client.mediaMenu.saveMenuState(jid, {
            step: 'playlistDelivery',
            commandName: 'spotify',
            chatJid: M.from,
            playlistData: {
                name,
                total: displayTotal,
                tracks: selectedTracks,
                trackRange: range || undefined
            },
            expiresAt: Date.now() + 600000
        })

        const menuText = `📦 Playlist detected: *${name}* (${displayTotal} tracks)${label}

Choose how you want it:

1 - Stream one by one (audio)
2 - Download as ZIP file
0 - Cancel`

        return void M.reply(menuText)
    }
}