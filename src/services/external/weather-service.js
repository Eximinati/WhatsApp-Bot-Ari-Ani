const axios = require("axios");

class WeatherService {
  constructor({ apiKey }) {
    this.apiKey = apiKey;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async current(query) {
    if (!this.isConfigured()) {
      throw new Error("Weather API is not configured.");
    }

    const { data } = await axios.get("https://api.weatherapi.com/v1/current.json", {
      params: {
        key: this.apiKey,
        q: query,
        aqi: "no",
      },
      timeout: 15_000,
    });

    return data;
  }
}

module.exports = {
  WeatherService,
};
