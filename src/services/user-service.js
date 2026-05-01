const User = require("../models/user");
const UserIdentity = require("../models/user-identity");
const { extract } = require("../utils/identity-resolver");

class UserService {
  async upsertIdentity({ id, phone, role = "user" }) {
    if (!id || !id.trim() || id === "status" || id === "null" || id === "undefined") {
      return null;
    }

    return UserIdentity.findOneAndUpdate(
      { id },
      {
        $set: {
          phone: phone || undefined,
          role,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          id,
          createdAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  async getIdentity(id) {
    if (!id) return null;
    return UserIdentity.findOne({ id }).lean();
  }

  async updateIdentityRole(id, role) {
    if (!id || !["user", "mod", "owner"].includes(role)) return null;
    return UserIdentity.findOneAndUpdate(
      { id },
      { $set: { role, updatedAt: new Date() } },
      { new: true },
    );
  }

  async upsertContacts(contacts) {
    for (const contact of contacts || []) {
      await this.upsertContact(contact.id, contact.notify || contact.name);
    }
  }

  async upsertContact(jid, displayName) {
    if (!jid) {
      return null;
    }

    const id = extract(jid);
    return User.findOneAndUpdate(
      { jid: id },
      {
        $set: {
          displayName: displayName || "",
          lastSeenAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  async touchFromMessage(message) {
    return this.upsertContact(message.senderId, message.pushName);
  }

  async getDisplayName(jid) {
    const id = extract(jid);
    const record = await User.findOne({ jid: id }).lean();
    if (record?.displayName) {
      return record.displayName;
    }

    return id || "user";
  }
}

module.exports = {
  UserService,
};
