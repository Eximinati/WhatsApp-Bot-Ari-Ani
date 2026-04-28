const axios = require("axios");

module.exports = async function youtubeEngine(ctx) {
  const client = ctx.client || ctx.sock || ctx.conn;
  const msg = ctx.msg;
  const jid = msg?.key?.remoteJid || ctx.from;

  if (!client?.searchStore) return;

  const text = (ctx.body || "").trim();
  const data = client.searchStore.get(jid);

  if (!data) return;

  if (data.stage === "select") {

    const num = parseInt(text);

    if (isNaN(num) || num < 1 || num > data.results.length) {
      return client.sendMessage(jid, {
        text: "❌ Invalid number. Try again."
      }, { quoted: msg });
    }

    const selected = data.results[num - 1];

    data.stage = "type";
    data.selected = selected;

    client.searchStore.set(jid, data);

    return client.sendMessage(jid, {
      text:
`🎧 *Choose Format*

1 → Video 🎬
2 → Audio 🎵

Reply with 1 or 2`
    }, { quoted: msg });
  }

 
  if (data.stage === "type") {

    const url = data.selected.url;
    const info = data.selected;

    client.searchStore.delete(jid);

  
    if (text === "1") {

      await client.sendMessage(jid, {
        text: "🎥 Downloading video..."
      }, { quoted: msg });

      try {
        const api1 = `https://apis.davidcyril.name.ng/youtube/mp4?url=${encodeURIComponent(url)}`;
        const { data: d1 } = await axios.get(api1);

        if (d1?.result?.download_url) {
          return client.sendMessage(jid, {
            video: { url: d1.result.download_url },
            caption: info.title
          }, { quoted: msg });
        }
      } catch {}

      try {
        const api2 = `https://apis.davidcyril.name.ng/download/ytmp4?url=${encodeURIComponent(url)}`;
        const { data: d2 } = await axios.get(api2);

        if (d2?.result?.download_url) {
          return client.sendMessage(jid, {
            video: { url: d2.result.download_url },
            caption: info.title
          }, { quoted: msg });
        }
      } catch {}

      return client.sendMessage(jid, {
        text: "❌ Video download failed."
      }, { quoted: msg });
    }

    
    if (text === "2") {

      await client.sendMessage(jid, {
        text: "🎶 Downloading audio..."
      }, { quoted: msg });

      try {
        const api = `https://apis.davidcyril.name.ng/play?query=${encodeURIComponent(url)}`;
        const { data: d1 } = await axios.get(api);

        if (d1?.result?.download_url) {
          return client.sendMessage(jid, {
            document: { url: d1.result.download_url },
            mimetype: "audio/mpeg",
            fileName: `${info.title}.mp3`
          }, { quoted: msg });
        }
      } catch {}

      return client.sendMessage(jid, {
        text: "❌ Audio download failed."
      }, { quoted: msg });
    }

    return client.sendMessage(jid, {
      text: "❌ Reply with 1 or 2."
    }, { quoted: msg });
  }
};
