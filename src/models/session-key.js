const mongoose = require("mongoose");

const sessionKeySchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    keyId: {
      type: String,
      required: true,
    },
    value: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    collection: "session_keys",
  },
);

sessionKeySchema.index(
  { sessionId: 1, category: 1, keyId: 1 },
  { unique: true },
);

module.exports = mongoose.model("SessionKey", sessionKeySchema);
