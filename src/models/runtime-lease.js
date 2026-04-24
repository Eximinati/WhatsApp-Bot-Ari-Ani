const mongoose = require("mongoose");

const runtimeLeaseSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    ownerId: {
      type: String,
      required: true,
      index: true,
    },
    ownerLabel: {
      type: String,
      default: "",
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "bot_runtime_leases",
  },
);

module.exports = mongoose.model("RuntimeLease", runtimeLeaseSchema);
