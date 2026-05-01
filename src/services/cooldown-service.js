const { extract } = require("../utils/identity-resolver");

function _norm(jid) {
  return extract(jid);
}

class CooldownService {
  constructor() {
    this.timestamps = new Map();
  }

  getKey(userJid, commandName) {
    return `${_norm(userJid)}:${commandName.toLowerCase()}`;
  }

  check(userJid, commandName, cooldownSeconds) {
    const cooldownMs = Math.max(0, cooldownSeconds) * 1000;
    if (!cooldownMs) {
      return { active: false, remainingMs: 0 };
    }

    const key = this.getKey(userJid, commandName);
    const expiresAt = this.timestamps.get(key) || 0;
    const now = Date.now();

    if (expiresAt > now) {
      return { active: true, remainingMs: expiresAt - now };
    }

    return { active: false, remainingMs: 0 };
  }

  consume(userJid, commandName, cooldownSeconds) {
    const cooldownMs = Math.max(0, cooldownSeconds) * 1000;
    if (!cooldownMs) {
      return;
    }

    const key = this.getKey(userJid, commandName);
    this.timestamps.set(key, Date.now() + cooldownMs);
  }
}

module.exports = {
  CooldownService,
};
