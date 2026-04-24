module.exports = {
  meta: {
    name: "ping",
    aliases: ["tagall"],
    category: "group",
    description: "Mention every participant in the current group.",
    cooldownSeconds: 10,
    access: "admin",
    chat: "group",
    usage: "[message]",
  },
  async execute(ctx) {
    const participants = ctx.metadata?.participants || [];
    const mentions = participants.map((participant) => participant.id);
    const intro = ctx.text ? `${ctx.text}\n\n` : "";
    const members = mentions
      .map((jid, index) => `${index + 1}. @${jid.split("@")[0]}`)
      .join("\n");
    await ctx.send(
      ctx.msg.from,
      {
        text: `${intro}*Group ping*\n${members}`,
        mentions,
      },
      { quoted: ctx.msg.raw },
    );
  },
};
