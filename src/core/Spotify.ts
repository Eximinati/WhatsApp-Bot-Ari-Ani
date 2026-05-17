import { createRequire } from 'module'
import yts from 'yt-search'
import https from 'https'
import fetch from 'isomorphic-unfetch'

const require = createRequire(import.meta.url)
const spotifyUrlInfo = require('spotify-url-info')(fetch)

const { getPreview, getTracks } = spotifyUrlInfo

function fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = ''
            res.on('data', chunk => data += chunk)
            res.on('end', () => resolve(data))
        }).on('error', reject)
    })
}

export interface SpotifyTrack {
    name: string
    artists: string[]
    album_name?: string
    cover_url?: string
    duration_ms?: number
    id: string
}

export interface SpotifyPlaylist {
    name: string
    total: number
    tracks: SpotifyTrack[]
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

            if (parsed.type === 'track') {
                const preview = await getPreview(cleanUrl)
                return {
                    name: preview.track || preview.title || 'Unknown',
                    artists: [preview.artist || 'Unknown Artist'],
                    cover_url: preview.image || undefined
                }
            }

            const html = await fetchUrl(cleanUrl)
            const titleMatch = html.match(/"name":\s*"([^"]+)"/)
            const title = titleMatch?.[1] || 'Unknown'

            let artist = 'Unknown Artist'
            const artistMatch1 = html.match(/"artist":\s*"([^"]+)"/)
            const artistMatch2 = html.match(/"byArtist":\s*\{[^}]*"name":\s*"([^"]+)"/)
            const artistMatch3 = html.match(/by\s+([A-Za-z\s]+)\s+on\s+Spotify/i)
            artist = artistMatch1?.[1] || artistMatch2?.[1] || artistMatch3?.[1] || 'Unknown Artist'

            const coverMatch = html.match(/<meta property="og:image" content="([^"]+)"/)
            const coverUrl = coverMatch?.[1] || null

            const albumMatch = html.match(/"album":\s*\{[^}]*"name":\s*"([^"]+)"/)
            const albumName = albumMatch?.[1] || null

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

    getPlaylist = async (maxTracks = 100): Promise<SpotifyPlaylist | null> => {
        const parsed = this.parseSpotifyUrl()
        if (!parsed || parsed.type !== 'playlist') return null

        const cleanUrl = `https://open.spotify.com/playlist/${parsed.id}`

        try {
            console.log('[Spotify] Fetching playlist:', parsed.id)
            
            const tracksRaw = await getTracks(cleanUrl)
            console.log('[Spotify] Raw tracks:', tracksRaw?.length || 0)
            
            const tracks: SpotifyTrack[] = (tracksRaw || []).slice(0, maxTracks).map((t: any, index: number) => ({
                name: t.track || t.name || 'Unknown',
                artists: t.artist ? [t.artist] : ['Unknown Artist'],
                album_name: t.album || undefined,
                cover_url: t.image || undefined,
                id: t.id || `track-${index}`
            }))

            console.log('[Spotify] Mapped tracks:', tracks.length)
            return { name: 'Playlist', total: tracksRaw?.length || tracks.length, tracks }
        } catch (err) {
            console.log('[Spotify] Playlist error:', err)
            return this.getPlaylistBasic(maxTracks)
        }
    }

    private getPlaylistBasic = async (maxTracks = 50): Promise<SpotifyPlaylist | null> => {
        try {
            const html = await fetchUrl(this.url.split('?')[0])
            const nameMatch = html.match(/"name":\s*"([^"]+)"/)
            const playlistName = nameMatch?.[1] || 'Playlist'

            const tracks: SpotifyTrack[] = []
            const trackMatches = html.match(/"track":\s*\{[^}]*"name":\s*"([^"]+)"[^}]*\}/g) || []

            for (let i = 0; i < Math.min(trackMatches.length, maxTracks); i++) {
                const trackHtml = trackMatches[i]
                const nameMatch = trackHtml.match(/"name":\s*"([^"]+)"/)
                const artistMatch = trackHtml.match(/"artist":\s*"([^"]+)"/)

                if (nameMatch) {
                    tracks.push({
                        name: nameMatch[1],
                        artists: artistMatch ? [artistMatch[1]] : ['Unknown Artist'],
                        id: `track-${i}`
                    })
                }
            }

            return { name: playlistName, total: tracks.length, tracks }
        } catch {
            return null
        }
    }

    searchYouTubeBatch = async (tracks: SpotifyTrack[]): Promise<{ url: string; title: string; artist: string; trackName: string }[]> => {
        const results: { url: string; title: string; artist: string; trackName: string }[] = []

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i]
            const query = `${track.artists[0]} - ${track.name}`
            try {
                const searchResults = await yts(query)
                if (searchResults.videos?.length > 0) {
                    results.push({
                        url: searchResults.videos[0].url,
                        title: searchResults.videos[0].title,
                        artist: track.artists[0],
                        trackName: track.name
                    })
                } else {
                    console.log(`[Spotify] No results: ${track.name}`)
                }
            } catch (e) {
                console.log(`[Spotify] Search error for: ${track.name} - ${e}`)
            }

            // Add delay to avoid rate limiting
            if (i < tracks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500))
            }
        }

        console.log(`[Spotify] Successfully found ${results.length}/${tracks.length} tracks`)
        return results
    }
}