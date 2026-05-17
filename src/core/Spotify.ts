import { createRequire } from 'module'
import yts from 'yt-search'

const require = createRequire(import.meta.url)
const spotifyUrlInfo = require('spotify-url-info')
const isomorphicFetch = require('isomorphic-unfetch')
const { getPreview } = spotifyUrlInfo(isomorphicFetch)

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

            const spotifyUrl = `https://open.spotify.com/${parsed.type}/${parsed.id}`
            const preview = await getPreview(spotifyUrl)

            return {
                name: preview.track || preview.title || 'Unknown',
                artists: [preview.artist || 'Unknown Artist'],
                cover_url: preview.image || null,
                album_name: preview.album || null,
                release_date: preview.date || null
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error'
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