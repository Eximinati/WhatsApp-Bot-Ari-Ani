import axios from "axios"
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

interface Query {
    query: string
    title?: string
    artist?: string
}

interface Track {
    title: string
    artist: string
    thumbnail?: string
    score: number
}

interface LyricsResult {
    title: string
    artist: string
    lyrics: string
    thumbnail?: string | null
}

function normalizeKey(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
}

function normalizeLyrics(text: string): string {
    return text
        .replace(/\r/g, "")
        .replace(/\^/g, "\n")
        .replace(/\[[0-9]{1,2}:[0-9]{2}(?:\.[0-9]{1,3})?\]/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

function upgradeArtworkUrl(url?: string): string | undefined {
    if (!url) return undefined
    return url.replace(/\/\d+x\d+bb\.(jpg|jpeg|png)$/i, "/1200x1200bb.$1")
}

function parseQuery(input: string): Query {
    const clean = input.trim()

    if (clean.toLowerCase().includes(" by ")) {
        const [titlePart, artistPart] = clean.split(/\s+by\s+/i)
        return {
            query: clean,
            title: titlePart?.trim(),
            artist: artistPart?.trim()
        }
    }

    if (clean.includes(" - ")) {
        const [artistPart, titlePart] = clean.split(" - ")
        return {
            query: clean,
            artist: artistPart?.trim(),
            title: titlePart?.trim()
        }
    }

    return { query: clean }
}

function scoreTrackMatch(title: string, artist: string, parsed: Query): number {
    const normTitle = normalizeKey(title)
    const normArtist = normalizeKey(artist)
    const normQuery = normalizeKey(parsed.query)
    const normParsedTitle = normalizeKey(parsed.title || "")
    const normParsedArtist = normalizeKey(parsed.artist || "")

    let score = 0

    if (normParsedTitle && normTitle === normParsedTitle) score += 10
    if (normParsedArtist && normArtist.includes(normParsedArtist)) score += 8
    if (!normParsedTitle && normTitle === normQuery) score += 9
    if (!normParsedTitle && normQuery.includes(normTitle)) score += 5
    if (normParsedTitle && normTitle.includes(normParsedTitle)) score += 4
    if (normParsedArtist && normParsedArtist.includes(normArtist)) score += 2
    if (normQuery.includes(normArtist)) score += 1

    return score
}

async function searchTrack(query: Query): Promise<Track | null> {
    try {
        const { data } = await axios.get("https://itunes.apple.com/search", {
            params: { term: query.query, entity: "song", limit: 5 },
            timeout: 12000
        })

        const results = Array.isArray(data?.results) ? data.results : []
        if (!results.length) return null

        return results
            .map((item: any) => ({
                title: String(item.trackName || "").trim(),
                artist: String(item.artistName || "").trim(),
                thumbnail: upgradeArtworkUrl(item.artworkUrl100 || item.artworkUrl60),
                score: scoreTrackMatch(item.trackName, item.artistName, query)
            }))
            .sort((a: Track, b: Track) => b.score - a.score)[0] || null
    } catch {
        return null
    }
}

async function fetchLyrics(query: Query, track?: Track | null): Promise<LyricsResult | null> {
    try {
        const { data } = await axios.get("https://lrclib.net/api/search", {
            params: { q: query.query },
            timeout: 12000
        })

        const item = Array.isArray(data) ? data[0] : null
        if (!item) return null

        const lyrics = normalizeLyrics(item.plainLyrics || item.syncedLyrics || "")
        if (!lyrics) return null

        return {
            title: item.trackName || track?.title || query.query,
            artist: item.artistName || track?.artist || "Unknown Artist",
            lyrics,
            thumbnail: track?.thumbnail
        }
    } catch {
        return null
    }
}

async function fetchLyricsBackup(query: Query): Promise<LyricsResult | null> {
    try {
        const { data } = await axios.get("https://lyricsapi.fly.dev/api/lyrics", {
            params: { q: query.query },
            timeout: 12000
        })

        if (!data?.lyrics) return null

        return {
            title: data.title || query.query,
            artist: data.artist || "Unknown Artist",
            lyrics: normalizeLyrics(data.lyrics),
            thumbnail: data.image || null
        }
    } catch {
        return null
    }
}

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: "lyrics",
            aliases: ["lyric", "lirik"],
            category: "media",
            description: "Get song lyrics"
        })
    }

    run = async (M: ISimplifiedMessage, { args }: IParsedArgs): Promise<void> => {
        const queryText = args.join(" ").trim()

        if (!queryText) {
            return void M.reply("❌ Provide a song name\nExample: .lyrics Despacito")
        }

        try {
            const parsed = parseQuery(queryText)

            let track = await searchTrack(parsed)
            let result = await fetchLyrics(parsed, track)

            if (!result) {
                result = await fetchLyricsBackup(parsed)
            }

            if (!result) {
                return void M.reply("❌ Could not find lyrics for this song!")
            }

            const message =
                `🎶 Title: ${result.title}\n` +
                `👤 Artist: ${result.artist}\n\n` +
                `📝 Lyrics:\n\n${result.lyrics}`

            return void M.reply(message)
        } catch {
            return void M.reply("❌ Error fetching lyrics.")
        }
    }
}
