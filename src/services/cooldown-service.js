const { extract } = require("../utils/identity-resolver");
const CommandCooldown = require("../models/command-cooldown");

function _norm(jid) {
  return extract(jid);
}

class CooldownService {
  getKey(userJid, commandName) {
    return `${_norm(userJid)}:${commandName.toLowerCase()}`;
  }

  async acquire(userJid, commandName, cooldownSeconds) {
    const cooldownMs = Math.max(0, cooldownSeconds) * 1000;
    if (!cooldownMs) {
      return { active: false, remainingMs: 0, token: null };
    }

    const key = this.getKey(userJid, commandName);
    const now = Date.now();
    const threshold = new Date(now - cooldownMs);
    const acquiredAt = new Date(now);
    const normalizedJid = _norm(userJid);
    const normalizedCommand = String(commandName || "").toLowerCase();

    const updated = await CommandCooldown.findOneAndUpdate(
      {
        key,
        $or: [{ lastUsedAt: null }, { lastUsedAt: { $lte: threshold } }],
      },
      {
        $set: {
          key,
          jid: normalizedJid,
          command: normalizedCommand,
          lastUsedAt: acquiredAt,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    if (updated) {
      return {
        active: false,
        remainingMs: 0,
        token: { key, acquiredAt: acquiredAt.toISOString() },
      };
    }

    const existing = await CommandCooldown.findOne({ key }).lean();
    const expiresAt = new Date(existing?.lastUsedAt || 0).getTime() + cooldownMs;
    return {
      active: true,
      remainingMs: Math.max(0, expiresAt - now),
      token: null,
    };
  }

  async rollback(token) {
    if (!token?.key || !token?.acquiredAt) {
      return;
    }

    await CommandCooldown.updateOne(
      {
        key: token.key,
        lastUsedAt: new Date(token.acquiredAt),
      },
      {
        $set: { lastUsedAt: null },
      },
    );
  }
}

module.exports = {
  CooldownService,
};
