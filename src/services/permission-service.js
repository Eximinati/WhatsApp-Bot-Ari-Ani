function createPermissionService(config) {
  function isOwner(jid) {
    return config.ownerJids.includes(jid);
  }

  function isMod(jid) {
    return (config.modJids || []).includes(jid);
  }

  function getPermissionContext(message, metadata, botJid, userSettings = null) {
    const participants = metadata?.participants || [];
    const adminJids = participants
      .filter((participant) => participant.admin)
      .map((participant) => participant.id);
    const accessState = userSettings?.accessState || "none";
    const owner = isOwner(message.sender);
    const mod = isMod(message.sender);

    return {
      accessState,
      isAllowed: accessState === "allowed",
      isTrusted: accessState === "trusted",
      isOwner: owner,
      isMod: mod,
      isStaff: owner || mod,
      isAdmin: adminJids.includes(message.sender),
      isBotAdmin: botJid ? adminJids.includes(botJid) : false,
      adminJids,
    };
  }

  function hasAccess(access, context) {
    if (access === "owner") {
      return context.isOwner;
    }

    if (access === "staff") {
      return context.isStaff;
    }

    if (access === "admin") {
      return context.isStaff || context.isAdmin;
    }

    if (access === "trusted") {
      return context.isStaff || context.isTrusted;
    }

    return true;
  }

  function canUseBot(context) {
    if (!config.privateBot) {
      return true;
    }

    return context.isStaff || context.isAllowed || context.isTrusted;
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
    canUseBot,
    getPermissionContext,
    hasAccess,
    isMod,
    isOwner,
  };
}

module.exports = {
  createPermissionService,
};
