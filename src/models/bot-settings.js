const mongoose = require("mongoose");

const botSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "global",
    },
    chatMode: {
      type: String,
      enum: ["all", "private"],
      default: "all",
    },
  },
  {
    timestamps: true,
    collection: "bot_settings",
  },
);

module.exports = mongoose.model("BotSetting", botSettingsSchema);
