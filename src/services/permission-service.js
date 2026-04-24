function createPermissionService(config) {
  function isOwner(jid) {
    return config.ownerJids.includes(jid);
  }

  function getPermissionContext(message, metadata, botJid) {
    const participants = metadata?.participants || [];
    const adminJids = participants
      .filter((participant) => participant.admin)
      .map((participant) => participant.id);

    return {
      isOwner: isOwner(message.sender),
      isAdmin: adminJids.includes(message.sender),
      isBotAdmin: botJid ? adminJids.includes(botJid) : false,
      adminJids,
    };
  }

  function hasAccess(access, context) {
    if (access === "owner") {
      return context.isOwner;
    }

    if (access === "admin") {
      return context.isOwner || context.isAdmin;
    }

    return true;
  }

  function chatAllowed(chat, message) {
    if (chat === "group") {
      return message.isGroup;
    }

    if (chat === "private") {
      return !message.isGroup;
    }

    return true;
  }

  return {
    chatAllowed,
    getPermissionContext,
    hasAccess,
    isOwner,
  };
}

module.exports = {
  createPermissionService,
};
