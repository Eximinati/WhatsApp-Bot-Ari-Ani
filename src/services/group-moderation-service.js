class GroupModerationService {
  constructor({ settings }) {
    this.settings = settings;
  }

  async enforce(sock, message, permission) {
    if (!message.isGroup) {
      return { handled: false };
    }

    const groupSettings = await this.settings.getGroupSettings(message.from);
    if (
      groupSettings.antiInviteEnabled &&
      /chat\.whatsapp\.com\//i.test(message.text) &&
      !permission.isOwner &&
      !permission.isAdmin &&
      permission.isBotAdmin
    ) {
      await sock.groupParticipantsUpdate(message.from, [message.sender], "remove");
      await message.reply("Invite links are not allowed here.");
      return { handled: true };
    }

    return { handled: false, groupSettings };
  }
}

module.exports = {
  GroupModerationService,
};
