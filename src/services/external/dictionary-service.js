const axios = require("axios");

class DictionaryService {
  async define(word) {
    const { data } = await axios.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(String(word || "").trim())}`,
      { timeout: 15_000 },
    );

    const entry = Array.isArray(data) ? data[0] : null;
    const meaning = entry?.meanings?.[0];
    const definition = meaning?.definitions?.[0];

    return {
      word: entry?.word || word,
      phonetic: entry?.phonetic || "",
      partOfSpeech: meaning?.partOfSpeech || "",
      definition: definition?.definition || "",
      example: definition?.example || "",
    };
  }
}

module.exports = {
  DictionaryService,
};
