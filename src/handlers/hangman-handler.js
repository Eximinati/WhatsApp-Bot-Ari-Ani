const hangman = require("../commands/games/hangman");

client.ev.on("messages.upsert", async ({ messages }) => {

  const msg = messages[0];
  if (!msg || !msg.message) return;

  const body =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    "";

  const ctx = {
    msg,
    client,

    from: msg.key.remoteJid,
    sender: msg.key.participant || msg.key.remoteJid,

    body: body.trim(),
    args: body.trim().split(" ").slice(1),

    isGroup: msg.key.remoteJid.endsWith("@g.us"),

    reply: (text) =>
      client.sendMessage(msg.key.remoteJid, { text }, { quoted: msg })
  };

  try {

  
    if (ctx.isGroup) {

      const text = ctx.body?.toLowerCase();

      if (text && text.length === 1 && /^[a-z]$/.test(text)) {

        
        if (typeof hangman.handleGuess === "function") {
          await hangman.handleGuess(client, ctx);
          return;
        }
      }
    }

    if (body.startsWith("+")) {

      const cmdName = body.slice(1).split(" ")[0].toLowerCase();

      const command = client.commands?.get(cmdName);

      if (command) {
        await command.execute(ctx);
      }
    }

  } catch (err) {
    console.log("Engine Error:", err);
  }

});
