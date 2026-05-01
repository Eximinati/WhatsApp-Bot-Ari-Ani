const { extract } = require("../utils/identity-resolver");

function createPermissionService(config, userService = null) {
  async function isOwnerAsync(jid) {
    const id = extract(jid);
    if (config.ownerIds.includes(id)) return true;
    
    // Check database for owner role
    if (userService) {
      const identity = await userService.getIdentity(id);
      if (identity?.role === "owner") return true;
    }
    return false;
  }

  async function isModAsync(jid) {
    const id = extract(jid);
    if ((config.modIds || []).includes(id)) return true;
    
    // Check database for mod/owner role
    if (userService) {
      const identity = await userService.getIdentity(id);
      if (identity?.role === "mod" || identity?.role === "owner") return true;
    }
    return false;
  }

  // Sync versions for backward compatibility
  function isOwner(jid) {
    const id = extract(jid);
    return config.ownerIds.includes(id);
  }

  function isMod(jid) {
    const id = extract(jid);
    return (config.modIds || []).includes(id);
  }

  async function getPermissionContext(message, metadata, botJid, userSettings = null) {
    const participants = metadata?.participants || [];
    const adminJids = participants
      .filter((participant) => participant.admin)
      .map((participant) => participant.id);
    const accessState = userSettings?.accessState || "none";
    const senderId = message.senderId;
    const owner = await isOwnerAsync(senderId);
    const mod = await isModAsync(senderId);

    return {
      accessState,
      isAllowed: accessState === "allowed",
      isTrusted: accessState === "trusted",
      isOwner: owner,
      isMod: mod,
      isStaff: owner || mod,
      isAdmin: adminJids.some((jid) => extract(jid) === senderId),
      isBotAdmin: botJid ? adminJids.some((jid) => extract(jid) === extract(botJid)) : false,
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

  function botChatAllowed(chatMode, message) {
    if (chatMode === "private") {
      return !message.isGroup;
    }

    return true;
  }

  return {
    botChatAllowed,
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
