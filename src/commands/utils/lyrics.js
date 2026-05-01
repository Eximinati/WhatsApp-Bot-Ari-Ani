const axios = require("axios");

module.exports = {
  meta: {
    name: "lyrics",
    aliases: ["ly", "lyric"],
    category: "utils",
    description: "Get lyrics for a song with YouTube link",
    cooldownSeconds: 10,
    access: "user",
    chat: "both",
    usage: "<song name> [artist]",
  },
  async execute(ctx) {
    const { args, reply } = ctx;

    if (!args[0]) {
      await reply("Usage: /lyrics <song name> [artist]\nExample: /lyrics Shape of You Ed Sheeran");
      return;
    }

    const searchQuery = args.join(" ");
    await reply(`🔍 Searching for: *${searchQuery}*`);

    try {
      // Get YouTube video for the song
      let youtubeUrl = null;
      try {
        const yts = require("youtube-yts");
        const videoResults = await yts.search({ query: searchQuery + " lyrics official", numResults: 1 });
        if (videoResults?.videos?.[0]) {
          youtubeUrl = videoResults.videos[0].url;
        }
      } catch (ytsError) {
        console.log("YouTube search skipped:", ytsError.message);
      }

      // Get lyrics from lrclib.net
      let lyrics = null;
      let songInfo = null;

      // Try with artist if provided (last arg as artist)
      if (args.length >= 2) {
        const trackName = args.slice(0, -1).join(" ");
        const artistName = args[args.length - 1];

        try {
          const searchUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artistName)}&track_name=${encodeURIComponent(trackName)}`;
          const response = await axios.get(searchUrl, { timeout: 10000 });
          if (response.data?.syncedLyrics || response.data?.plainLyrics) {
            lyrics = response.data.syncedLyrics || response.data.plainLyrics;
            songInfo = {
              artist: response.data.artistName,
              track: response.data.trackName,
              album: response.data.albumName,
            };
          }
        } catch (e) {
          // Continue to search
        }
      }

      // If not found, try general search
      if (!lyrics) {
        try {
          const searchApiUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`;
          const searchResponse = await axios.get(searchApiUrl, { timeout: 10000 });

          if (searchResponse.data?.length > 0) {
            const result = searchResponse.data[0];
            const getUrl = `https://lrclib.net/api/get/${result.id}`;
            const lyricsResponse = await axios.get(getUrl, { timeout: 10000 });

            if (lyricsResponse.data?.syncedLyrics || lyricsResponse.data?.plainLyrics) {
              lyrics = lyricsResponse.data.syncedLyrics || lyricsResponse.data.plainLyrics;
              songInfo = {
                artist: lyricsResponse.data.artistName,
                track: lyricsResponse.data.trackName,
                album: lyricsResponse.data.albumName,
              };
            }
          }
        } catch (e) {
          // Continue
        }
      }

      if (!lyrics) {
        await reply(`❌ No lyrics found for: *${searchQuery}*\n\nTips:\n• Try with artist: /lyrics Song Artist\n• Check spelling`);
        return;
      }

      // Format lyrics
      const maxLength = 3500;
      const formattedLyrics = lyrics.slice(0, maxLength);

      let message = `*🎵 Lyrics Found*\n\n`;

      if (songInfo) {
        message += `📻 *${songInfo.track}*\n`;
        message += `👤 Artist: ${songInfo.artist}\n`;
        if (songInfo.album) message += `💿 Album: ${songInfo.album}\n`;
      }

      message += `\n${formattedLyrics}`;

      if (lyrics.length > maxLength) {
        message += `\n\n*... (truncated)*`;
      }

      if (youtubeUrl) {
        message += `\n\n🎬 YouTube: ${youtubeUrl}`;
      }

      await reply(message);

    } catch (error) {
      console.error("Lyrics error:", error.message);
      await reply(`❌ Error: ${error.message}\nPlease try again later.`);
    }
  },
};