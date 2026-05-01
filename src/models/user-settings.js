const mongoose = require("mongoose");

const userSettingsSchema = new mongoose.Schema(
  {
    jid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    banned: {
      type: Boolean,
      default: false,
    },
    xp: {
      type: Number,
      default: 0,
      min: 0,
    },
    level: {
      type: Number,
      default: 0,
      min: 0,
    },
    bio: {
      type: String,
      default: "",
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    wallet: {
      type: Number,
      default: 0,
      min: 0,
    },
    bank: {
      type: Number,
      default: 0,
      min: 0,
    },
    jobKey: {
      type: String,
      default: "",
    },
    factionKey: {
      type: String,
      default: "",
    },
    factionJoinedAt: {
      type: Date,
      default: null,
    },
    accessState: {
      type: String,
      enum: ["none", "allowed", "trusted"],
      default: "none",
      index: true,
    },
    accessGrantedBy: {
      type: String,
      default: "",
    },
    accessGrantedAt: {
      type: Date,
      default: null,
    },
    timezone: {
      type: String,
      default: "",
    },
    islamicLanguageMode: {
      type: String,
      enum: ["tri", "ar-en", "ar-ur"],
      default: "tri",
    },
    prayerCity: {
      type: String,
      default: "",
    },
    prayerCountry: {
      type: String,
      default: "",
    },
    prayerLatitude: {
      type: Number,
      default: null,
    },
    prayerLongitude: {
      type: Number,
      default: null,
    },
    prayerMethod: {
      type: String,
      default: "Karachi",
    },
    preferredRole: {
      type: String,
      default: "",
    },
    dailyClaimedAt: {
      type: Date,
      default: null,
    },
    lastDailyMoneyAt: {
      type: Date,
      default: null,
    },
    lastWorkAt: {
      type: Date,
      default: null,
    },
    lastCrimeAt: {
      type: Date,
      default: null,
    },
    lastRobAt: {
      type: Date,
      default: null,
    },
    lastBegAt: {
      type: Date,
      default: null,
    },
    lastFishAt: {
      type: Date,
      default: null,
    },
    lastMineAt: {
      type: Date,
      default: null,
    },
    lastHuntAt: {
      type: Date,
      default: null,
    },
    lastFarmAt: {
      type: Date,
      default: null,
    },
    lastInvestAt: {
      type: Date,
      default: null,
    },
    lastCollectAt: {
      type: Date,
      default: null,
    },
    lastDuelAt: {
      type: Date,
      default: null,
    },
    lastHeistAt: {
      type: Date,
      default: null,
    },
    streakCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastStreakAt: {
      type: Date,
      default: null,
    },
    lastXpAwardedAt: {
      type: Date,
      default: null,
    },
    vuAlertMode: {
      type: String,
      enum: ["off", "daily", "deadline", "all"],
      default: "off",
    },
    vuMenuStateJson: {
      type: String,
      default: "",
    },
    mediaMenuStateJson: {
      type: String,
      default: "",
    },
    mediaPreferencesJson: {
      type: String,
      default: "",
    },
    equippedToolKey: {
      type: String,
      default: "",
    },
    inventoryJson: {
      type: String,
      default: "",
    },
activeBuffsJson: {
      type: String,
      default: "",
    },
    statsJson: {
      type: String,
      default: JSON.stringify({ luck: 1, strength: 1, intelligence: 1, defense: 1 }),
    },
    statPoints: {
      type: Number,
      default: 0,
    },
    economyStatsJson: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    collection: "bot_user_settings",
  },
);

module.exports = mongoose.model("UserSetting", userSettingsSchema);
