const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema(
  {
    userJid: {
      type: String,
      required: true,
      index: true,
    },
    chatJid: {
      type: String,
      required: true,
    },
    delivery: {
      type: String,
      enum: ["dm", "here"],
      default: "dm",
    },
    text: {
      type: String,
      required: true,
    },
    triggerAt: {
      type: Date,
      required: true,
      index: true,
    },
    timezone: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "sent", "cancelled"],
      default: "pending",
      index: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    collection: "bot_reminders",
  },
);

reminderSchema.index({ status: 1, triggerAt: 1 });

module.exports = mongoose.model("Reminder", reminderSchema);
