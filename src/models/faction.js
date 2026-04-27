const mongoose = require("mongoose");

const factionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    treasury: {
      type: Number,
      default: 0,
      min: 0,
    },
    memberCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    bonusProfile: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "bot_factions",
  },
);

module.exports = mongoose.model("Faction", factionSchema);
