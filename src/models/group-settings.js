const mongoose = require("mongoose");

const groupSettingsSchema = new mongoose.Schema(
  {
    groupJid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    welcomeEnabled: {
      type: Boolean,
      default: false,
    },
    antiInviteEnabled: {
      type: Boolean,
      default: false,
    },
    welcomeTemplate: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("GroupSetting", groupSettingsSchema);
