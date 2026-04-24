const axios = require("axios");

class GoogleSearchService {
  constructor({ apiKey, searchEngineId }) {
    this.apiKey = apiKey;
    this.searchEngineId = searchEngineId;
  }

  isConfigured() {
    return Boolean(this.apiKey && this.searchEngineId);
  }

  async search(query) {
    if (!this.isConfigured()) {
      throw new Error("Google search is not configured.");
    }

    const { data } = await axios.get("https://www.googleapis.com/customsearch/v1", {
      params: {
        key: this.apiKey,
        cx: this.searchEngineId,
        q: query,
      },
      timeout: 15_000,
    });

    return data.items || [];
  }
}

module.exports = {
  GoogleSearchService,
};
