const { extract } = require("../../utils/identity-resolver");

module.exports = {
  meta: {
    name: "removemod",
    aliases: ["removemod"],
    category: "general",
    description: "Remove a bot moderator",
    cooldownSeconds: 5,
    access: "staff",
    chat: "both",
    usage: "<user>",
  },
  async execute(ctx) {
    const { args, msg, services, config, reply } = ctx;
    
    let targetId = null;
    
    // Try to get target from reply
    if (msg?.quoted?.participant) {
      targetId = extract(msg.quoted.participant);
    }
    // Try to get target from mention
    else if (msg?.mentioned?.length > 0) {
      targetId = extract(msg.mentioned[0]);
    }
    // Try to get target from argument
    else if (args[0]) {
      targetId = extract(args[0]);
    }
    
    if (!targetId) {
      await reply("Usage: /removemod <reply to user> or /removemod @user or /removemod <number>");
      return;
    }
    
    // Check if actually a mod
    const isModInConfig = config.modIds.includes(targetId);
    const dbIdentity = await services.user.getIdentity(targetId);
    const isModInDb = dbIdentity?.role === "mod";
    
    if (!isModInConfig && !isModInDb) {
      await reply(`User ${targetId} is not a mod.`);
      return;
    }
    
    // Remove from runtime config
    const index = config.modIds.indexOf(targetId);
    if (index > -1) {
      config.modIds.splice(index, 1);
    }
    
    // Update database role to user
    if (isModInDb) {
      await services.user.updateIdentityRole(targetId, "user");
    }
    
    await reply(`✅ Removed ${targetId} from bot mods.`);
  },
};