const axios = require("axios");

module.exports = {
  meta: {
    name: "ipinfo",
    aliases: ["ipa", "ipaddress"],
    category: "utils",
    description: "Get information about an IP address",
    cooldownSeconds: 10,
    access: "user",
    chat: "both",
    usage: "<ip address>",
  },
  async execute(ctx) {
    const { args, reply } = ctx;
    
    if (!args[0]) {
      await reply("Usage: /ipinfo <ip address>\nExample: /ipinfo 8.8.8.8");
      return;
    }
    
    const ip = args[0].trim();
    
    await reply(`🔍 Looking up: *${ip}*`);
    
    try {
      const response = await axios.get(
        `http://ip-api.com/json/${encodeURIComponent(ip)}`,
        { timeout: 15000 }
      );
      
      if (response.data?.status === "fail") {
        await reply("❌ Invalid IP address or query");
        return;
      }
      
      const data = response.data;
      const info = [
        `📍 *IP Info: ${data.query}*`,
        "",
        `🌍 *Country:* ${data.country} (${data.countryCode})`,
        `📍 *Region:* ${data.regionName}`,
        `🏙️ *City:* ${data.city}`,
        `🕐 *Timezone:* ${data.timezone}`,
        `📡 *ISP:* ${data.isp}`,
        `🏢 *Org:* ${data.org || "N/A"}`,
        `🔗 *AS:* ${data.as || "N/A"}`
      ];
      
      await reply(info.join("\n"));
      
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  },
};