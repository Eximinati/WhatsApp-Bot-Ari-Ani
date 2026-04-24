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
    preferredRole: {
      type: String,
      default: "",
    },
    dailyClaimedAt: {
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
  },
  {
    timestamps: true,
    collection: "bot_user_settings",
  },
);

module.exports = mongoose.model("UserSetting", userSettingsSchema);
