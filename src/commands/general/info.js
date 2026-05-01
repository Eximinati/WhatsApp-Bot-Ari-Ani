const User = require("../../models/user");
const UserIdentity = require("../../models/user-identity");
const Note = require("../../models/note");
const Reminder = require("../../models/reminder");

module.exports = {
  meta: {
    name: "info",
    aliases: ["status"],
    category: "general",
    description: "Show bot statistics and runtime information",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const { services, config } = ctx;
    
    // Calculate uptime
    const uptimeSeconds = process.uptime();
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);
    
    const uptimeStr = days > 0 
      ? `${days}d ${hours}h ${minutes}m`
      : hours > 0 
        ? `${hours}h ${minutes}m ${seconds}s`
        : `${minutes}m ${seconds}s`;
    
    // Get command count
    const commandCount = services.commands?.commands?.size || 0;
    const aliasCount = services.commands?.aliases?.size || 0;
    
    // Get connection status
    const runtimeState = services.whatsappSessionHealth?.runtimeState || {};
    const connectionStatus = runtimeState.connectionStatus || "unknown";
    
    // Memory usage
    const memUsage = process.memoryUsage();
    const formatBytes = (bytes) => {
      const mb = bytes / 1024 / 1024;
      return `${mb.toFixed(1)} MB`;
    };
    
    // Get database stats
    let userCount = 0;
    let identityCount = 0;
    let noteCount = 0;
    let reminderCount = 0;
    
    try {
      userCount = await User.countDocuments({});
      identityCount = await UserIdentity.countDocuments({});
      noteCount = await Note.countDocuments({});
      reminderCount = await Reminder.countDocuments({});
    } catch (e) {
      // Database might not be ready
    }
    
    // Get mod/owner count from database
    const ownerCount = config.ownerIds.length;
    const modCount = config.modIds?.length || 0;
    
    // Format the info message
    const lines = [
      `*📊 ${config.botName} - System Info*`,
      "",
      `*┌─ Runtime*`,
      `│ ⏱️  Uptime: ${uptimeStr}`,
      `│ 📅 Started: ${runtimeState.startedAt ? new Date(runtimeState.startedAt).toLocaleString() : "N/A"}`,
      `│ 🔗 Connection: ${connectionStatus}`,
      "",
      `*┌─ Commands*`,
      `│ 📚 Total: ${commandCount}`,
      `│ 🔄 Aliases: ${aliasCount}`,
      `│ 👤 Prefix: ${config.prefix}`,
      "",
      `*┌─ Users*`,
      `│ 👥 Known Users: ${userCount}`,
      `│ 🆔 Identities: ${identityCount}`,
      `│ 👑 Owners: ${ownerCount}`,
      `│ ⚡ Mods: ${modCount}`,
      "",
      `*┌─ Data*`,
      `│ 📝 Notes: ${noteCount}`,
      `│ ⏰ Reminders: ${reminderCount}`,
      "",
      `*┌─ System*`,
      `│ 🖥️  Platform: ${config.platform}`,
      `│ 🌍 OS: ${process.platform}`,
      `│ 📦 Node.js: ${process.version}`,
      `│ 💾 Memory: ${formatBytes(memUsage.rss)} / ${formatBytes(memUsage.heapTotal)}`,
      `│ 🔒 Private: ${config.privateBot ? "Yes" : "No"}`,
      `│ 🌐 Mode: ${config.nodeEnv}`,
      `│ 🕐 Timezone: ${config.timezone}`,
    ];
    
    await ctx.reply(lines.join("\n"));
  },
};