const fs = require("fs/promises");
const path = require("path");
const BotSetting = require("../models/bot-settings");
const GroupSetting = require("../models/group-settings");
const UserSetting = require("../models/user-settings");
const constants = require("../config/constants");
const { extract } = require("../utils/identity-resolver");

class SettingsService {
  constructor({ logger, rootDir }) {
    this.logger = logger;
    this.rootDir = rootDir;
  }

  async getGroupSettings(groupJid) {
    return GroupSetting.findOneAndUpdate(
      { groupJid },
      { $setOnInsert: { groupJid } },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  async updateGroupSettings(groupJid, patch) {
    return GroupSetting.findOneAndUpdate(
      { groupJid },
      { $set: patch },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  async getBotSettings() {
    return BotSetting.findOneAndUpdate(
      { key: "global" },
      { $setOnInsert: { key: "global" } },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  async updateBotSettings(patch) {
    return BotSetting.findOneAndUpdate(
      { key: "global" },
      { $set: patch, $setOnInsert: { key: "global" } },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  async setBotChatMode(chatMode) {
    if (!["all", "private"].includes(chatMode)) {
      throw new Error(`Unsupported bot chat mode: ${chatMode}`);
    }

    return this.updateBotSettings({ chatMode });
  }

  _norm(jid) {
    return extract(jid);
  }

  async getUserSettings(jid) {
    const id = this._norm(jid);
    return UserSetting.findOneAndUpdate(
      { jid: id },
      { $setOnInsert: { jid: id } },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  async updateUserSettings(jid, patch) {
    const id = this._norm(jid);
    return UserSetting.findOneAndUpdate(
      { jid: id },
      { $set: patch },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  async banUser(jid, banned) {
    return this.updateUserSettings(jid, { banned });
  }

  async setAccessState(jid, accessState, grantedBy) {
    if (!["none", "allowed", "trusted"].includes(accessState)) {
      throw new Error(`Unsupported access state: ${accessState}`);
    }

    if (accessState === "none") {
      return this.updateUserSettings(jid, {
        accessState: "none",
        accessGrantedBy: "",
        accessGrantedAt: null,
      });
    }

    return this.updateUserSettings(jid, {
      accessState,
      accessGrantedBy: grantedBy,
      accessGrantedAt: new Date(),
    });
  }

  async listAccessUsers() {
    return UserSetting.find({
      accessState: { $in: ["allowed", "trusted"] },
    })
      .sort({ accessState: 1, updatedAt: -1 })
      .lean();
  }

  async setTimezone(jid, timezone) {
    return this.updateUserSettings(jid, { timezone });
  }

  async importLegacyData() {
    const legacyFile = path.join(this.rootDir, "db.json");

    try {
      await fs.access(legacyFile);
    } catch {
      return { imported: false, reason: "missing" };
    }

    const raw = await fs.readFile(legacyFile, "utf8");
    if (!raw.trim()) {
      return { imported: false, reason: "empty" };
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      this.logger.warn({ error }, "Skipping legacy db import due to invalid JSON");
      return { imported: false, reason: "invalid-json" };
    }

    const bannedUsers = Array.isArray(data.ban) ? data.ban : [];
    const enabledWelcomeGroups = Array.isArray(data.events) ? data.events : [];
    const customWelcomeMsgs = data.customWelcomeMsgs || {};
    const report = {
      imported: {
        bans: 0,
        welcomeGroups: 0,
        customWelcomeMsgs: 0,
      },
      ignoredLegacyKeys: Object.keys(data).filter(
        (key) => !["ban", "events", "customWelcomeMsgs"].includes(key),
      ),
    };

    for (const jid of bannedUsers) {
      await this.banUser(jid, true);
      report.imported.bans += 1;
    }

    for (const groupJid of enabledWelcomeGroups) {
      await this.updateGroupSettings(groupJid, { welcomeEnabled: true });
      report.imported.welcomeGroups += 1;
    }

    for (const [groupJid, welcomeTemplate] of Object.entries(customWelcomeMsgs)) {
      await this.updateGroupSettings(groupJid, {
        welcomeEnabled: true,
        welcomeTemplate: welcomeTemplate || constants.groups.welcomeTemplate,
      });
      report.imported.customWelcomeMsgs += 1;
    }

    this.logger.info?.(report, "Legacy settings import completed");
    return { imported: true, report };
  }
}

module.exports = {
  SettingsService,
};
