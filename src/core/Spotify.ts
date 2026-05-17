import { createRequire } from 'module'
import yts from 'yt-search'
import https from 'https'

const require = createRequire(import.meta.url)

function fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = ''
            res.on('data', chunk => data += chunk)
            res.on('end', () => resolve(data))
        }).on('error', reject)
    })
}

export default class {
    constructor(public url: string) {}

    parseSpotifyUrl = (): { type: 'track' | 'playlist' | 'album'; id: string } | null => {
        const trackMatch = this.url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/)
        const playlistMatch = this.url.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/)
        const albumMatch = this.url.match(/spotify\.com\/album\/([a-zA-Z0-9]+)/)

        if (trackMatch) return { type: 'track', id: trackMatch[1] }
        if (playlistMatch) return { type: 'playlist', id: playlistMatch[1] }
        if (albumMatch) return { type: 'album', id: albumMatch[1] }

        return null
    }

    getInfo = async (): Promise<{
        name?: string
        artists?: string[]
        album_name?: string
        release_date?: string
        cover_url?: string
        error?: string
    }> => {
        try {
            const parsed = this.parseSpotifyUrl()
            if (!parsed) return { error: 'Invalid Spotify URL' }

            const cleanUrl = this.url.split('?')[0]
            const html = await fetchUrl(cleanUrl)

            // Extract title from JSON-LD
            const titleMatch = html.match(/"name":\s*"([^"]+)"/)
            const title = titleMatch?.[1] || 'Unknown'

            // Try to get artist from various patterns
            let artist = 'Unknown Artist'
            const artistMatch1 = html.match(/"artist":\s*"([^"]+)"/)
            const artistMatch2 = html.match(/"byArtist":\s*\{[^}]*"name":\s*"([^"]+)"/)
            const artistMatch3 = html.match(/by\s+([A-Za-z\s]+)\s+on\s+Spotify/i)
            artist = artistMatch1?.[1] || artistMatch2?.[1] || artistMatch3?.[1] || 'Unknown Artist'

            // Get cover image from og:image
            const coverMatch = html.match(/<meta property="og:image" content="([^"]+)"/)
            const coverUrl = coverMatch?.[1] || null

            // Get album name
            const albumMatch = html.match(/"album":\s*\{[^}]*"name":\s*"([^"]+)"/)
            const albumName = albumMatch?.[1] || null

            // Get release date
            const dateMatch = html.match(/"datePublished":\s*"([^"]+)"/)
            const releaseDate = dateMatch?.[1] || null

            return {
                name: title,
                artists: [artist],
                cover_url: coverUrl || undefined,
                album_name: albumName || undefined,
                release_date: releaseDate || undefined
            }
        } catch (err) {
            console.error('[Spotify] Error:', err)
            const errorMsg = err instanceof Error ? err.message : String(err)
            return { error: `Error Fetching: ${errorMsg}` }
        }
    }

    searchYouTube = async (): Promise<{ url: string; title: string } | null> => {
        const info = await this.getInfo()
        if (info.error || !info.name) return null

        const query = info.artists
            ? `${info.artists[0]} - ${info.name}`
            : info.name

        const { videos } = await yts(query)
        if (!videos || videos.length === 0) return null

        return {
            url: videos[0].url,
            title: videos[0].title
        }
    }

    getAudio = async (): Promise<Buffer> => {
        throw new Error('Use searchYouTube() to get YouTube URL, then use YT class to download')
    }
}