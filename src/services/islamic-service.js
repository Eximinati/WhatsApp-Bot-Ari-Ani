const axios = require("axios");
const {
  Quran,
  Hadith,
  Azkar,
  Prayer,
  HijriCalendar,
  TranslationEnum,
  TafseerEnum,
  HadithBook,
  HadithLangEnum,
  AzkarCategoriesEnum,
} = require("islam.js");
const adhan = require("adhan");
const quranSearch = require("quran-search-engine");
const quranMeta = require("quran-meta");
const UserSetting = require("../models/user-settings");
const faqEntries = require("../data/islamic/islamic-faq.json");
const khulafaCorpus = require("../data/islamic/khulafa.json");
const hadithTopics = require("../data/islamic/hadith-topics.json");
const arbainEntries = require("../data/islamic/arbain.json");
const fiqhTopics = require("../data/islamic/fiqh-topics.json");

const DEFAULT_PRAYER_CITY = "Karachi";
const DEFAULT_PRAYER_COUNTRY = "Pakistan";
const DEFAULT_PRAYER_METHOD = "Karachi";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s:-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeCompact(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function trimExcerpt(value, limit = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit - 1).trim()}…`;
}

function parseRef(ref) {
  const match = String(ref || "").trim().match(/^(\d{1,3}):(\d{1,3})$/);
  if (!match) {
    return null;
  }
  return {
    chapterNo: Number(match[1]),
    verseNo: Number(match[2]),
    key: `${Number(match[1])}:${Number(match[2])}`,
  };
}

function parseHadithRef(ref) {
  const match = String(ref || "").trim().match(/^([A-Za-z-]+)\s+(\d{1,6})$/);
  if (!match) {
    return null;
  }
  return {
    collection: match[1],
    number: Number(match[2]),
  };
}

function trimExcerpt(value, limit = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit - 3).trim()}...`;
}

function buildQuranUrl(ref) {
  const parsed = parseRef(ref);
  if (!parsed) {
    return "";
  }
  return `https://quran.com/${parsed.chapterNo}/${parsed.verseNo}`;
}

function buildHadithUrl(ref) {
  const parsed = parseHadithRef(ref);
  if (!parsed) {
    return "";
  }

  const collectionMap = {
    bukhari: "bukhari",
    muslim: "muslim",
    tirmidhi: "tirmidhi",
    nasai: "nasai",
    "an-nasai": "nasai",
    abudawud: "abudawud",
    "abu-dawud": "abudawud",
    dawud: "abudawud",
    ibnmajah: "ibnmajah",
    "ibn-majah": "ibnmajah",
    muwatta: "malik",
    malik: "malik",
    qudsi: "qudsi40",
  };

  const collection = collectionMap[
    normalizeText(parsed.collection).replace(/\s+/g, "")
  ];
  if (!collection) {
    return "";
  }

  return `https://sunnah.com/${collection}:${parsed.number}`;
}

function inferHadithGrade(ref = "", explicit = "") {
  if (explicit) {
    return explicit;
  }

  const parsed = parseHadithRef(ref);
  if (!parsed) {
    return "Grading not verified in current source set";
  }

  const collection = normalizeText(parsed.collection);
  if (collection === "bukhari") {
    return "Reported in Sahih al-Bukhari";
  }
  if (collection === "muslim") {
    return "Reported in Sahih Muslim";
  }

  return "Grading not verified in current source set";
}

function uniqueSourceLinks(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item?.url || item?.sourceUrl || "").trim();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function clampResults(items, limit = 3) {
  return Array.isArray(items) ? items.slice(0, limit) : [];
}

function parseCityInput(raw = "", fallbackCountry = "") {
  const text = String(raw || "").trim();
  if (!text) {
    return {
      city: DEFAULT_PRAYER_CITY,
      country: fallbackCountry || DEFAULT_PRAYER_COUNTRY,
    };
  }

  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    city: parts[0] || DEFAULT_PRAYER_CITY,
    country: parts[1] || fallbackCountry || DEFAULT_PRAYER_COUNTRY,
  };
}

function parseCoordinates(raw = "") {
  const match = String(raw || "")
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }
  return {
    latitude: Number(match[1]),
    longitude: Number(match[2]),
  };
}

function getPrayerMethod(method = DEFAULT_PRAYER_METHOD) {
  const map = {
    karachi: adhan.CalculationMethod.Karachi,
    muslimworldleague: adhan.CalculationMethod.MuslimWorldLeague,
    egyptian: adhan.CalculationMethod.Egyptian,
    ummalqura: adhan.CalculationMethod.UmmAlQura,
    dubai: adhan.CalculationMethod.Dubai,
    moonsightingcommittee: adhan.CalculationMethod.MoonsightingCommittee,
    northamerica: adhan.CalculationMethod.NorthAmerica,
    kuwait: adhan.CalculationMethod.Kuwait,
    qatar: adhan.CalculationMethod.Qatar,
    singapore: adhan.CalculationMethod.Singapore,
    tehran: adhan.CalculationMethod.Tehran,
    turkey: adhan.CalculationMethod.Turkey,
    other: adhan.CalculationMethod.Other,
  };
  const key = normalizeText(method).replace(/\s+/g, "");
  const factory = map[key] || adhan.CalculationMethod.Karachi;
  return factory();
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(value);
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}

function daySeed(mod) {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  return day % mod;
}

