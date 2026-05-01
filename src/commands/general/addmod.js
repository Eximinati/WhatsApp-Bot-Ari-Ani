const { extract } = require("../../utils/identity-resolver");

module.exports = {
  meta: {
    name: "addmod",
    aliases: ["addmod"],
    category: "general",
    description: "Add a user as bot moderator",
    cooldownSeconds: 5,
    access: "staff",
    chat: "both",
    usage: "<user>",
  },
  async execute(ctx) {
    const { args, msg, services, config, reply } = ctx;
    
    let targetId = null;
    
    // Try to get target from argument first
    if (args[0]) {
      targetId = extract(args[0]);
    }
    // Try to get target from reply
    else if (msg?.quoted?.participant) {
      targetId = extract(msg.quoted.participant);
    }
    // Try to get target from mentions (correct property name: mentions)
    else if (msg?.mentions && msg.mentions.length > 0) {
      targetId = extract(msg.mentions[0]);
    }
    
    if (!targetId) {
      await reply("Usage: /addmod <number> or /addmod @user or reply to user");
      return;
    }
    
    // Check if already a mod
    const isAlreadyMod = config.modIds.includes(targetId);
    const dbIdentity = await services.user.getIdentity(targetId);
    const isModInDb = dbIdentity?.role === "mod" || dbIdentity?.role === "owner";
    
    if (isAlreadyMod || isModInDb) {
      await reply(`User ${targetId} is already a mod.`);
      return;
    }
    
    // Add to runtime config (temporary until restart)
    if (!config.modIds.includes(targetId)) {
      config.modIds.push(targetId);
    }
    
    // Add to database (persistent)
    await services.user.upsertIdentity({
      id: targetId,
      phone: null,
      role: "mod",
    });
    
    await reply(`✅ Added ${targetId} as bot mod.`);
  },
};