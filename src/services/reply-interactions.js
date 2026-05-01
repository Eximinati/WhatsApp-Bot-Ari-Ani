const { maybeHandleVuMenuReply } = require("./vu-menu");

async function maybeHandleReplyInteraction({
  config,
  message,
  services,
  sock,
  userSettings,
}) {
  const handledMediaReply = await services.media?.maybeHandleReply?.({
    config,
    message,
    sock,
    userSettings,
  });
  if (handledMediaReply) {
    return true;
  }

  const vuReply = await maybeHandleVuMenuReply({
    config,
    message,
    services,
    userSettings,
  });
  if (vuReply) {
    return true;
  }

  await services.games.maybeHandleRpsReply?.({
    message,
    services,
  });

  await services.games.maybeHandleTriviaReply?.({
    message,
    services,
  });

  return false;
}

module.exports = {
  maybeHandleReplyInteraction,
};
