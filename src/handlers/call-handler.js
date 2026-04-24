function createCallHandler({ logger }) {
  return async function handleCall(event) {
    const calls = Array.isArray(event) ? event : [event];
    for (const call of calls) {
      logger.info(
        {
          callId: call?.id,
          from: call?.from,
          status: call?.status,
          isGroup: Boolean(call?.isGroup),
          isVideo: Boolean(call?.isVideo),
        },
        "Call event received",
      );
    }
  };
}

module.exports = {
  createCallHandler,
};
