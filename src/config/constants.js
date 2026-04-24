module.exports = {
  reconnect: {
    baseDelayMs: 3_000,
    maxDelayMs: 30_000,
  },
  commands: {
    defaultCooldownSeconds: 3,
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
};
