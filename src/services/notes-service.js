const Note = require("../models/note");

class NotesService {
  normalizeName(name) {
    return String(name || "").trim().toLowerCase();
  }

  async savePersonal(ownerJid, name, content) {
    return Note.findOneAndUpdate(
      {
        scope: "personal",
        ownerJid,
        groupJid: "",
        name: this.normalizeName(name),
      },
      {
        $set: {
          content,
          updatedBy: ownerJid,
        },
        $setOnInsert: {
          scope: "personal",
          ownerJid,
          groupJid: "",
          name: this.normalizeName(name),
          createdBy: ownerJid,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  }

  async saveGroup(groupJid, actorJid, name, content) {
    return Note.findOneAndUpdate(
      {
        scope: "group",
        ownerJid: "",
        groupJid,
        name: this.normalizeName(name),
      },
      {
        $set: {
          content,
          updatedBy: actorJid,
        },
        $setOnInsert: {
          scope: "group",
          ownerJid: "",
          groupJid,
          name: this.normalizeName(name),
          createdBy: actorJid,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  }

  async getPersonal(ownerJid, name) {
    return Note.findOne({
      scope: "personal",
      ownerJid,
      groupJid: "",
      name: this.normalizeName(name),
    }).lean();
  }

  async getGroup(groupJid, name) {
    return Note.findOne({
      scope: "group",
      ownerJid: "",
      groupJid,
      name: this.normalizeName(name),
    }).lean();
  }

  async listPersonal(ownerJid) {
    return Note.find({
      scope: "personal",
      ownerJid,
      groupJid: "",
    })
      .sort({ name: 1 })
      .lean();
  }

  async listGroup(groupJid) {
    return Note.find({
      scope: "group",
      ownerJid: "",
      groupJid,
    })
      .sort({ name: 1 })
      .lean();
  }

  async deletePersonal(ownerJid, name) {
    return Note.deleteOne({
      scope: "personal",
      ownerJid,
      groupJid: "",
      name: this.normalizeName(name),
    });
  }

  async deleteGroup(groupJid, name) {
    return Note.deleteOne({
      scope: "group",
      ownerJid: "",
      groupJid,
      name: this.normalizeName(name),
    });
  }
}

module.exports = {
  NotesService,
};
