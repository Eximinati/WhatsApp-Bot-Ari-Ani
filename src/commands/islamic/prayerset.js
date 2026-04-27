const {
  getCommandText,
  requireInput,
} = require("../../utils/islamic-command-utils");

const KNOWN_METHODS = new Set([
  "karachi",
  "muslimworldleague",
  "egyptian",
  "ummalqura",
  "dubai",
  "moonsightingcommittee",
  "northamerica",
  "kuwait",
  "qatar",
  "singapore",
  "tehran",
  "turkey",
  "other",
]);

module.exports = {
  meta: {
    name: "prayerset",
    aliases: ["salahset"],
    category: "islamic",
    description: "Save your prayer location and method for future prayer commands.",
    cooldownSeconds: 10,
    access: "user",
    chat: "both",
    usage: "<city|lat,long> [method]",
  },
  async execute(ctx) {
    const raw = getCommandText(ctx);
    if (!(await requireInput(ctx, raw, "Use /prayerset Karachi, Pakistan Karachi or /prayerset 24.8607,67.0011 Karachi."))) {
      return;
    }

    let method = "";
    let location = raw;
    const lastArg = String(ctx.args[ctx.args.length - 1] || "").toLowerCase();
    if (KNOWN_METHODS.has(lastArg) && ctx.args.length > 1) {
      method = ctx.args[ctx.args.length - 1];
      location = ctx.args.slice(0, -1).join(" ");
    }

    const saved = await ctx.services.islamic.savePrayerSettings(
      ctx.msg.sender,
      location,
      method || "Karachi",
    );

    await ctx.reply(
      [
        "*Prayer settings saved*",
        `City: ${saved.prayerCity || "custom coordinates"}`,
        `Country: ${saved.prayerCountry || "-"}`,
        `Latitude: ${saved.prayerLatitude ?? "-"}`,
        `Longitude: ${saved.prayerLongitude ?? "-"}`,
        `Method: ${saved.prayerMethod || "Karachi"}`,
      ].join("\n"),
    );
  },
};