class IslamicService {
  constructor({ logger } = {}) {
    this.logger = logger;
    this.quran = new Quran();
    this.hadith = new Hadith();
    this.azkar = new Azkar();
    this.prayer = new Prayer();
    this.hijri = new HijriCalendar();
    this.quranMeta = quranMeta.createHafs();
    this.surahCatalog = Array.from({ length: 114 }, (_, index) =>
      this.quranMeta.getSurahMeta(index + 1),
    );
    this.searchContextPromise = null;
    this.quranImageCreatorPromise = null;
    this.sajdahRefs = this.buildSajdahRefs();
    this.hadithBookMap = {
      bukhari: HadithBook.Bukhari,
      muslim: HadithBook.Muslim,
      nasai: HadithBook.Nasai,
      "an-nasai": HadithBook.Nasai,
      "abu-dawud": HadithBook.AbuDawud,
      abudawud: HadithBook.AbuDawud,
      dawud: HadithBook.AbuDawud,
      tirmidhi: HadithBook.Tirmidhi,
      "ibn-majah": HadithBook.IbnMajah,
      ibnmajah: HadithBook.IbnMajah,
      muwatta: HadithBook.MuwattaMalik,
      malik: HadithBook.MuwattaMalik,
      qudsi: HadithBook.Qudsi,
    };
  }

  async getSearchContext() {
    if (!this.searchContextPromise) {
      this.searchContextPromise = Promise.all([
        quranSearch.loadQuranData(),
        quranSearch.loadMorphology(),
        quranSearch.loadWordMap(),
      ]).then(([quranData, morphologyMap, wordMap]) => {
        const invertedIndex = quranSearch.buildInvertedIndex(morphologyMap, quranData);
        return {
          quranData,
          morphologyMap,
          wordMap,
          invertedIndex,
        };
      });
    }
    return this.searchContextPromise;
  }

  async getQuranImageCreator() {
    if (!this.quranImageCreatorPromise) {
      this.quranImageCreatorPromise = import("quran-image-creator").then(
        (module) => module.default.default,
      );
    }
    return this.quranImageCreatorPromise;
  }

  buildSajdahRefs() {
    const refs = [];
    for (let ayahId = 1; ayahId <= 6236; ayahId += 1) {
      const meta = this.quranMeta.getAyahMeta(ayahId);
      if (meta.isSajdahAyah) {
        refs.push(`${meta.surah}:${meta.ayah}`);
      }
    }
    return refs;
  }

