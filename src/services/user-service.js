const User = require("../models/user");

class UserService {
  async upsertContacts(contacts) {
    for (const contact of contacts || []) {
      await this.upsertContact(contact.id, contact.notify || contact.name);
    }
  }

  async upsertContact(jid, displayName) {
    if (!jid) {
      return null;
    }

    return User.findOneAndUpdate(
      { jid },
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
    return this.upsertContact(message.sender, message.pushName);
  }

  async getDisplayName(jid) {
    const record = await User.findOne({ jid }).lean();
    if (record?.displayName) {
      return record.displayName;
    }

    return jid?.split("@")[0] || "user";
  }
}

module.exports = {
  UserService,
};
