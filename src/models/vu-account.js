const mongoose = require("mongoose");

const vuAccountSchema = new mongoose.Schema(
  {
    userJid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      default: "",
    },
    encryptedPassword: {
      type: String,
      default: "",
    },
    alertsMode: {
      type: String,
      enum: ["off", "daily", "deadline", "all"],
      default: "off",
    },
    dailyDigestEnabled: {
      type: Boolean,
      default: false,
    },
    deadlineReminderMinutesJson: {
      type: String,
      default: "[]",
    },
    assignmentsJson: {
      type: String,
      default: "[]",
    },
    calendarJson: {
      type: String,
      default: "[]",
    },
    lastSyncAt: {
      type: Date,
      default: null,
    },
    lastDigestOn: {
      type: String,
      default: "",
    },
    notifiedKeysJson: {
      type: String,
      default: "[]",
    },
    lastError: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    collection: "bot_vu_accounts",
  },
);

module.exports = mongoose.model("VuAccount", vuAccountSchema);
