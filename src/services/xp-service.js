const UserSetting = require("../models/user-settings");
const constants = require("../config/constants");
const { startOfTodayKey } = require("../utils/schedule");
const { extract } = require("../utils/identity-resolver");
const { DEFAULT_STATS, STAT_POINTS_PER_LEVEL, clampStats, MAX_STAT, canUpgrade } = require("../utils/stat-utils");

function xpForLevel(level) {
  return 5 * level * level + 50 * level + 100;
}

function getXpMultiplier(level) {
  if (level >= 100) return 2.0;
  if (level >= 75) return 1.5;
  if (level >= 50) return 1.3;
  if (level >= 25) return 1.2;
  if (level >= 10) return 1.1;
  return 1.0;
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
      profile.statPoints = (profile.statPoints || 0) + STAT_POINTS_PER_LEVEL;
      leveledUp = true;
    }

    await profile.save();
    return { profile, leveledUp, amountEarned: amount };
  }

  async getStats(jid) {
    const profile = await this.getProfile(jid);
    let stats = DEFAULT_STATS;
    try {
      if (profile.statsJson) {
        stats = JSON.parse(profile.statsJson);
      }
    } catch (e) {
      stats = { ...DEFAULT_STATS };
    }
    
    // Ensure stats are clamped
    stats = clampStats(stats);
    
    return {
      stats,
      statPoints: profile.statPoints || 0,
      level: profile.level
    };
  }

  async upgradeStat(jid, statName, points) {
    const profile = await this.getProfile(jid);
    let stats = DEFAULT_STATS;
    try {
      if (profile.statsJson) {
        stats = JSON.parse(profile.statsJson);
      }
    } catch (e) {
      stats = { ...DEFAULT_STATS };
    }
    
    if (!stats[statName]) {
      return { success: false, error: "Invalid stat name" };
    }
    if (!canUpgrade(stats[statName])) {
      return { success: false, error: `Max stat level (${MAX_STAT}) reached` };
    }
    if (profile.statPoints < points) {
      return { success: false, error: "Not enough points" };
    }
    
    // Apply upgrade with cap
    stats[statName] += points;
    if (stats[statName] > MAX_STAT) stats[statName] = MAX_STAT;
    
    profile.statPoints -= points;
    profile.statsJson = JSON.stringify(clampStats(stats));
    profile.lastXpAwardedAt = new Date();
    await profile.save();
    
    return { success: true, stats, statPoints: profile.statPoints };
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
    const multiplier = getXpMultiplier(profile.level);

    return {
      currentXp: profile.xp,
      level: profile.level,
      nextLevelXp: xpForLevel(profile.level + 1),
      rankTitle: this.getRole(profile.level),
      xpMultiplier: multiplier,
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

    const multiplier = getXpMultiplier(profile.level);
    const baseReward =
      Math.floor(
        Math.random() *
          (constants.xp.dailyMax - constants.xp.dailyMin + 1),
      ) + constants.xp.dailyMin;
    const reward = Math.floor(baseReward * multiplier);

    profile.dailyClaimedAt = new Date();
    profile.lastStreakAt = new Date();

    await profile.save();
    await this.addXp(jid, reward);

    return {
      claimed: true,
      profile: await this.getProfile(jid),
      reward,
      streak: profile.streakCount,
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
  getXpMultiplier,
};