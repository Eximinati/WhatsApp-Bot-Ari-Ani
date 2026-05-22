export interface PlaylistTrack {
    name: string
    artists: string[]
}

export const buildTrackListText = (
    tracks: PlaylistTrack[],
    total: number,
    headerPrefix: string,
    footer: string
): string => {
    let text = headerPrefix + '\n\n'
    for (let i = 0; i < total; i++) {
        const t = tracks[i]
        text += `${i + 1}. *${t.name}* - ${t.artists[0]}\n`
    }
    text += `\n${footer}`
    return text
}
