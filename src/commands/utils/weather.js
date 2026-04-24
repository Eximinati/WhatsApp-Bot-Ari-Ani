module.exports = {
  meta: {
    name: "weather",
    aliases: ["forecast"],
    category: "utils",
    description: "Get the current weather for a city using WeatherAPI.",
    cooldownSeconds: 10,
    access: "user",
    chat: "both",
    usage: "<city>",
  },
  async execute(ctx) {
    if (!ctx.text) {
      await ctx.reply("Provide a city or location to search.");
      return;
    }

    if (!ctx.services.external.weather.isConfigured()) {
      await ctx.reply("Weather support is disabled until WEATHER_API_KEY is configured.");
      return;
    }

    const report = await ctx.services.external.weather.current(ctx.text);
    await ctx.reply(
      [
        `*Weather for ${report.location.name}, ${report.location.country}*`,
        `Condition: ${report.current.condition.text}`,
        `Temperature: ${report.current.temp_c} C`,
        `Feels like: ${report.current.feelslike_c} C`,
        `Humidity: ${report.current.humidity}%`,
        `Wind: ${report.current.wind_kph} km/h ${report.current.wind_dir}`,
      ].join("\n"),
    );
  },
};
