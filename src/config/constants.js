module.exports = {
  reconnect: {
    baseDelayMs: 3_000,
    maxDelayMs: 30_000,
  },
  access: {
    states: ["none", "allowed", "trusted"],
  },
  commands: {
    defaultCooldownSeconds: 3,
  },
  scheduler: {
    tickIntervalMs: 30_000,
    vuSyncIntervalMs: 15 * 60 * 1000,
  },
  groups: {
    welcomeTemplate:
      "*@{{name}}* welcome to *{{group}}*.\n\n{{description}}",
    farewellTemplate:
      "@{{name}} left *{{group}}*.",
  },
  media: {
    maxStickerVideoSeconds: 10,
  },
  xp: {
    dailyMin: 20,
    dailyMax: 45,
    commandMin: 2,
    commandMax: 6,
    roles: ["Scholar", "Coder", "Strategist", "Sprinter", "Night Owl"],
  },
};
