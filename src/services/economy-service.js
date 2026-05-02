const constants = require("../config/constants");
const Faction = require("../models/faction");
const UserSetting = require("../models/user-settings");
const { startOfTodayKey } = require("../utils/schedule");
const {
  clampMoney,
  formatDurationMs,
  formatMoney,
  parseAmountInput,
  parseBetInput,
  parseInventory,
  parseJsonArray,
  parseJsonObject,
  randomBetween,
  stringifyInventory,
  totalWealth,
} = require("../utils/economy");
const { extract } = require("../utils/identity-resolver");

const REWARD_CAPS = {
  fish: 500,
  mine: 800,
  hunt: 700,
  beg: 100,
  work: 150,
};

const RARE_METER_TIMEOUT = 5 * 60 * 1000;

const STREAK_STREAMS = {};
const STREAK_TIMEOUT = 5 * 60 * 1000;

function getStreakCount(jid, domain) {
  const key = `${extract(jid)}_${domain}`;
  const stream = STREAK_STREAMS[key];
  if (!stream) return 0;
  if (Date.now() - stream.lastAt > STREAK_TIMEOUT) {
    delete STREAK_STREAMS[key];
    return 0;
  }
  return stream.count;
}

function updateStreak(jid, domain, success) {
  const key = `${extract(jid)}_${domain}`;
  if (success) {
    STREAK_STREAMS[key] = { count: (STREAK_STREAMS[key]?.count || 0) + 1, lastAt: Date.now() };
    return STREAK_STREAMS[key].count;
  } else {
    delete STREAK_STREAMS[key];
    return 0;
  }
}

function getStreakBonus(streakCount) {
  return Math.min(streakCount * 0.05, 0.5);
}

function updateSession(account) {
  const now = Date.now();
  const lastAction = account.lastActionAt ? new Date(account.lastActionAt).getTime() : 0;
  
  if (lastAction && (now - lastAction) < RARE_METER_TIMEOUT) {
    account.sessionCount = (account.sessionCount || 0) + 1;
  } else {
    account.sessionCount = 1;
  }
  account.lastActionAt = new Date();
  return account.sessionCount;
}

const RARE_EVENTS = [
  { text: "💰 Hidden treasure!", type: "coins", bonusMult: 5 },
  { text: "✨ XP Surge!", type: "xp", bonusMult: 2 },
  { text: "⚡ Lucky strike!", type: "coins", bonusMult: 3 },
  { text: "🌟 Rare find!", type: "coins", bonusMult: 4 },
  { text: "🎯 Perfect catch!", type: "multi", bonusMult: 2 },
];

function rollRareEvent(baseBonus, baseXp, domain, rareMeter = 0) {
  const domainChance = { fish: 0.03, mine: 0.035, hunt: 0.04, work: 0.02, beg: 0.015 };
  const baseChance = domainChance[domain] || 0.02;
  const boostedChance = baseChance + (rareMeter / 100) * 0.1;
  if (Math.random() > boostedChance) return null;
  const event = RARE_EVENTS[Math.floor(Math.random() * RARE_EVENTS.length)];
  return {
    ...event,
    type: event.type,
    bonus: event.type === "coins" ? Math.floor(baseBonus * event.bonusMult) : 0,
    xpBonus: event.type === "xp" ? Math.floor(baseXp * event.bonusMult) : 0,
  };
}

function sumDomainModifier(entities, bucket, domain) {
  return entities.reduce((sum, entity) => {
    const base = entity?.modifiers || entity?.bonusProfile || {};
    const scoped = base?.[bucket] || {};
    return sum + Number(scoped.all || 0) + Number(scoped[domain] || 0);
  }, 0);
}

function createBuffRecord(item) {
  return {
    key: item.key,
    name: item.name,
    type: "buff",
    expiresAt: new Date(Date.now() + (item.durationMs || 0)).toISOString(),
    modifiers: item.modifiers || {},
  };
}

class EconomyService {
  constructor() {
    this.factionSeedPromise = null;
  }

  async ensureFactions() {
    if (!this.factionSeedPromise) {
      this.factionSeedPromise = Promise.all(
        constants.economy.factions.map((faction) =>
          Faction.updateOne(
            { key: faction.key },
            {
              $setOnInsert: {
                key: faction.key,
                name: faction.name,
                description: faction.description,
                treasury: 0,
                memberCount: 0,
                bonusProfile: faction.bonusProfile || {},
              },
              $set: {
                name: faction.name,
                description: faction.description,
                bonusProfile: faction.bonusProfile || {},
              },
            },
            { upsert: true },
          ),
        ),
      );
    }

    await this.factionSeedPromise;
  }

  getJobs() {
    return constants.economy.jobs.map((job) => ({ ...job }));
  }

  getJob(key) {
    return this.getJobs().find((job) => job.key === key) || null;
  }

  getShopItems() {
    return constants.economy.shopItems.map((item) => ({ ...item }));
  }

  getShopItem(key) {
    return this.getShopItems().find((item) => item.key === key) || null;
  }

  async getFactions() {
    await this.ensureFactions();
    const docs = await Faction.find({})
      .sort({ treasury: -1, memberCount: -1, name: 1 })
      .lean();
    const byKey = new Map(docs.map((doc) => [doc.key, doc]));

    return constants.economy.factions.map((faction) => {
      const doc = byKey.get(faction.key) || {};
      return {
        key: faction.key,
        name: faction.name,
        description: faction.description,
        treasury: clampMoney(doc.treasury),
        memberCount: clampMoney(doc.memberCount),
        bonusProfile: faction.bonusProfile || {},
      };
    });
  }

  async getFactionByKey(key) {
    const factions = await this.getFactions();
    return factions.find((faction) => faction.key === key) || null;
  }

  parseActiveBuffs(account) {
    return parseJsonArray(account.activeBuffsJson).filter(
      (entry) => entry && typeof entry === "object" && entry.key,
    );
  }

  parseStats(account) {
    return parseJsonObject(account.economyStatsJson);
  }

