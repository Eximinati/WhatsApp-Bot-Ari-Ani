const mongoose = require("mongoose");

const userIdentitySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      description: "LID (primary identity)",
    },
    phone: {
      type: String,
      index: true,
      description: "Optional phone number",
    },
    role: {
      type: String,
      enum: ["user", "mod", "owner"],
      default: "user",
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "bot_user_identities",
  },
);

module.exports = mongoose.model("UserIdentity", userIdentitySchema);
