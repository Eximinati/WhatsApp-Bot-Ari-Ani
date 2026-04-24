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
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("UserSetting", userSettingsSchema);
