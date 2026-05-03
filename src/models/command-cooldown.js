const mongoose = require("mongoose");

const commandCooldownSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    jid: {
      type: String,
      required: true,
      index: true,
    },
    command: {
      type: String,
      required: true,
      index: true,
    },
    lastUsedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "command_cooldowns",
  },
);

module.exports = mongoose.model("CommandCooldown", commandCooldownSchema);
