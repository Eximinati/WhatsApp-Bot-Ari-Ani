const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    jid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    displayName: {
      type: String,
      default: "",
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "bot_users",
  },
);

module.exports = mongoose.model("User", userSchema);
