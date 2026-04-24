const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      enum: ["personal", "group"],
      required: true,
      index: true,
    },
    ownerJid: {
      type: String,
      default: "",
      index: true,
    },
    groupJid: {
      type: String,
      default: "",
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    createdBy: {
      type: String,
      default: "",
    },
    updatedBy: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    collection: "bot_notes",
  },
);

noteSchema.index(
  { scope: 1, ownerJid: 1, groupJid: 1, name: 1 },
  { unique: true },
);

module.exports = mongoose.model("Note", noteSchema);
