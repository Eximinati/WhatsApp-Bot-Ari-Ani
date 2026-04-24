const UserSetting = require("../models/user-settings");

function xpForLevel(level) {
  return 5 * level * level + 50 * level + 100;
}

class XpService {
  async getProfile(jid) {
    return UserSetting.findOneAndUpdate(
      { jid },
      { $setOnInsert: { jid } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  async addXp(jid, amount) {
    const profile = await this.getProfile(jid);
    profile.xp += amount;

    let leveledUp = false;
    while (profile.xp >= xpForLevel(profile.level + 1)) {
      profile.level += 1;
      leveledUp = true;
    }

    await profile.save();
    return { profile, leveledUp };
  }

  async getRank(jid) {
    const profile = await this.getProfile(jid);
    return {
      currentXp: profile.xp,
      level: profile.level,
      nextLevelXp: xpForLevel(profile.level + 1),
      rankTitle: this.getRole(profile.level),
    };
  }

  getRole(level) {
    if (level < 5) return "Beginner";
    if (level < 10) return "Apprentice";
    if (level < 20) return "Adventurer";
    if (level < 30) return "Elite";
    if (level < 40) return "Master";
    return "Legend";
  }
}

module.exports = {
  XpService,
  xpForLevel,
};
