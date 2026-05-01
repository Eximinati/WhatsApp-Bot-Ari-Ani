const UserSetting = require("../models/user-settings");
const constants = require("../config/constants");
const { startOfTodayKey } = require("../utils/schedule");
const { extract } = require("../utils/identity-resolver");

function xpForLevel(level) {
  return 5 * level * level + 50 * level + 100;
}

class XpService {
  async getProfile(jid) {
    const id = extract(jid);

    return UserSetting.findOneAndUpdate(
      { jid: id },
      { $setOnInsert: { jid: id } },
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
    profile.lastXpAwardedAt = new Date();

    let leveledUp = false;
    while (profile.xp >= xpForLevel(profile.level + 1)) {
      profile.level += 1;
      leveledUp = true;
    }

    await profile.save();
    return { profile, leveledUp };
  }

  async awardCommandXp(jid) {
    const amount =
      Math.floor(
        Math.random() *
          (constants.xp.commandMax - constants.xp.commandMin + 1),
      ) + constants.xp.commandMin;

    return this.addXp(jid, amount);
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

  async getLeaderboard(limit = 10) {
    return UserSetting.find({})
      .sort({ xp: -1, level: -1, updatedAt: 1 })
      .limit(limit)
      .lean();
  }

  async claimDaily(jid, timezone = "UTC") {
    const profile = await this.getProfile(jid);

    const currentKey = startOfTodayKey(timezone);
    const lastKey = profile.dailyClaimedAt
      ? startOfTodayKey(timezone, profile.dailyClaimedAt)
      : "";

    if (profile.dailyClaimedAt && currentKey === lastKey) {
      return { claimed: false, profile };
    }

    const yesterdayKey = startOfTodayKey(
      timezone,
      new Date(Date.now() - 24 * 60 * 60 * 1000),
    );

    if (profile.dailyClaimedAt && lastKey === yesterdayKey) {
      profile.streakCount += 1;
    } else {
      profile.streakCount = 1;
    }

    const reward =
      Math.floor(
        Math.random() *
          (constants.xp.dailyMax - constants.xp.dailyMin + 1),
      ) + constants.xp.dailyMin;

    profile.dailyClaimedAt = new Date();
    profile.lastStreakAt = new Date();

    await profile.save();
    await this.addXp(jid, reward);

    return {
      claimed: true,
      profile: await this.getProfile(jid),
      reward,
    };
  }

  listSelectableRoles() {
    return constants.xp.roles;
  }

  async setPreferredRole(jid, role) {
    const id = extract(jid);

    if (!this.listSelectableRoles().includes(role)) {
      throw new Error("Unknown role.");
    }

    return UserSetting.findOneAndUpdate(
      { jid: id },
      { $set: { preferredRole: role } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  getDisplayedRole(profile) {
    return profile.preferredRole || this.getRole(profile.level);
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