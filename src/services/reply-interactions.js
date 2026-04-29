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

  return maybeHandleVuMenuReply({
    config,
    message,
    services,
    userSettings,
  });
}

module.exports = {
  maybeHandleReplyInteraction,
};
