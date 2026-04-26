const Session = require("../models/session");
const SessionKey = require("../models/session-key");

async function resetSessionState({ sessionId }) {
  const [sessionResult, keyResult] = await Promise.all([
    Session.deleteOne({ sessionId }),
    SessionKey.deleteMany({ sessionId }),
  ]);

  return {
    deletedSessionCount: sessionResult?.deletedCount || 0,
    deletedKeyCount: keyResult?.deletedCount || 0,
  };
}

module.exports = {
  resetSessionState,
};
