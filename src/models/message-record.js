const mongoose = require("mongoose");

const messageRecordSchema = new mongoose.Schema(
  {
    storeKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    remoteJid: {
      type: String,
      required: true,
      index: true,
    },
    participant: {
      type: String,
      default: "",
      index: true,
    },
    messageId: {
      type: String,
      required: true,
      index: true,
    },
    fromMe: {
      type: Boolean,
      default: false,
    },
    pushName: {
      type: String,
      default: "",
    },
    messageType: {
      type: String,
      default: "",
    },
    rawJson: {
      type: String,
      default: "",
    },
    timestamp: {
      type: Number,
      default: 0,
    },
    isStatus: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    lastUpdateJson: {
      type: String,
      default: "",
    },
    reactionsJson: {
      type: String,
      default: "",
    },
    receiptsJson: {
      type: String,
      default: "",
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    commandProcessedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "bot_messages",
  },
);

module.exports = mongoose.model("MessageRecord", messageRecordSchema);