  async getAccount(jid) {
    const id = extract(jid);
    const account = await UserSetting.findOneAndUpdate(
      { jid: id },
      { $setOnInsert: { jid: id } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    const buffs = this.parseActiveBuffs(account);
    const filtered = buffs.filter((entry) => {
      if (entry.type === "buff" && entry.expiresAt) {
        return new Date(entry.expiresAt).getTime() > Date.now();
      }
      return true;
    });

    if (JSON.stringify(buffs) !== JSON.stringify(filtered)) {
      account.activeBuffsJson = JSON.stringify(filtered);
      await account.save();
    }

    return account;
  }

  async getProgression(account) {
    const faction = account.factionKey
      ? await this.getFactionByKey(account.factionKey)
      : null;
    const job = this.getJob(account.jobKey);
    const equippedTool = this.getShopItem(account.equippedToolKey);
    const inventory = parseInventory(account.inventoryJson);
    const activeBuffs = this.parseActiveBuffs(account);
    const stats = this.parseStats(account);

    return {
      faction,
      job,
      equippedTool,
      inventory,
      activeBuffs,
      stats,
    };
  }

  buildEntities(progression) {
    const entities = [];
    if (progression.job) {
      entities.push(progression.job);
    }
    if (progression.faction) {
      entities.push(progression.faction);
    }
    if (progression.equippedTool?.modifiers) {
      entities.push(progression.equippedTool);
    }
    for (const buff of progression.activeBuffs) {
      if (buff.type === "buff" && buff.modifiers) {
        entities.push(buff);
      }
    }
    return entities;
  }

  getRewardMultiplier(progression, domain) {
    return 1 + sumDomainModifier(this.buildEntities(progression), "reward", domain);
  }

  getPayoutMultiplier(progression, domain) {
    return 1 + sumDomainModifier(this.buildEntities(progression), "payout", domain);
  }

  getCooldownMultiplier(progression, domain) {
    return Math.max(
      0.55,
      1 + sumDomainModifier(this.buildEntities(progression), "cooldown", domain),
    );
  }

  getSuccessBonus(progression, domain) {
    return sumDomainModifier(this.buildEntities(progression), "success", domain);
  }

  applyRewardMultiplier(value, progression, domain) {
    return clampMoney(Math.round(value * this.getRewardMultiplier(progression, domain)));
  }

  applyPayoutMultiplier(value, progression, domain) {
    return clampMoney(Math.round(value * this.getPayoutMultiplier(progression, domain)));
  }

  adjustCooldown(baseMs, progression, domain) {
    return Math.max(60_000, Math.round(baseMs * this.getCooldownMultiplier(progression, domain)));
  }

  getRemainingCooldown(lastAt, cooldownMs) {
    if (!lastAt) {
      return 0;
    }

    const expiresAt = new Date(lastAt).getTime() + cooldownMs;
    return Math.max(0, expiresAt - Date.now());
  }

  formatCooldown(remainingMs) {
    return formatDurationMs(remainingMs);
  }

  async incrementStats(account, patch) {
    const stats = this.parseStats(account);
    for (const [key, value] of Object.entries(patch || {})) {
      stats[key] = clampMoney(stats[key]) + clampMoney(value);
    }
    account.economyStatsJson = JSON.stringify(stats);
  }

  makePendingAction({ key, label, domain, dueAt, data }) {
    return {
      key,
      label,
      type: "pending",
      domain,
      dueAt: new Date(dueAt).toISOString(),
      data: data || {},
    };
  }

  readPendingAction(account, key) {
    return this.parseActiveBuffs(account).find(
      (entry) => entry.type === "pending" && entry.key === key,
    ) || null;
  }

  async upsertPendingAction(account, pending) {
    const buffs = this.parseActiveBuffs(account).filter(
      (entry) => !(entry.type === "pending" && entry.key === pending.key),
    );
    buffs.push(pending);
    account.activeBuffsJson = JSON.stringify(buffs);
  }

  async removePendingActions(account, keys) {
    const keySet = new Set(keys);
    const buffs = this.parseActiveBuffs(account).filter(
      (entry) => !(entry.type === "pending" && keySet.has(entry.key)),
    );
    account.activeBuffsJson = JSON.stringify(buffs);
  }

  toBalanceSummary(account, progression = null) {
    const resolved = progression || {
      inventory: parseInventory(account.inventoryJson),
      activeBuffs: this.parseActiveBuffs(account),
      stats: this.parseStats(account),
      job: this.getJob(account.jobKey),
      faction: null,
      equippedTool: this.getShopItem(account.equippedToolKey),
    };

    return {
      jid: account.jid,
      wallet: clampMoney(account.wallet),
      bank: clampMoney(account.bank),
      totalWealth: totalWealth(account),
      inventory: resolved.inventory,
      activeBuffs: resolved.activeBuffs,
      jobKey: account.jobKey || "",
      factionKey: account.factionKey || "",
      equippedToolKey: account.equippedToolKey || "",
      stats: resolved.stats,
    };
  }

  async getBalance(jid) {
    const account = await this.getAccount(jid);
    const progression = await this.getProgression(account);
    return this.toBalanceSummary(account, progression);
  }

  async getWealthRank(jid) {
    const account = await this.getAccount(jid);
    const wealth = totalWealth(account);
    const richerCount = await UserSetting.countDocuments({
      $expr: {
        $gt: [
          {
            $add: [{ $ifNull: ["$wallet", 0] }, { $ifNull: ["$bank", 0] }],
          },
          wealth,
        ],
      },
    });

    return {
      rank: richerCount + 1,
      totalWealth: wealth,
    };
  }

  async getWealthLeaderboard(limit = 10) {
    const rows = await UserSetting.aggregate([
      {
        $project: {
          jid: 1,
          wallet: { $ifNull: ["$wallet", 0] },
          bank: { $ifNull: ["$bank", 0] },
          totalWealth: {
            $add: [{ $ifNull: ["$wallet", 0] }, { $ifNull: ["$bank", 0] }],
          },
          jobKey: { $ifNull: ["$jobKey", ""] },
          factionKey: { $ifNull: ["$factionKey", ""] },
        },
      },
      { $sort: { totalWealth: -1, bank: -1, wallet: -1 } },
      { $limit: limit },
    ]);

    return rows.map((entry) => ({
      ...entry,
      wallet: clampMoney(entry.wallet),
      bank: clampMoney(entry.bank),
      totalWealth: clampMoney(entry.totalWealth),
    }));
  }

  formatBalanceLines(balance) {
    return [
      `Wallet: ${formatMoney(balance.wallet)}`,
      `Bank: ${formatMoney(balance.bank)}`,
      `Total wealth: ${formatMoney(balance.totalWealth)}`,
    ];
  }

  async addWallet(jid, amount) {
    const account = await this.getAccount(jid);
    account.wallet = clampMoney(account.wallet + amount);
    await account.save();
    const progression = await this.getProgression(account);
    return this.toBalanceSummary(account, progression);
  }

  async addBank(jid, amount) {
    const account = await this.getAccount(jid);
    account.bank = clampMoney(account.bank + amount);
    await account.save();
    const progression = await this.getProgression(account);
    return this.toBalanceSummary(account, progression);
  }

  async deposit(jid, amountInput) {
    const account = await this.getAccount(jid);
    const amount = parseAmountInput(amountInput, account.wallet);
    account.wallet = clampMoney(account.wallet - amount);
    account.bank = clampMoney(account.bank + amount);
    await account.save();
    const progression = await this.getProgression(account);
    return { amount, account: this.toBalanceSummary(account, progression) };
  }

  async withdraw(jid, amountInput) {
    const account = await this.getAccount(jid);
    const amount = parseAmountInput(amountInput, account.bank);
    account.bank = clampMoney(account.bank - amount);
    account.wallet = clampMoney(account.wallet + amount);
    await account.save();
    const progression = await this.getProgression(account);
    return { amount, account: this.toBalanceSummary(account, progression) };
  }

  async claimDailyCash(jid, timezone = "UTC") {
    const account = await this.getAccount(jid);
    const progression = await this.getProgression(account);
    const todayKey = startOfTodayKey(timezone);
    const lastKey = account.lastDailyMoneyAt
      ? startOfTodayKey(timezone, account.lastDailyMoneyAt)
      : "";

    if (account.lastDailyMoneyAt && lastKey === todayKey) {
      return {
        claimed: false,
        reward: 0,
        account: this.toBalanceSummary(account, progression),
      };
    }

    const reward = this.applyRewardMultiplier(
      randomBetween(constants.economy.dailyCashMin, constants.economy.dailyCashMax),
      progression,
      "daily",
    );
    account.wallet = clampMoney(account.wallet + reward);
    account.lastDailyMoneyAt = new Date();
    await this.incrementStats(account, { dailiesClaimed: 1 });
    await account.save();

    return {
      claimed: true,
      reward,
      account: this.toBalanceSummary(account, progression),
    };
  }

  async runTimedReward({
    jid,
    min,
    max,
    cooldownMs,
    stampKey,
    successMessage,
    domain,
  }) {
    const account = await this.getAccount(jid);
    const progression = await this.getProgression(account);
    const adjustedCooldown = this.adjustCooldown(cooldownMs, progression, domain);
    const remainingMs = this.getRemainingCooldown(account[stampKey], adjustedCooldown);
    if (remainingMs > 0) {
      return {
        ok: false,
        success: false,
        reason: "cooldown",
        remainingMs,
        rareMeter: account.rareMeter || 0,
        sessionCount: account.sessionCount || 0,
        failStreak: account.failStreak || 0,
        lastResult: account.lastResult || "",
        account: this.toBalanceSummary(account, progression),
      };
    }

    updateStreak(jid, domain, false);
    const sessionCount = updateSession(account);

    const reward = this.applyRewardMultiplier(randomBetween(min, max), progression, domain);
    const cap = REWARD_CAPS[domain] || Infinity;

    const streak = getStreakCount(jid, domain);
    const currentRareMeter = account.rareMeter || 0;

    const rare = rollRareEvent(reward, min, domain, currentRareMeter);
    if (rare && rare.type === "coins") {
      const rawReward = reward;
      const rareBonus = rare?.bonus || 0;
      const totalBeforeCap = rawReward + rareBonus;
      const finalReward = Math.min(totalBeforeCap, cap);
      const appliedRare = Math.max(0, finalReward - rawReward);
      account[stampKey] = new Date();
      account.wallet = clampMoney(account.wallet + finalReward);
      account.rareMeter = 0;
      account.failStreak = 0;
      account.lastResult = "win";
      await this.incrementStats(account, { [`${domain}Runs`]: 1 });
      await account.save();
      const newStreak = updateStreak(jid, domain, true);
      console.log(`[ECONOMY] ${domain} | user=${extract(jid)} | reward=${finalReward} | rare=${appliedRare} | streak=${newStreak}`);
      return {
        ok: true,
        success: true,
        reward: finalReward,
        streak: newStreak,
        rareMeter: 0,
        sessionCount,
        failStreak: 0,
        lastResult: "win",
        rare: { type: rare.type, bonus: appliedRare, text: rare.text },
        message: successMessage,
        account: this.toBalanceSummary(account, progression),
      };
    }

    const rawReward = reward;
    const finalCapped = Math.min(rawReward, cap);

    account.rareMeter = Math.min((currentRareMeter || 0) + randomBetween(3, 7), 100);
    account.failStreak = 0;
    account.lastResult = "win";
    account[stampKey] = new Date();
    account.wallet = clampMoney(account.wallet + finalCapped);
    await this.incrementStats(account, { [`${domain}Runs`]: 1 });
    await account.save();
    const newStreak = updateStreak(jid, domain, true);
    console.log(`[ECONOMY] ${domain} | user=${extract(jid)} | reward=${finalCapped} | streak=${newStreak}`);

    return {
      ok: true,
      success: true,
      reward: finalCapped,
      streak: newStreak,
      rareMeter: account.rareMeter,
      sessionCount,
      failStreak: 0,
      lastResult: "win",
      message: successMessage,
      account: this.toBalanceSummary(account, progression),
    };
  }

  async beg(jid) {
    return this.runTimedReward({
      jid,
      min: constants.economy.begMin,
      max: constants.economy.begMax,
      cooldownMs: constants.economy.begCooldownMs,
      stampKey: "lastBegAt",
      successMessage: "A kind stranger tossed you some pocket cash.",
      domain: "beg",
    });
  }

  async work(jid) {
    return this.runTimedReward({
      jid,
      min: constants.economy.workMin,
      max: constants.economy.workMax,
      cooldownMs: constants.economy.workCooldownMs,
      stampKey: "lastWorkAt",
      successMessage: "You finished a focused shift.",
      domain: "work",
    });
  }

  async performGather(jid, options) {
    const account = await this.getAccount(jid);
    const progression = await this.getProgression(account);
    const adjustedCooldown = this.adjustCooldown(options.cooldownMs, progression, options.domain);
    const remainingMs = this.getRemainingCooldown(account[options.stampKey], adjustedCooldown);

    if (remainingMs > 0) {
      return {
        ok: false,
        success: false,
        reason: "cooldown",
        remainingMs,
        rareMeter: account.rareMeter || 0,
        sessionCount: account.sessionCount || 0,
        failStreak: account.failStreak || 0,
        lastResult: account.lastResult || "",
        account: this.toBalanceSummary(account, progression),
      };
    }

    const sessionCount = updateSession(account);
    const successRate = Math.min(
      0.95,
      1 - options.missRate + this.getSuccessBonus(progression, options.domain),
    );
    account[options.stampKey] = new Date();

    if (Math.random() > successRate) {
      account.failStreak = Math.min((account.failStreak || 0) + 1, 10);
      account.lastResult = "fail";
      await this.incrementStats(account, { [`${options.domain}Fails`]: 1 });
      await account.save();
      updateStreak(jid, options.domain, false);
      return {
        ok: true,
        success: false,
        reward: 0,
        streak: 0,
        rareMeter: account.rareMeter || 0,
        sessionCount,
        failStreak: account.failStreak,
        lastResult: "fail",
        message: options.failMessage,
        account: this.toBalanceSummary(account, progression),
      };
    }

    const streak = getStreakCount(jid, options.domain);
    const baseReward = this.applyRewardMultiplier(
      randomBetween(options.min, options.max),
      progression,
      options.domain,
    );
    const cap = REWARD_CAPS[options.domain] || Infinity;
    const currentRareMeter = account.rareMeter || 0;

    const rare = rollRareEvent(baseReward, options.min, options.domain, currentRareMeter);
    if (rare && rare.type === "coins") {
      const rawReward = baseReward;
      const rareBonus = rare?.bonus || 0;
      const totalBeforeCap = rawReward + rareBonus;
      const finalReward = Math.min(totalBeforeCap, cap);
      const appliedRare = Math.max(0, finalReward - rawReward);
      account.wallet = clampMoney(account.wallet + finalReward);
      account.rareMeter = 0;
      account.failStreak = 0;
      account.lastResult = "win";
      await this.incrementStats(account, {
        [`${options.domain}Runs`]: 1,
        [`${options.domain}Wins`]: 1,
      });
      await account.save();
      const newStreak = updateStreak(jid, options.domain, true);
      console.log(`[ECONOMY] ${options.domain} | user=${extract(jid)} | reward=${finalReward} | rare=${appliedRare} | streak=${newStreak}`);
      return {
        ok: true,
        success: true,
        reward: finalReward,
        streak: newStreak,
        rareMeter: 0,
        sessionCount,
        failStreak: 0,
        lastResult: "win",
        rare: { type: rare.type, bonus: appliedRare, text: rare.text },
        message: options.successMessage,
        account: this.toBalanceSummary(account, progression),
      };
    }

    const rawReward = baseReward;
    const finalReward = Math.min(rawReward, cap);

    account.rareMeter = Math.min((currentRareMeter || 0) + randomBetween(3, 7), 100);
    account.failStreak = 0;
    account.lastResult = "win";

    account.wallet = clampMoney(account.wallet + finalReward);
    await this.incrementStats(account, {
      [`${options.domain}Runs`]: 1,
      [`${options.domain}Wins`]: 1,
    });
    await account.save();
    const newStreak = updateStreak(jid, options.domain, true);
    console.log(`[ECONOMY] ${options.domain} | user=${extract(jid)} | reward=${finalReward} | streak=${newStreak}`);

    return {
      ok: true,
      success: true,
      reward: finalReward,
      streak: newStreak,
      rareMeter: account.rareMeter,
      sessionCount,
      failStreak: 0,
      lastResult: "win",
      message: options.successMessage,
      account: this.toBalanceSummary(account, progression),
    };
  }

  async fish(jid) {
    return this.performGather(jid, {
      domain: "fish",
      stampKey: "lastFishAt",
      cooldownMs: constants.economy.fishCooldownMs,
      min: constants.economy.fishMin,
      max: constants.economy.fishMax,
      missRate: constants.economy.fishMissRate,
      successMessage: "You reeled in a profitable catch.",
      failMessage: "The fish got away this time.",
    });
  }

  async mine(jid) {
    return this.performGather(jid, {
      domain: "mine",
      stampKey: "lastMineAt",
      cooldownMs: constants.economy.mineCooldownMs,
      min: constants.economy.mineMin,
      max: constants.economy.mineMax,
      missRate: constants.economy.mineMissRate,
      successMessage: "You dug up a valuable haul.",
      failMessage: "Nothing useful came out of that shift.",
    });
  }

  async hunt(jid) {
    return this.performGather(jid, {
      domain: "hunt",
      stampKey: "lastHuntAt",
      cooldownMs: constants.economy.huntCooldownMs,
      min: constants.economy.huntMin,
      max: constants.economy.huntMax,
      missRate: constants.economy.huntMissRate,
      successMessage: "You returned with a strong hunting reward.",
      failMessage: "Your trail went cold and the hunt came up empty.",
    });
  }

  async farm(jid) {
    const account = await this.getAccount(jid);
    const progression = await this.getProgression(account);
    const existing = this.readPendingAction(account, "farm-crop");
    if (existing) {
      const dueAt = new Date(existing.dueAt).getTime();
      if (dueAt <= Date.now()) {
        return {
          ok: false,
          reason: "ready",
          readyAt: existing.dueAt,
          pending: existing,
          account: this.toBalanceSummary(account, progression),
        };
      }

      return {
        ok: false,
        reason: "growing",
        remainingMs: Math.max(0, dueAt - Date.now()),
        pending: existing,
        account: this.toBalanceSummary(account, progression),
      };
    }

    const reward = this.applyRewardMultiplier(
      randomBetween(constants.economy.farmMin, constants.economy.farmMax),
      progression,
      "farm",
    );
    const durationMs = this.adjustCooldown(
      constants.economy.farmCooldownMs,
      progression,
      "farm",
    );
    const pending = this.makePendingAction({
      key: "farm-crop",
      label: "Farm Plot",
      domain: "farm",
      dueAt: Date.now() + durationMs,
      data: { reward },
    });

    account.lastFarmAt = new Date();
    await this.upsertPendingAction(account, pending);
    await this.incrementStats(account, { farmRuns: 1 });
    await account.save();

    return {
      ok: true,
      reward,
      readyAt: pending.dueAt,
      message: "You planted a high-value crop. Come back with /collect later.",
      account: this.toBalanceSummary(account, progression),
    };
  }

  async invest(jid, amountInput) {
    const account = await this.getAccount(jid);
    const progression = await this.getProgression(account);
    const existing = this.readPendingAction(account, "investment");
    if (existing) {
      const dueAt = new Date(existing.dueAt).getTime();
      return {
        ok: false,
        reason: dueAt <= Date.now() ? "ready" : "pending",
        remainingMs: Math.max(0, dueAt - Date.now()),
        pending: existing,
        account: this.toBalanceSummary(account, progression),
      };
    }

    const amount = parseAmountInput(amountInput, account.wallet);
    if (amount < constants.economy.investMinAmount) {
      throw new Error(
        `Minimum investment is ${formatMoney(constants.economy.investMinAmount)}.`,
      );
    }

    const isLoss = Math.random() < constants.economy.investLossRate;
    const multiplier = this.getPayoutMultiplier(progression, "invest");
    let rawOutcome, payout, outcomeMessage;

    if (isLoss) {
      rawOutcome = Math.round(amount * 0.5);
      payout = 0;
      outcomeMessage = "Your investment performed poorly this cycle.";
    } else {
      rawOutcome = randomBetween(
        Math.round(amount * constants.economy.investMinMultiplier),
        Math.round(amount * constants.economy.investMaxMultiplier),
      );
      payout = this.applyPayoutMultiplier(rawOutcome, progression, "invest");
      outcomeMessage = "Your investment grew nicely.";
    }

    const durationMs = this.adjustCooldown(
      constants.economy.investDurationMs,
      progression,
      "invest",
    );
    const pending = this.makePendingAction({
      key: "investment",
      label: "Investment",
      domain: "invest",
      dueAt: Date.now() + durationMs,
      data: {
        principal: amount,
        payout,
        multiplier,
      },
    });

    account.wallet = clampMoney(account.wallet - amount);
    account.lastInvestAt = new Date();
    await this.upsertPendingAction(account, pending);
    await this.incrementStats(account, { investmentsMade: 1 });
    await account.save();

    return {
      ok: true,
      amount,
      expectedPayout: payout,
      readyAt: pending.dueAt,
      message: isLoss ? "Your investment didn't perform well this cycle. Use /collect to retrieve what's left." : "Your money is on the market. Use /collect when the position matures.",
      account: this.toBalanceSummary(account, progression),
    };
  }

  async collect(jid) {
    const account = await this.getAccount(jid);
    const progression = await this.getProgression(account);
    const adjustedCooldown = this.adjustCooldown(
      constants.economy.collectCooldownMs,
      progression,
      "collect",
    );
    const remainingMs = this.getRemainingCooldown(account.lastCollectAt, adjustedCooldown);
    if (remainingMs > 0) {
      return {
        ok: false,
        success: false,
        reason: "cooldown",
        remainingMs,
        account: this.toBalanceSummary(account, progression),
      };
    }

    const pending = this.parseActiveBuffs(account).filter((entry) => entry.type === "pending");
    const ready = pending.filter(
      (entry) => new Date(entry.dueAt).getTime() <= Date.now(),
    );

    if (!ready.length) {
      const next = pending
        .map((entry) => ({
          ...entry,
          remainingMs: Math.max(0, new Date(entry.dueAt).getTime() - Date.now()),
        }))
        .sort((left, right) => left.remainingMs - right.remainingMs)[0] || null;

      return {
        ok: false,
        reason: next ? "not-ready" : "empty",
        next,
        account: this.toBalanceSummary(account, progression),
      };
    }

    let total = 0;
    const rewards = [];
    for (const entry of ready) {
      const payout = clampMoney(entry?.data?.payout || entry?.data?.reward || 0);
      total += payout;
      rewards.push({
        key: entry.key,
        label: entry.label,
        amount: payout,
        principal: clampMoney(entry?.data?.principal || 0),
      });
    }

    account.wallet = clampMoney(account.wallet + total);
    account.lastCollectAt = new Date();
    await this.removePendingActions(
      account,
      ready.map((entry) => entry.key),
    );
    await this.incrementStats(account, { collections: 1 });
    await account.save();

    return {
      ok: true,
      total,
      rewards,
      account: this.toBalanceSummary(account, progression),
    };
  }

  async crime(jid) {
    const account = await this.getAccount(jid);
    const progression = await this.getProgression(account);
    const adjustedCooldown = this.adjustCooldown(
      constants.economy.crimeCooldownMs,
      progression,
      "crime",
    );
    const remainingMs = this.getRemainingCooldown(account.lastCrimeAt, adjustedCooldown);
    if (remainingMs > 0) {
      return {
        ok: false,
        success: false,
        reason: "cooldown",
        remainingMs,
        account: this.toBalanceSummary(account, progression),
      };
    }

    const successRate = Math.min(
      0.95,
      constants.economy.crimeSuccessRate + this.getSuccessBonus(progression, "crime"),
    );
    const success = Math.random() < successRate;
    const amount = this.applyRewardMultiplier(
      randomBetween(
        success
          ? constants.economy.crimeSuccessMin
          : constants.economy.crimeFailMin,
        success
          ? constants.economy.crimeSuccessMax
          : constants.economy.crimeFailMax,
      ),
      progression,
      "crime",
    );

    account.lastCrimeAt = new Date();
    if (success) {
      account.wallet = clampMoney(account.wallet + amount);
      await this.incrementStats(account, { crimesWon: 1 });
      console.log(`[ECONOMY] crime | user=${extract(jid)} | reward=${amount} | success=true`);
    } else {
      account.wallet = clampMoney(account.wallet - amount);
      await this.incrementStats(account, { crimesLost: 1 });
      console.log(`[ECONOMY] crime | user=${extract(jid)} | loss=${amount}`);
    }
    await account.save();

    return {
      ok: true,
      success,
      amount,
      message: success
        ? "Your shady move paid off."
        : "You got caught and paid the price.",
      account: this.toBalanceSummary(account, progression),
    };
  }

  async rob(fromJid, targetJid) {
    if (fromJid === targetJid) {
      throw new Error("You cannot rob yourself.");
    }

    const [thief, target] = await Promise.all([
      this.getAccount(fromJid),
      this.getAccount(targetJid),
    ]);
    const progression = await this.getProgression(thief);
    const adjustedCooldown = this.adjustCooldown(
      constants.economy.robCooldownMs,
      progression,
      "rob",
    );
    const remainingMs = this.getRemainingCooldown(thief.lastRobAt, adjustedCooldown);
    if (remainingMs > 0) {
      return {
        ok: false,
        reason: "cooldown",
        remainingMs,
        thief: this.toBalanceSummary(thief, progression),
        target: this.toBalanceSummary(target),
      };
    }

    if (clampMoney(target.wallet) < constants.economy.robMinTargetWallet) {
      return {
        ok: false,
        reason: "poor-target",
        thief: this.toBalanceSummary(thief, progression),
        target: this.toBalanceSummary(target),
      };
    }

    thief.lastRobAt = new Date();
    const success = Math.random() <
      Math.min(0.95, constants.economy.robSuccessRate + this.getSuccessBonus(progression, "rob"));

    if (success) {
      const amount = Math.min(
        clampMoney(target.wallet),
        this.applyRewardMultiplier(
          randomBetween(constants.economy.robMinSteal, constants.economy.robMaxSteal),
          progression,
          "rob",
        ),
      );
      thief.wallet = clampMoney(thief.wallet + amount);
      target.wallet = clampMoney(target.wallet - amount);
      await this.incrementStats(thief, { robsWon: 1 });
      await Promise.all([thief.save(), target.save()]);
      return {
        ok: true,
        success: true,
        amount,
        message: "You slipped away with someone else's cash.",
        thief: this.toBalanceSummary(thief, progression),
        target: this.toBalanceSummary(target),
      };
    }

    const penalty = this.applyRewardMultiplier(
      randomBetween(constants.economy.robFailMin, constants.economy.robFailMax),
      progression,
      "rob",
    );
    thief.wallet = clampMoney(thief.wallet - penalty);
    target.wallet = clampMoney(target.wallet + penalty);
    await this.incrementStats(thief, { robsLost: 1 });
    await Promise.all([thief.save(), target.save()]);
    return {
      ok: true,
      success: false,
      amount: penalty,
      message: "The robbery failed and you paid compensation.",
      thief: this.toBalanceSummary(thief, progression),
      target: this.toBalanceSummary(target),
    };
  }

  async heist(fromJid, targetJid) {
    if (fromJid === targetJid) {
      throw new Error("You cannot heist yourself.");
    }

    const [thief, target] = await Promise.all([
      this.getAccount(fromJid),
      this.getAccount(targetJid),
    ]);
    const progression = await this.getProgression(thief);
    const adjustedCooldown = this.adjustCooldown(
      constants.economy.heistCooldownMs,
      progression,
      "heist",
    );
    const remainingMs = this.getRemainingCooldown(thief.lastHeistAt, adjustedCooldown);
    if (remainingMs > 0) {
      return {
        ok: false,
        success: false,
        reason: "cooldown",
        remainingMs,
        thief: this.toBalanceSummary(thief, progression),
        target: this.toBalanceSummary(target),
      };
    }

    if (clampMoney(target.bank) < constants.economy.heistMinTargetBank) {
      return {
        ok: false,
        reason: "poor-target",
        thief: this.toBalanceSummary(thief, progression),
        target: this.toBalanceSummary(target),
      };
    }

    thief.lastHeistAt = new Date();
    const success = Math.random() <
      Math.min(
        0.92,
        constants.economy.heistSuccessRate + this.getSuccessBonus(progression, "heist"),
      );

    if (success) {
      const amount = Math.min(
        clampMoney(target.bank),
        this.applyRewardMultiplier(
          randomBetween(constants.economy.heistMinSteal, constants.economy.heistMaxSteal),
          progression,
          "heist",
        ),
      );
      thief.wallet = clampMoney(thief.wallet + amount);
      target.bank = clampMoney(target.bank - amount);
      await this.incrementStats(thief, { heistsWon: 1 });
      await Promise.all([thief.save(), target.save()]);
      return {
        ok: true,
        success: true,
        amount,
        message: "You cracked the vault and escaped with the payout.",
        thief: this.toBalanceSummary(thief, progression),
        target: this.toBalanceSummary(target),
      };
    }

    const penalty = this.applyRewardMultiplier(
      randomBetween(constants.economy.heistFailMin, constants.economy.heistFailMax),
      progression,
      "heist",
    );
    thief.wallet = clampMoney(thief.wallet - penalty);
    target.bank = clampMoney(target.bank + penalty);
    await this.incrementStats(thief, { heistsLost: 1 });
    await Promise.all([thief.save(), target.save()]);
    return {
      ok: true,
      success: false,
      amount: penalty,
      message: "Security locked you out and you paid a brutal penalty.",
      thief: this.toBalanceSummary(thief, progression),
      target: this.toBalanceSummary(target),
    };
  }

  async duel(fromJid, targetJid, betInput) {
    if (fromJid === targetJid) {
      throw new Error("You cannot duel yourself.");
    }

    const [challenger, target] = await Promise.all([
      this.getAccount(fromJid),
      this.getAccount(targetJid),
    ]);
    const progression = await this.getProgression(challenger);
    const adjustedCooldown = this.adjustCooldown(
      constants.economy.duelCooldownMs,
      progression,
      "duel",
    );
    const remainingMs = this.getRemainingCooldown(challenger.lastDuelAt, adjustedCooldown);
    if (remainingMs > 0) {
      return {
        ok: false,
        success: false,
        reason: "cooldown",
        remainingMs,
      };
    }

    const available = Math.min(challenger.wallet, target.wallet);
    const bet = parseBetInput(betInput, {
      minBet: constants.economy.duelMinBet,
      maxBet: constants.economy.duelMaxBet,
      available,
    });

    const challengerPower =
      randomBetween(35, 100) + Math.round(this.getSuccessBonus(progression, "duel") * 100);
    const targetPower = randomBetween(35, 100);
    challenger.lastDuelAt = new Date();

    if (challengerPower === targetPower) {
      await challenger.save();
      return {
        ok: true,
        draw: true,
        bet,
        challenger: this.toBalanceSummary(challenger, progression),
        target: this.toBalanceSummary(target),
      };
    }

    const challengerWins = challengerPower > targetPower;
    const winner = challengerWins ? challenger : target;
    const loser = challengerWins ? target : challenger;
    winner.wallet = clampMoney(winner.wallet + bet);
    loser.wallet = clampMoney(loser.wallet - bet);
    if (challengerWins) {
      await this.incrementStats(challenger, { duelsWon: 1 });
    } else {
      await this.incrementStats(challenger, { duelsLost: 1 });
    }
    await Promise.all([challenger.save(), target.save()]);

    return {
      ok: true,
      draw: false,
      winnerJid: challengerWins ? fromJid : targetJid,
      bet,
      challengerPower,
      targetPower,
      challenger: this.toBalanceSummary(challenger, progression),
      target: this.toBalanceSummary(target),
    };
  }

  async pay(fromJid, toJid, amountInput) {
    if (fromJid === toJid) {
      throw new Error("You cannot pay yourself.");
    }

    const [sender, receiver] = await Promise.all([
      this.getAccount(fromJid),
      this.getAccount(toJid),
    ]);
    const amount = parseAmountInput(amountInput, sender.wallet);
    sender.wallet = clampMoney(sender.wallet - amount);
    receiver.wallet = clampMoney(receiver.wallet + amount);
    await this.incrementStats(sender, { paymentsSent: 1 });
    await Promise.all([sender.save(), receiver.save()]);

    return {
      amount,
      sender: this.toBalanceSummary(sender),
      receiver: this.toBalanceSummary(receiver),
    };
  }

  async coinflip(jid, choice, betInput) {
    const normalized = String(choice || "").trim().toLowerCase();
    if (!["heads", "tails"].includes(normalized)) {
      throw new Error("Choose heads or tails.");
    }

    const account = await this.getAccount(jid);
    const progression = await this.getProgression(account);
    const bet = parseBetInput(betInput, {
      minBet: constants.economy.coinflipMinBet,
      maxBet: constants.economy.coinflipMaxBet,
      available: account.wallet,
    });
    const bias = this.getSuccessBonus(progression, "coinflip");
    const isHeads = Math.random() < Math.min(0.6, Math.max(0.4, 0.5 + bias));
    const result = isHeads ? "heads" : "tails";
    const win = normalized === result;
    const delta = bet;

    account.wallet = clampMoney(account.wallet + (win ? delta : -delta));
    await this.incrementStats(account, {
      coinflipPlayed: 1,
      [win ? "coinflipWon" : "coinflipLost"]: 1,
    });
    await account.save();

    return {
      win,
      choice: normalized,
      result,
      bet,
      delta,
      account: this.toBalanceSummary(account, progression),
    };
  }

  async dice(jid, betInput) {
    const account = await this.getAccount(jid);
    const progression = await this.getProgression(account);
    const bet = parseBetInput(betInput, {
      minBet: constants.economy.diceMinBet,
      maxBet: constants.economy.diceMaxBet,
      available: account.wallet,
    });

    const player = randomBetween(1, 6) + (this.getSuccessBonus(progression, "dice") > 0 ? 1 : 0);
    const house = randomBetween(1, 6);
    const resolvedPlayer = Math.min(6, player);
    let win = false;
    let draw = false;
    let delta = 0;

    if (resolvedPlayer === house) {
      draw = true;
    } else if (resolvedPlayer > house) {
      win = true;
      delta = bet;
    } else {
      delta = -bet;
    }

    account.wallet = clampMoney(account.wallet + delta);
    await this.incrementStats(account, {
      dicePlayed: 1,
      [draw ? "diceDraws" : win ? "diceWon" : "diceLost"]: 1,
    });
    await account.save();

    return {
      win,
      draw,
      bet,
      player: resolvedPlayer,
      house,
      delta,
      account: this.toBalanceSummary(account, progression),
    };
  }

  drawBlackjackHand() {
    const deck = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11];
    const drawCard = () => deck[randomBetween(0, deck.length - 1)];
    const total = (hand) => {
      let sum = hand.reduce((acc, value) => acc + value, 0);
      let aces = hand.filter((card) => card === 11).length;
      while (sum > 21 && aces > 0) {
        sum -= 10;
        aces -= 1;
      }
      return sum;
    };

    const player = [drawCard(), drawCard()];
    const dealer = [drawCard(), drawCard()];
    while (total(player) < 16) {
      player.push(drawCard());
    }
    while (total(dealer) < 17) {
      dealer.push(drawCard());
    }
    return {
      player,
      dealer,
      playerTotal: total(player),
      dealerTotal: total(dealer),
    };
  }

  async blackjack(jid, betInput) {
    const account = await this.getAccount(jid);
    const progression = await this.getProgression(account);
    const bet = parseBetInput(betInput, {
      minBet: constants.economy.blackjackMinBet,
      maxBet: constants.economy.blackjackMaxBet,
      available: account.wallet,
    });
    const hand = this.drawBlackjackHand();
    let outcome = "lose";
    let delta = -bet;

    const playerBust = hand.playerTotal > 21;
    const dealerBust = hand.dealerTotal > 21;
    if (playerBust && dealerBust) {
      outcome = "draw";
      delta = 0;
    } else if (!playerBust && (dealerBust || hand.playerTotal > hand.dealerTotal)) {
      outcome = "win";
      delta = clampMoney(Math.round(bet * 1.5));
    } else if (!playerBust && hand.playerTotal === hand.dealerTotal) {
      outcome = "draw";
      delta = 0;
    }

    account.wallet = clampMoney(account.wallet + delta);
    await this.incrementStats(account, {
      blackjackPlayed: 1,
      [outcome === "draw" ? "blackjackDraws" : outcome === "win" ? "blackjackWon" : "blackjackLost"]: 1,
    });
    await account.save();

    return {
      outcome,
      bet,
      delta,
      ...hand,
      account: this.toBalanceSummary(account, progression),
    };
  }

  async roulette(jid, betType, betInput) {
    const normalized = String(betType || "").trim().toLowerCase();
    if (!normalized) {
      throw new Error("Choose red, black, green, or a number from 0 to 12.");
    }

    const account = await this.getAccount(jid);
    const progression = await this.getProgression(account);
    const bet = parseBetInput(betInput, {
      minBet: constants.economy.rouletteMinBet,
      maxBet: constants.economy.rouletteMaxBet,
      available: account.wallet,
    });

    const spin = randomBetween(0, 12);
    const color = spin === 0 ? "green" : spin % 2 === 0 ? "black" : "red";
    const pickedNumber = Number.parseInt(normalized, 10);
    let win = false;
    let delta = -bet;

    if (Number.isInteger(pickedNumber) && String(pickedNumber) === normalized) {
      win = pickedNumber === spin;
      delta = win ? bet * 8 : -bet;
    } else if (["red", "black", "green"].includes(normalized)) {
      win = normalized === color;
      const multiplier = normalized === "green" ? 10 : 2;
      delta = win ? bet * multiplier : -bet;
    } else {
      throw new Error("Roulette bet must be red, black, green, or a number from 0 to 12.");
    }

    account.wallet = clampMoney(account.wallet + delta);
    await this.incrementStats(account, {
      roulettePlayed: 1,
      [win ? "rouletteWon" : "rouletteLost"]: 1,
    });
    await account.save();

    return {
      win,
      bet,
      spin,
      color,
      selection: normalized,
      delta: clampMoney(Math.abs(delta)),
      account: this.toBalanceSummary(account, progression),
    };
  }

  async rewardGame(jid, reward) {
    if (!reward?.cash) {
      return this.getBalance(jid);
    }

    return this.addWallet(jid, reward.cash);
  }

  getRewardLabel(reward) {
    if (!reward) {
      return "";
    }

    const xp = reward.xp ? `${reward.xp} XP` : "";
    const cash = reward.cash ? formatMoney(reward.cash) : "";
    return [xp, cash].filter(Boolean).join(" + ");
  }

  async getInventory(jid) {
    const account = await this.getAccount(jid);
    const progression = await this.getProgression(account);
    const items = this.getShopItems()
      .map((item) => ({
        ...item,
        quantity: clampMoney(progression.inventory[item.key]),
        equipped: account.equippedToolKey === item.key,
      }))
      .filter((item) => item.quantity > 0);

    return {
      account: this.toBalanceSummary(account, progression),
      items,
      activeBuffs: progression.activeBuffs.filter((entry) => entry.type === "buff"),
    };
  }

  async buy(jid, key, quantityInput = "1") {
    const item = this.getShopItem(key);
    if (!item) {
      throw new Error("Unknown shop item.");
    }

    const account = await this.getAccount(jid);
    const quantity = parseAmountInput(
      quantityInput,
      Math.floor(clampMoney(account.wallet) / item.price),
    );
    const totalPrice = item.price * quantity;
    const inventory = parseInventory(account.inventoryJson);
    inventory[item.key] = clampMoney(inventory[item.key]) + quantity;
    account.wallet = clampMoney(account.wallet - totalPrice);
    account.inventoryJson = stringifyInventory(inventory);
    await this.incrementStats(account, { itemsBought: quantity });
    await account.save();

    const progression = await this.getProgression(account);
    return {
      item,
      quantity,
      totalPrice,
      account: this.toBalanceSummary(account, progression),
      inventory: progression.inventory,
    };
  }

  async equip(jid, key) {
    const item = this.getShopItem(key);
    if (!item) {
      throw new Error("Unknown item.");
    }

    if (item.type !== "tool") {
      throw new Error("Only tool items can be equipped.");
    }

    const account = await this.getAccount(jid);
    const inventory = parseInventory(account.inventoryJson);
    if (clampMoney(inventory[item.key]) <= 0) {
      throw new Error("You do not own that tool yet.");
    }

    account.equippedToolKey = item.key;
    await account.save();
    const progression = await this.getProgression(account);
    return {
      item,
      account: this.toBalanceSummary(account, progression),
    };
  }

  async useItem(jid, key) {
    const item = this.getShopItem(key);
    if (!item) {
      throw new Error("Unknown item.");
    }

    if (item.type !== "consumable") {
      throw new Error("Only consumable items can be used.");
    }

    const account = await this.getAccount(jid);
    const inventory = parseInventory(account.inventoryJson);
    if (clampMoney(inventory[item.key]) <= 0) {
      throw new Error("You do not own that item.");
    }

    inventory[item.key] = clampMoney(inventory[item.key] - 1);
    const buffs = this.parseActiveBuffs(account).filter(
      (entry) => !(entry.type === "buff" && entry.key === item.key),
    );
    buffs.push(createBuffRecord(item));
    account.inventoryJson = stringifyInventory(inventory);
    account.activeBuffsJson = JSON.stringify(buffs);
    await this.incrementStats(account, { consumablesUsed: 1 });
    await account.save();

    const progression = await this.getProgression(account);
    return {
      item,
      account: this.toBalanceSummary(account, progression),
      activeBuffs: progression.activeBuffs.filter((entry) => entry.type === "buff"),
    };
  }

  async getJobsState(jid) {
    const account = await this.getAccount(jid);
    return {
      currentJob: this.getJob(account.jobKey),
      jobs: this.getJobs(),
    };
  }

  async setJob(jid, key) {
    const job = this.getJob(key);
    if (!job) {
      throw new Error("Unknown job key.");
    }

    const account = await this.getAccount(jid);
    account.jobKey = job.key;
    await account.save();
    return {
      job,
      account: this.toBalanceSummary(account),
    };
  }

  async joinFaction(jid, key) {
    const faction = await this.getFactionByKey(key);
    if (!faction) {
      throw new Error("Unknown faction key.");
    }

    const account = await this.getAccount(jid);
    if (account.factionKey === key) {
      throw new Error("You are already in that faction.");
    }

    if (account.factionKey) {
      throw new Error("Leave your current faction before joining another one.");
    }

    account.factionKey = key;
    account.factionJoinedAt = new Date();
    await Promise.all([
      account.save(),
      Faction.updateOne({ key }, { $inc: { memberCount: 1 } }),
    ]);

    return {
      faction: await this.getFactionByKey(key),
      account: this.toBalanceSummary(account),
    };
  }

  async leaveFaction(jid) {
    const account = await this.getAccount(jid);
    if (!account.factionKey) {
      throw new Error("You are not in a faction.");
    }

    const factionKey = account.factionKey;
    account.factionKey = "";
    account.factionJoinedAt = null;
    await Promise.all([
      account.save(),
      Faction.updateOne({ key: factionKey }, { $inc: { memberCount: -1 } }),
    ]);

    return {
      factionKey,
      account: this.toBalanceSummary(account),
    };
  }

  async getFactionInfo(key, jid = "") {
    const account = jid ? await this.getAccount(jid) : null;
    const effectiveKey = key || account?.factionKey || "";
    if (!effectiveKey) {
      throw new Error("No faction selected.");
    }

    const faction = await this.getFactionByKey(effectiveKey);
    if (!faction) {
      throw new Error("Unknown faction key.");
    }

    return faction;
  }

  async getFactionTop(limit = 10) {
    await this.ensureFactions();
    const rows = await Faction.find({})
      .sort({ treasury: -1, memberCount: -1, name: 1 })
      .limit(limit)
      .lean();

    return rows.map((row) => ({
      key: row.key,
      name: row.name,
      description: row.description,
      treasury: clampMoney(row.treasury),
      memberCount: clampMoney(row.memberCount),
      bonusProfile: row.bonusProfile || {},
    }));
  }

  async donateFaction(jid, amountInput) {
    const account = await this.getAccount(jid);
    if (!account.factionKey) {
      throw new Error("Join a faction before donating.");
    }

    const amount = parseAmountInput(amountInput, account.wallet);
    account.wallet = clampMoney(account.wallet - amount);
    await Promise.all([
      account.save(),
      Faction.updateOne({ key: account.factionKey }, { $inc: { treasury: amount } }),
    ]);

    return {
      amount,
      faction: await this.getFactionByKey(account.factionKey),
      account: this.toBalanceSummary(account),
    };
  }
}

module.exports = {
  EconomyService,
  formatMoney,
};
