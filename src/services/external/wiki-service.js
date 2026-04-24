const axios = require("axios");

class WikiService {
  async summary(query) {
    const title = encodeURIComponent(String(query || "").trim());
    const { data } = await axios.get(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
      {
        headers: {
          "User-Agent": "Ari-Ani/4.0",
        },
        timeout: 15_000,
      },
    );

    return {
      title: data?.title || query,
      extract: data?.extract || "",
      url: data?.content_urls?.desktop?.page || "",
    };
  }
}

module.exports = {
  WikiService,
};
