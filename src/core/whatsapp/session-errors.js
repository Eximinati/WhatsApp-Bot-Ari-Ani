function isSessionError(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || "");

  return (
    name === "SessionError" ||
    /No sessions/i.test(message) ||
    /not-acceptable/i.test(message)
  );
}

function isSenderKeyDistributionMessage(rawMessage) {
  return Boolean(rawMessage?.message?.senderKeyDistributionMessage);
}

function isProtocolMessage(rawMessage) {
  return Boolean(rawMessage?.message?.protocolMessage);
}

module.exports = {
  isProtocolMessage,
  isSenderKeyDistributionMessage,
  isSessionError,
};
