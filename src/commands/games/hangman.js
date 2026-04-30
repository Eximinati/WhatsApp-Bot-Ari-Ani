const { createCanvas } = require("@napi-rs/canvas");

const hangmanWords = {
  easy: ["apple","banana","orange","grape","dog","cat","sun","tree","car","book"],
  medium: ["javascript","python","variable","function","database","server","browser"],
  hard: ["asynchronous","polymorphism","authentication","encapsulation","architecture"]
};

const games = new Map();

module.exports = {
  meta: {
    name: "hangman",
    aliases: ["hm"],
    category: "games",
    cooldownSeconds: 5,
    access: "user",
    chat: "group",
    description: "Play Hangman in groups"
  },

  async execute(ctx) {

    const client = ctx.client || ctx.sock || ctx.conn;
    const msg = ctx.msg;
    const jid = msg?.key?.remoteJid || ctx.from;

    if (!msg?.key?.remoteJid?.endsWith("@g.us")) {
      return ctx.reply("❌ Group only game.");
    }

    const groupId = jid;

    const difficulty = (ctx.args.join(" ") || "easy").toLowerCase();

    if (!hangmanWords[difficulty]) {
      return ctx.reply("❌ Use: easy, medium, hard");
    }

    if (games.has(groupId)) {
      return ctx.reply("⚠️ Game already running!");
    }

    const word =
      hangmanWords[difficulty][
        Math.floor(Math.random() * hangmanWords[difficulty].length)
      ].toLowerCase();

    const game = {
      word,
      display: Array(word.length).fill("_"),
      guessed: new Set(),
      attempts: 6,
      difficulty
    };

    games.set(groupId, game);

    const img = await render(game);

    return client.sendMessage(jid, {
      image: img,
      caption:
        `🎮 HANGMAN (${difficulty.toUpperCase()})\n` +
        `Attempts: ${game.attempts}\n\nReply with a letter`
    }, { quoted: msg });
  },

  async handleGuess(client, ctx) {

    const msg = ctx.msg;
    const jid = msg?.key?.remoteJid;

    if (!jid || !jid.endsWith("@g.us")) return;

    if (!games.has(jid)) return;

    const game = games.get(jid);

    const text = (
      ctx.body ||
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      ""
    ).trim().toLowerCase();

    const letter = text;

    if (!letter || letter.length !== 1 || !/^[a-z]$/.test(letter)) return;

    if (game.guessed.has(letter)) return;

    game.guessed.add(letter);

    
    if (game.word.includes(letter)) {

      for (let i = 0; i < game.word.length; i++) {
        if (game.word[i] === letter) {
          game.display[i] = letter;
        }
      }

      if (!game.display.includes("_")) {
        games.delete(jid);
        return client.sendMessage(jid, {
          text: `🎉 You won! Word: ${game.word}`
        }, { quoted: msg });
      }

      const img = await render(game);

      return client.sendMessage(jid, {
        image: img,
        caption: "✅ Correct!"
      }, { quoted: msg });

    }

    
    game.attempts--;

    if (game.attempts <= 0) {
      games.delete(jid);

      const img = await render(game);

      return client.sendMessage(jid, {
        image: img,
        caption: `💀 Game over! Word: ${game.word}`
      }, { quoted: msg });
    }

    const img = await render(game);

    return client.sendMessage(jid, {
      image: img,
      caption: `❌ Wrong! Attempts: ${game.attempts}`
    }, { quoted: msg });
  }
};


async function render(game) {

  const canvas = createCanvas(700, 400);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, 700, 400);

  ctx.fillStyle = "#fff";
  ctx.font = "40px Arial";

  ctx.fillText(game.display.join(" "), 200, 200);
  ctx.fillText(`Attempts: ${game.attempts}`, 220, 300);

  return canvas.toBuffer("image/png");
}
