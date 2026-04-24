const axios = require("axios");

class TranslateService {
  async translate(from, to, text) {
    const { data } = await axios.get("https://api.mymemory.translated.net/get", {
      params: {
        q: text,
        langpair: `${from}|${to}`,
      },
      timeout: 15_000,
    });

    return {
      from,
      to,
      input: text,
      translatedText: data?.responseData?.translatedText || "",
      match: data?.responseData?.match || 0,
    };
  }
}

module.exports = {
  TranslateService,
};