  async getUserIslamicSettings(jid) {
    return UserSetting.findOneAndUpdate(
      { jid },
      { $setOnInsert: { jid } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  }

  resolveLanguageMode(settings) {
    return settings?.islamicLanguageMode || "tri";
  }

  buildTriLingualLines({ arabic = "", english = "", urdu = "", mode = "tri" }) {
    const lines = [];
    if (arabic) {
      lines.push(`Arabic: ${arabic}`);
    }
    if (mode !== "ar-ur" && english) {
      lines.push(`English: ${english}`);
    }
    if (mode !== "ar-en" && urdu) {
      lines.push(`Urdu: ${urdu}`);
    }
    return lines;
  }

  getSurahMetaByQuery(query) {
    const raw = String(query || "").trim();
    const numeric = Number(raw);
    if (numeric && numeric >= 1 && numeric <= 114) {
      return this.quranMeta.getSurahMeta(numeric);
    }
    const normalized = normalizeText(raw);
    return this.surahCatalog.find((surah) => {
      const candidates = [
        surah.name,
        surah.nameTranslated,
        surah.nameSimple,
        surah.transliteration,
      ]
        .filter(Boolean)
        .map(normalizeText);
      return candidates.includes(normalized);
    }) || null;
  }

  async getVerseBundle(chapterNo, verseNo) {
    const [englishRow, urduRow, tafsirRow] = await Promise.all([
      this.quran.getMultipleVersesWithTranslation([{ chapterNo, verseNo }], TranslationEnum.English),
      this.quran.getMultipleVersesWithTranslation([{ chapterNo, verseNo }], TranslationEnum.Urdu),
      this.quran.getVerseWithTranslationAndTafseer(
        chapterNo,
        verseNo,
        TranslationEnum.English,
        TafseerEnum.TafsirIbnKathirAbridged,
      ),
    ]);

    const english = englishRow[0] || {};
    const urdu = urduRow[0] || {};
    return {
      chapterNo,
      verseNo,
      key: `${chapterNo}:${verseNo}`,
      arabic: english.verse || urdu.verse || this.quran.getVerse(chapterNo, verseNo),
      english: english.translation || "",
      urdu: urdu.translation || "",
      tafsir: tafsirRow?.tafseer || "",
      surah: this.quranMeta.getSurahMeta(chapterNo),
      meta: this.quranMeta.getAyahMeta(this.quranMeta.findAyahIdBySurah(chapterNo, verseNo)),
    };
  }

  buildRangeSelections(startChapter, startAyah, endChapter, endAyah) {
    const selections = [];
    for (let chapter = startChapter; chapter <= endChapter; chapter += 1) {
      const from = chapter === startChapter ? startAyah : 1;
      const to = chapter === endChapter
        ? endAyah
        : this.quranMeta.getAyahCountInSurah(chapter);
      selections.push({
        chapter,
        from,
        to,
      });
    }
    return selections;
  }

  async renderAyahSelectionImage(selection, options = {}) {
    const QuranImageCreator = await this.getQuranImageCreator();
    return QuranImageCreator({
      selection,
      layout: "madinah-1439",
      centerVerses: true,
      theme: {
        backgroundColor: "#08131c",
        foregroundColor: "#d4af37",
      },
      ...options,
    });
  }

  async getAyah(query, settings = null) {
    const mode = this.resolveLanguageMode(settings);
    const ref = parseRef(query);

    if (ref) {
      const verse = await this.getVerseBundle(ref.chapterNo, ref.verseNo);
      const image = await this.renderAyahSelectionImage([
        { chapter: ref.chapterNo, from: ref.verseNo, to: ref.verseNo },
      ]);
      return {
        type: "exact",
        verse,
        image,
        lines: [
          ...this.buildTriLingualLines({
            arabic: verse.arabic,
            english: verse.english,
            urdu: verse.urdu,
            mode,
          }),
          `Reference: ${verse.key} | ${verse.surah.nameSimple || verse.surah.nameTranslated}`,
        ],
      };
    }

    const results = await this.searchQuran(query);
    if (!results.length) {
      throw new Error("No Quran verse matched that query. Try a reference like 2:255 or a clearer keyword.");
    }
    const best = results[0];
    const verse = await this.getVerseBundle(best.chapterNo, best.verseNo);
    const image = await this.renderAyahSelectionImage([
      { chapter: best.chapterNo, from: best.verseNo, to: best.verseNo },
    ]);
    return {
      type: "search",
      verse,
      image,
      lines: [
        ...this.buildTriLingualLines({
          arabic: verse.arabic,
          english: verse.english,
          urdu: verse.urdu,
          mode,
        }),
        `Best match: ${verse.key}`,
      ],
      matches: results,
    };
  }

  async searchQuran(query) {
    const context = await this.getSearchContext();
    const response = quranSearch.search(
      query,
      context,
      { lemma: true, root: true, semantic: true, fuzzy: true },
      { page: 1, limit: 3 },
    );

    return clampResults(response.results, 3).map((result) => ({
      chapterNo: result.sura_id,
      verseNo: result.aya_id,
      surahName: result.sura_name_en || result.sura_name,
      arabic: result.uthmani || result.standard,
      score: result.matchScore,
    }));
  }

  async getSurah(query, settings = null) {
    const mode = this.resolveLanguageMode(settings);
    const surah = this.getSurahMetaByQuery(query);
    if (!surah) {
      throw new Error("Unknown surah. Use a surah number or a clearer surah name.");
    }

    const chapter = this.quran.getChapterByIndex(surah.number);
    const firstVerses = [];
    for (let verseNo = 1; verseNo <= Math.min(3, chapter.verses.length); verseNo += 1) {
      const bundle = await this.getVerseBundle(surah.number, verseNo);
      firstVerses.push(bundle);
    }

    return {
      surah,
      chapter,
      lines: [
        `Arabic Name: ${chapter.name}`,
        `English Name: ${chapter.englishName}`,
        `Urdu Summary: سورت ${chapter.englishName} ${chapter.type === "مكيّة" ? "مکی" : "مدنی"} ہے اور اس میں ${chapter.numberOfVerses} آیات ہیں۔`,
        `Type: ${chapter.type}`,
        `Ayahs: ${chapter.numberOfVerses}`,
      ],
      excerptLines: firstVerses.flatMap((bundle) => [
        `${bundle.key}`,
        ...this.buildTriLingualLines({
          arabic: bundle.arabic,
          english: bundle.english,
          urdu: bundle.urdu,
          mode,
        }),
      ]),
    };
  }

  async getTafsir(query, settings = null) {
    const ref = parseRef(query);
    if (!ref) {
      throw new Error("Use a Quran reference like /tafsir 2:255.");
    }
    const mode = this.resolveLanguageMode(settings);
    const bundle = await this.getVerseBundle(ref.chapterNo, ref.verseNo);
    return {
      verse: bundle,
      lines: [
        ...this.buildTriLingualLines({
          arabic: bundle.arabic,
          english: bundle.english,
          urdu: bundle.urdu,
          mode,
        }),
        `Tafsir: ${bundle.tafsir}`,
        `Reference: ${bundle.key}`,
      ],
    };
  }

  async getJuz(number) {
    const juz = Number(number);
    if (!this.quranMeta.isValidJuz(juz)) {
      throw new Error("Juz must be a number from 1 to 30.");
    }
    const meta = this.quranMeta.getJuzMeta(juz);
    const start = await this.getVerseBundle(meta.first[0], meta.first[1]);
    const end = await this.getVerseBundle(meta.last[0], meta.last[1]);
    return {
      juz,
      meta,
      lines: [
        `Juz: ${juz}`,
        `Starts: ${start.key}`,
        `Ends: ${end.key}`,
        `Start (EN): ${start.english}`,
        `End (UR): ${end.urdu}`,
      ],
    };
  }

  async getPage(pageNumber) {
    const page = Number(pageNumber);
    if (!this.quranMeta.isValidPage(page)) {
      throw new Error("Page must be a number from 1 to 604.");
    }
    const meta = this.quranMeta.getPageMeta(page);
    const selection = this.buildRangeSelections(
      meta.first[0],
      meta.first[1],
      meta.last[0],
      meta.last[1],
    );
    const image = await this.renderAyahSelectionImage(selection, {
      loadPageNumber: { pagesEnd: true, sectionsEnd: true },
      ignoreWordsPosition: false,
    });
    return {
      page,
      meta,
      image,
      lines: [
        `Page: ${page}`,
        `Starts: ${meta.first[0]}:${meta.first[1]}`,
        `Ends: ${meta.last[0]}:${meta.last[1]}`,
      ],
    };
  }

  async getSajdah(query, settings = null) {
    if (!query) {
      return {
        all: true,
        lines: this.sajdahRefs.map((ref, index) => `${index + 1}. ${ref}`),
      };
    }

    const ref = parseRef(query);
    if (!ref) {
      throw new Error("Use a Quran reference like /sajdah 32:15.");
    }
    const bundle = await this.getVerseBundle(ref.chapterNo, ref.verseNo);
    return {
      all: false,
      verse: bundle,
      isSajdah: bundle.meta.isSajdahAyah,
      lines: [
        ...this.buildTriLingualLines({
          arabic: bundle.arabic,
          english: bundle.english,
          urdu: bundle.urdu,
          mode: this.resolveLanguageMode(settings),
        }),
        `Reference: ${bundle.key}`,
        `Sajdah Ayah: ${bundle.meta.isSajdahAyah ? "Yes" : "No"}`,
      ],
    };
  }

  async getHadithByReference(collectionKey, number) {
    const book = this.hadithBookMap[normalizeText(collectionKey)];
    if (!book) {
      throw new Error("Unsupported hadith collection for exact lookup. Try Bukhari, Muslim, AbuDawud, Tirmidhi, Nasai, IbnMajah, Muwatta, or Qudsi.");
    }

    const hadithNumber = Number(number);
    if (!hadithNumber || hadithNumber <= 0) {
      throw new Error("Hadith number must be a positive number.");
    }

    const [english, arabic, urdu] = await Promise.all([
      this.hadith.getHadith(book, hadithNumber, HadithLangEnum.English),
      this.hadith.getHadith(book, hadithNumber, HadithLangEnum.Arabic),
      this.hadith.getHadith(book, hadithNumber, HadithLangEnum.Urdu),
    ]);

    return {
      collection: collectionKey,
      number: hadithNumber,
      metadata: english.metadata || arabic.metadata || urdu.metadata,
      arabic: arabic.hadith?.text || "",
      english: english.hadith?.text || "",
      urdu: urdu.hadith?.text || "",
      grades: english.hadith?.grades || arabic.hadith?.grades || [],
    };
  }

  searchHadithTopics(query, collectionKey = "") {
    const normalized = normalizeText(query);
    const filtered = hadithTopics
      .map((entry) => {
        let score = 0;
        for (const keyword of entry.keywords) {
          if (normalized.includes(normalizeText(keyword))) {
            score += 2;
          }
        }
        if (normalizeText(entry.titleEn).includes(normalized)) {
          score += 3;
        }
        if (collectionKey && normalizeText(entry.collection) !== normalizeText(collectionKey)) {
          score -= 5;
        }
        return { ...entry, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    return clampResults(filtered, 3);
  }

  async getHadith(queryA, queryB = "", settings = null) {
    const normalizedA = normalizeText(queryA);
    const mode = this.resolveLanguageMode(settings);

    if (queryB && /^\d+$/.test(String(queryB).trim())) {
      const bundle = await this.getHadithByReference(queryA, queryB);
      return {
        exact: true,
        bundle,
        lines: [
          ...this.buildTriLingualLines({
            arabic: bundle.arabic,
            english: bundle.english,
            urdu: bundle.urdu,
            mode,
          }),
          `Reference: ${titleCase(queryA)} ${bundle.number}`,
        ],
      };
    }

    const topicQuery = queryB || queryA;
    const matches = this.searchHadithTopics(topicQuery, queryB ? queryA : "");
    if (!matches.length) {
      throw new Error("No supported hadith topic matched that query. Try a collection + number like /hadith bukhari 1 or a clearer topic.");
    }

    const best = matches[0];
    const bundle = await this.getHadithByReference(best.collection, best.number);
    return {
      exact: false,
      bundle,
      topic: best,
      lines: [
        ...this.buildTriLingualLines({
          arabic: bundle.arabic,
          english: bundle.english || best.summaryEn,
          urdu: bundle.urdu || best.summaryUr,
          mode,
        }),
        `Reference: ${best.collection} ${best.number}`,
        `Topic: ${best.title}`,
      ],
      matches,
    };
  }

  async searchHadith(query) {
    return this.searchHadithTopics(query);
  }

  getArbain(arg = "random") {
    let entry = null;
    if (String(arg).trim().toLowerCase() === "random") {
      entry = arbainEntries[daySeed(arbainEntries.length)];
    } else {
      const number = Number(arg);
      entry = arbainEntries.find((item) => item.number === number) || null;
    }
    if (!entry) {
      throw new Error("Arbain number must be from 1 to 42, or use /arbain random.");
    }
    return entry;
  }

  getDua(topic, settings = null) {
    const mode = this.resolveLanguageMode(settings);
    const normalized = normalizeText(topic);
    const categories = Object.entries(AzkarCategoriesEnum).map(([key, value]) => ({
      key,
      value,
      normalized: normalizeText(key),
    }));
    const category = categories.find((entry) => normalized.includes(entry.normalized))
      || categories.find((entry) => entry.normalized.includes(normalized));
    const picked = category
      ? this.azkar.getRandomByCategory(category.value)
      : this.azkar.getRandom();
    return {
      category: picked.category,
      lines: [
        ...this.buildTriLingualLines({
          arabic: picked.zikr,
          english: picked.description?.en || "",
          urdu: picked.description?.ur || "",
          mode,
        }),
        `Reference: ${picked.reference || "General adhkar source"}`,
        `Count: ${picked.count || "As needed"}`,
      ],
    };
  }

  getAzkar(categoryInput, settings = null) {
    const mode = this.resolveLanguageMode(settings);
    const normalized = normalizeText(categoryInput);
    const category = Object.entries(AzkarCategoriesEnum).find(([key]) =>
      normalizeText(key) === normalized || normalizeText(key).includes(normalized),
    );
    if (!category) {
      throw new Error("Unsupported azkar category. Try morning, evening, sleep, travel, rain, or distress.");
    }
    const entries = this.azkar.getByCategory(category[1]).slice(0, 3);
    return {
      category: category[0],
      entries,
      lines: entries.flatMap((entry, index) => [
        `${index + 1}. ${entry.category}`,
        ...this.buildTriLingualLines({
          arabic: entry.zikr,
          english: entry.description?.en || "",
          urdu: entry.description?.ur || "",
          mode,
        }),
        `Count: ${entry.count || "As needed"} | Ref: ${entry.reference || "Source listed in corpus"}`,
      ]),
    };
  }

  async geocodeCity(city, country) {
    const query = encodeURIComponent(`${city}, ${country}`);
    const { data } = await axios.get(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=jsonv2&limit=1`,
      {
        headers: {
          "User-Agent": "Ari-Ani-IslamicModule/1.0",
        },
        timeout: 10000,
      },
    );
    const first = Array.isArray(data) ? data[0] : null;
    if (!first) {
      return null;
    }
    return {
      latitude: Number(first.lat),
      longitude: Number(first.lon),
    };
  }

  async savePrayerSettings(jid, rawLocation = "", rawMethod = DEFAULT_PRAYER_METHOD) {
    const settings = await this.getUserIslamicSettings(jid);
    const coords = parseCoordinates(rawLocation);

    if (coords) {
      settings.prayerLatitude = coords.latitude;
      settings.prayerLongitude = coords.longitude;
      settings.prayerCity = "";
      settings.prayerCountry = "";
    } else {
      const { city, country } = parseCityInput(rawLocation, settings.prayerCountry);
      settings.prayerCity = city;
      settings.prayerCountry = country;
      const geo = await this.geocodeCity(city, country).catch(() => null);
      settings.prayerLatitude = geo?.latitude ?? settings.prayerLatitude;
      settings.prayerLongitude = geo?.longitude ?? settings.prayerLongitude;
    }

    settings.prayerMethod = rawMethod || settings.prayerMethod || DEFAULT_PRAYER_METHOD;
    await settings.save();
    return settings;
  }

  async resolvePrayerContext(jid = "", rawLocation = "") {
    const settings = jid ? await this.getUserIslamicSettings(jid) : null;
    const coords = parseCoordinates(rawLocation);
    if (coords) {
      return {
        mode: "coords",
        latitude: coords.latitude,
        longitude: coords.longitude,
        method: settings?.prayerMethod || DEFAULT_PRAYER_METHOD,
        settings,
      };
    }

    if (rawLocation) {
      const parsed = parseCityInput(rawLocation, settings?.prayerCountry || DEFAULT_PRAYER_COUNTRY);
      return {
        mode: "city",
        city: parsed.city,
        country: parsed.country,
        method: settings?.prayerMethod || DEFAULT_PRAYER_METHOD,
        settings,
      };
    }

    if (settings?.prayerLatitude != null && settings?.prayerLongitude != null) {
      return {
        mode: "coords",
        latitude: settings.prayerLatitude,
        longitude: settings.prayerLongitude,
        method: settings.prayerMethod || DEFAULT_PRAYER_METHOD,
        settings,
      };
    }

    return {
      mode: "city",
      city: settings?.prayerCity || DEFAULT_PRAYER_CITY,
      country: settings?.prayerCountry || DEFAULT_PRAYER_COUNTRY,
      method: settings?.prayerMethod || DEFAULT_PRAYER_METHOD,
      settings,
    };
  }

  buildAdhanTimes(latitude, longitude, methodName) {
    const coordinates = new adhan.Coordinates(latitude, longitude);
    const params = getPrayerMethod(methodName);
    params.madhab = adhan.Madhab.Hanafi;
    const today = new Date();
    const prayerTimes = new adhan.PrayerTimes(coordinates, today, params);
    return {
      Fajr: formatTime(prayerTimes.fajr),
      Sunrise: formatTime(prayerTimes.sunrise),
      Dhuhr: formatTime(prayerTimes.dhuhr),
      Asr: formatTime(prayerTimes.asr),
      Maghrib: formatTime(prayerTimes.maghrib),
      Isha: formatTime(prayerTimes.isha),
    };
  }

  async getPrayerTimes(jid = "", rawLocation = "") {
    const context = await this.resolvePrayerContext(jid, rawLocation);
    if (context.mode === "coords") {
      const times = this.buildAdhanTimes(
        context.latitude,
        context.longitude,
        context.method,
      );
      return {
        title: "Saved coordinate prayer times",
        subtitle: `${context.latitude}, ${context.longitude} | ${context.method}`,
        times,
      };
    }

    const times = await this.prayer.getPrayerTimesByCity(context.city, context.country);
    return {
      title: `${context.city}, ${context.country}`,
      subtitle: `Method: ${context.method}`,
      times,
    };
  }

  async getNextPrayer(jid = "", rawLocation = "") {
    const result = await this.getPrayerTimes(jid, rawLocation);
    const sequence = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    let nextPrayer = sequence[0];
    let nextTime = null;

    for (const prayer of sequence) {
      const timeString = result.times[prayer];
      if (!timeString) {
        continue;
      }
      const localDate = new Date(`${todayIso} ${timeString}`);
      if (localDate.getTime() > now.getTime()) {
        nextPrayer = prayer;
        nextTime = localDate;
        break;
      }
    }

    if (!nextTime) {
      nextPrayer = "Fajr";
      nextTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    }

    return {
      ...result,
      nextPrayer,
      nextTime,
      countdown: formatDuration(nextTime.getTime() - now.getTime()),
    };
  }

  async getHijri(jid = "", rawDate = "") {
    const settings = jid ? await this.getUserIslamicSettings(jid) : null;
    const date = String(rawDate || "").trim() || new Date().toLocaleDateString("en-GB").replace(/\//g, "-");

    if (settings?.prayerLatitude != null && settings?.prayerLongitude != null) {
      return this.hijri.getHijriDateByLocation(
        date,
        settings.prayerLatitude,
        settings.prayerLongitude,
      );
    }

    return this.hijri.getHijriDateByCity(
      settings?.prayerCity || DEFAULT_PRAYER_CITY,
      settings?.prayerCountry || DEFAULT_PRAYER_COUNTRY,
    );
  }

  searchFaq(question) {
    const normalized = normalizeText(question);
    return faqEntries
      .map((entry) => {
        let score = 0;
        for (const keyword of entry.keywords) {
          if (normalized.includes(normalizeText(keyword))) {
            score += 2;
          }
        }
        return { ...entry, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);
  }

  findFiqhTopic(question) {
    const normalized = normalizeText(question);
    const compact = normalizeCompact(question);
    return fiqhTopics
      .map((topic) => {
        let score = 0;
        for (const keyword of topic.keywords || []) {
          const normalizedKeyword = normalizeText(keyword);
          const compactKeyword = normalizeCompact(keyword);
          if (normalized.includes(normalizedKeyword)) {
            score += 3;
          }
          if (compactKeyword && compact.includes(compactKeyword)) {
            score += 2;
          }
        }
        if (normalizeText(topic.issueTitleEn).includes(normalized)) {
          score += 2;
        }
        return { ...topic, score };
      })
      .filter((topic) => topic.score > 0)
      .sort((left, right) => right.score - left.score)[0] || null;
  }

  detectQuestionType(question, { fiqhTopic = null, faqMatch = null, khulafa = null } = {}) {
    if (fiqhTopic) {
      return fiqhTopic.questionType || "fiqh-dispute";
    }
    if (khulafa?.mode === "topic" || khulafa?.mode === "profile") {
      return "khulafa";
    }
    if (!faqMatch) {
      return "unsupported";
    }

    const worshipKeys = new Set(["salah", "tawbah"]);
    const ethicsKeys = new Set(["parents", "charity", "patience", "knowledge", "justice", "trust"]);
    if (worshipKeys.has(faqMatch.key)) {
      return "worship-general";
    }
    if (ethicsKeys.has(faqMatch.key)) {
      return "ethics";
    }
    return "aqeedah";
  }

  async resolveCitationSupport(citation) {
    if (!citation) {
      return null;
    }

    if (citation.type === "quran") {
      const ref = parseRef(citation.ref);
      if (!ref) {
        return {
          type: "quran",
          ref: citation.ref,
          label: citation.label || citation.ref,
          excerptEn: citation.purposeEn || "",
          excerptUr: citation.purposeUr || "",
          side: citation.side || "",
          url: citation.url || buildQuranUrl(citation.ref),
        };
      }
      const bundle = await this.getVerseBundle(ref.chapterNo, ref.verseNo);
      return {
        type: "quran",
        ref: citation.ref,
        label: citation.label || citation.ref,
        excerptEn: trimExcerpt(citation.purposeEn || bundle.english, 180),
        excerptUr: trimExcerpt(citation.purposeUr || bundle.urdu, 180),
        arabic: trimExcerpt(bundle.arabic, 180),
        side: citation.side || "",
        url: citation.url || buildQuranUrl(citation.ref),
      };
    }

    if (citation.type === "hadith") {
      const ref = parseHadithRef(citation.ref);
      if (ref) {
        try {
          const bundle = await this.getHadithByReference(ref.collection, ref.number);
          return {
            type: "hadith",
            ref: citation.ref,
            label: citation.label || citation.ref,
            excerptEn: trimExcerpt(citation.excerptEn || bundle.english, 180),
            excerptUr: trimExcerpt(citation.excerptUr || bundle.urdu, 180),
            arabic: trimExcerpt(bundle.arabic, 180),
            side: citation.side || "",
            url: citation.url || buildHadithUrl(citation.ref),
            grade: inferHadithGrade(
              citation.ref,
              citation.grade || citation.status || bundle.grades?.[0]?.grade || "",
            ),
          };
        } catch {
          return {
            type: "hadith",
            ref: citation.ref,
            label: citation.label || citation.ref,
            excerptEn: trimExcerpt(citation.excerptEn || "", 180),
            excerptUr: trimExcerpt(citation.excerptUr || "", 180),
            side: citation.side || "",
            url: citation.url || buildHadithUrl(citation.ref),
            grade: inferHadithGrade(citation.ref, citation.grade || citation.status || ""),
          };
        }
      }

      return {
        type: "hadith",
        ref: citation.ref,
        label: citation.label || citation.ref,
        excerptEn: trimExcerpt(citation.excerptEn || "", 180),
        excerptUr: trimExcerpt(citation.excerptUr || "", 180),
        side: citation.side || "",
        url: citation.url || buildHadithUrl(citation.ref),
        grade: inferHadithGrade(citation.ref, citation.grade || citation.status || ""),
      };
    }

    if (citation.type === "khulafa") {
      return {
        type: "khulafa",
        ref: citation.ref,
        label: citation.label || citation.ref,
        excerptEn: trimExcerpt(citation.excerptEn || citation.label || citation.ref, 180),
        excerptUr: trimExcerpt(citation.excerptUr || "", 180),
        sourceUrl: citation.sourceUrl || citation.url || "",
      };
    }

    if (citation.type === "scholar") {
      return {
        type: "scholar",
        ref: citation.ref || citation.label || "scholar-summary",
        label: citation.label || citation.ref || "Scholar summary",
        excerptEn: trimExcerpt(citation.summaryEn || citation.label || citation.ref, 180),
        excerptUr: trimExcerpt(citation.summaryUr || "", 180),
        sourceUrl: citation.sourceUrl || citation.url || "",
      };
    }

    return null;
  }

  async buildFaqAnswer(entry) {
    const evidence = [];
    for (const citation of entry.citations || []) {
      const support = await this.resolveCitationSupport(citation);
      if (support) {
        evidence.push(support);
      }
    }

    return {
      ok: true,
      questionType: this.detectQuestionType(entry.key, { faqMatch: entry }),
      issueKey: entry.key,
      issueTitle: titleCase(entry.key),
      issueTitleUr: "",
      answerEn: entry.answerEn,
      answerUr: entry.answerUr,
      evidence: evidence.slice(0, 3),
      quranEvidence: evidence.filter((item) => item.type === "quran").slice(0, 2),
      hadithEvidence: evidence.filter((item) => item.type === "hadith").slice(0, 3),
      madhhabViews: [],
      khulafaPractice: [],
      scholarNotes: [],
      viewComparison: [],
      citations: entry.citations || [],
      sourceLinks: uniqueSourceLinks(
        evidence.map((item) => ({
          label: item.label || item.ref,
          url: item.url || item.sourceUrl,
        })),
      ),
      safetyNote: "This is source-first guidance, not a fatwa.",
    };
  }

  async buildFiqhAnswer(topic) {
    const quranEvidence = (topic.quranEvidence || []).slice(0, 2).map((item) => ({
      type: "quran",
      ref: item.ref,
      label: item.label || item.ref,
      excerptEn: trimExcerpt(item.excerptEn, 180),
      excerptUr: trimExcerpt(item.excerptUr, 180),
      url: item.url || buildQuranUrl(item.ref),
    }));

    const hadithEvidence = (topic.hadithEvidence || []).slice(0, 3).map((item) => ({
      type: "hadith",
      ref: item.ref,
      label: item.label || item.ref,
      excerptEn: trimExcerpt(item.excerptEn, 180),
      excerptUr: trimExcerpt(item.excerptUr, 180),
      url: item.url || buildHadithUrl(item.ref),
      grade: inferHadithGrade(item.ref, item.grade || item.status || ""),
    }));

    const madhhabViews = (topic.madhhabViews || []).map((view) => ({
      imam: view.imam,
      school: view.school,
      summaryEn: trimExcerpt(view.summaryEn, 220),
      summaryUr: trimExcerpt(view.summaryUr, 220),
      sourceLabel: view.sourceLabel || `${view.school} summary`,
      sourceUrl: view.sourceUrl || "",
    }));

    const khulafaPractice = (topic.khulafaPractice || []).map((entry) => ({
      name: entry.name,
      summaryEn: trimExcerpt(entry.summaryEn, 220),
      summaryUr: trimExcerpt(entry.summaryUr, 220),
      sourceLabel: entry.sourceLabel || entry.name,
      sourceUrl: entry.sourceUrl || "",
    }));

    const scholarNotes = (topic.scholarNotes || []).map((note) => ({
      label: note.label || "Qualified scholar summary",
      summaryEn: trimExcerpt(note.summaryEn, 220),
      summaryUr: trimExcerpt(note.summaryUr, 220),
      sourceUrl: note.sourceUrl || "",
    }));

    const citations = [
      ...quranEvidence.map((item) => ({
        type: item.type,
        ref: item.ref,
        label: item.label,
        url: item.url,
      })),
      ...hadithEvidence.map((item) => ({
        type: item.type,
        ref: item.ref,
        label: item.label,
        url: item.url,
        grade: item.grade,
      })),
      ...madhhabViews.map((view) => ({
        type: "scholar",
        ref: view.school,
        label: `${view.school} - ${view.imam}`,
        url: view.sourceUrl,
      })),
      ...khulafaPractice.map((entry) => ({
        type: "khulafa",
        ref: entry.name,
        label: entry.sourceLabel || entry.name,
        url: entry.sourceUrl,
      })),
      ...scholarNotes.map((note) => ({
        type: "scholar",
        ref: note.label,
        label: note.label,
        url: note.sourceUrl,
      })),
    ];

    return {
      ok: true,
      questionType: topic.questionType || "fiqh-dispute",
      issueKey: topic.key,
      issueTitle: topic.issueTitleEn,
      issueTitleUr: topic.issueTitleUr,
      answerEn: topic.neutralSummaryEn,
      answerUr: topic.neutralSummaryUr,
      quranEvidence,
      hadithEvidence,
      madhhabViews,
      khulafaPractice,
      scholarNotes,
      evidence: [...quranEvidence, ...hadithEvidence].slice(0, 5),
      viewComparison: madhhabViews.map((view) => ({
        labelEn: `${view.school} (${view.imam})`,
        labelUr: view.school,
        summaryEn: view.summaryEn,
        summaryUr: view.summaryUr,
        citation: view.sourceLabel,
      })),
      citations,
      sourceLinks: uniqueSourceLinks(
        citations.map((citation) => ({
          label: citation.label || citation.ref,
          url: citation.url,
        })),
      ),
      safetyNote: topic.safetyNote,
      isValidDifference: true,
    };
  }

  buildKhulafaAnswer(khulafa) {
    const citations =
      khulafa.mode === "profile"
        ? (khulafa.profile.sources || []).map((source) => ({
          type: "khulafa",
          ref: khulafa.profile.key,
          label: source,
        }))
        : (khulafa.topic.sources || []).map((source) => ({
          type: "khulafa",
          ref: khulafa.topic.key,
          label: source,
        }));

    return {
      ok: true,
      questionType: "khulafa",
      issueKey: khulafa.mode === "profile" ? khulafa.profile.key : khulafa.topic.key,
      issueTitle: khulafa.mode === "profile" ? khulafa.profile.name : khulafa.topic.title,
      issueTitleUr: khulafa.mode === "profile" ? khulafa.profile.titleUr : khulafa.topic.titleUr,
      answerEn: khulafa.mode === "profile" ? khulafa.profile.summaryEn : khulafa.topic.summaryEn,
      answerUr: khulafa.mode === "profile" ? khulafa.profile.summaryUr : khulafa.topic.summaryUr,
      evidence: [],
      quranEvidence: [],
      hadithEvidence: [],
      madhhabViews: [],
      khulafaPractice: [],
      scholarNotes: [],
      viewComparison: [],
      citations,
      sourceLinks: [],
      safetyNote: "This is a curated historical and ethical summary from the Khulafa corpus.",
    };
  }

  getKhalifa(query = "") {
    const normalized = normalizeText(query);
    const profiles = khulafaCorpus.profiles;
    if (!normalized) {
      return {
        mode: "index",
        lines: Object.values(profiles).map(
          (profile, index) =>
            `${index + 1}. ${profile.name} - ${profile.title}`,
        ),
      };
    }

    const profile = Object.values(profiles).find((entry) =>
      normalizeText(entry.key) === normalized
      || normalizeText(entry.name).includes(normalized)
      || normalizeText(entry.nameArabic).includes(normalized),
    );
    if (profile) {
      return {
        mode: "profile",
        profile,
        lines: [
          `Name: ${profile.nameArabic}`,
          `English: ${profile.name}`,
          `Role: ${profile.title}`,
          `Urdu: ${profile.titleUr}`,
          `Summary EN: ${profile.summaryEn}`,
          `Summary UR: ${profile.summaryUr}`,
          `Sources: ${profile.sources.join(" | ")}`,
        ],
      };
    }

    const topic = khulafaCorpus.topics.find((entry) =>
      normalizeText(entry.key) === normalized
      || normalizeText(entry.title).includes(normalized)
      || normalizeText(entry.titleUr).includes(normalized),
    );
    if (!topic) {
      throw new Error("No Khulafa profile or topic matched that query. Try abu-bakr, umar, uthman, ali, justice, leadership, or quran-service.");
    }

    return {
      mode: "topic",
      topic,
      lines: [
        `Topic: ${topic.title}`,
        `Urdu: ${topic.titleUr}`,
        `EN: ${topic.summaryEn}`,
        `UR: ${topic.summaryUr}`,
        `Sources: ${topic.sources.join(" | ")}`,
      ],
    };
  }

  async answerIslamicQuestion(question, settings = null) {
    const fiqhTopic = this.findFiqhTopic(question);
    if (fiqhTopic) {
      return this.buildFiqhAnswer(fiqhTopic, settings);
    }

    const faqMatches = this.searchFaq(question);
    if (faqMatches.length) {
      return this.buildFaqAnswer(faqMatches[0], settings);
    }

    const khulafa = (() => {
      try {
        return this.getKhalifa(question);
      } catch {
        return null;
      }
    })();

    if (khulafa?.mode === "topic" || khulafa?.mode === "profile") {
      return this.buildKhulafaAnswer(khulafa);
    }

    return {
      ok: false,
      questionType: "unsupported",
      message: "I could not verify this from the allowed Islamic sources. Try a clearer question about rafadain, salah, tawbah, parents, charity, patience, justice, trust, or knowledge.",
    };
  }

  async getDailyAyah(settings = null) {
    const ayahId = daySeed(6236) + 1;
    const ref = this.quranMeta.findSurahByAyahId(ayahId);
    return this.getAyah(`${ref[0]}:${ref[1]}`, settings);
  }

  getDailyHadith() {
    return arbainEntries[daySeed(arbainEntries.length)];
  }
}

module.exports = {
  IslamicService,
};
