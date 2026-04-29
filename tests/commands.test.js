const test = require("node:test");
const assert = require("node:assert/strict");

const helpCommand = require("../src/commands/general/help");
const arianiCommand = require("../src/commands/general/ariani");
const profileCommand = require("../src/commands/general/profile");
const rankCommand = require("../src/commands/general/rank");
const balanceCommand = require("../src/commands/economy/balance");
const payCommand = require("../src/commands/economy/pay");
const shopCommand = require("../src/commands/economy/shop");
const botCommand = require("../src/commands/access/bot");
const banCommand = require("../src/commands/mods/ban");
const weatherCommand = require("../src/commands/utils/weather");
const googleCommand = require("../src/commands/utils/google");
const vuCommand = require("../src/commands/study/vu");
const ayahCommand = require("../src/commands/islamic/ayah");
const islamaskCommand = require("../src/commands/islamic/islamask");
const prayersetCommand = require("../src/commands/islamic/prayerset");
const mediaformatCommand = require("../src/commands/Media/mediaformat");

function createCtx(overrides = {}) {
  const sent = [];
  const replies = [];
  const ctx = {
    args: [],
    text: "",
    config: {
      prefix: "/",
      botName: "Ari-Ani",
      timezone: "UTC",
      ownerJids: ["owner@s.whatsapp.net"],
      modJids: [],
    },
    logger: {
      info() {},
      warn() {},
      error() {},
    },
    msg: {
      from: "chat@s.whatsapp.net",
      sender: "user@s.whatsapp.net",
      mentions: [],
      quoted: null,
      raw: {},
    },
    services: {
      commands: {
        get: () => null,
        grouped: () => ({
          general: [helpCommand],
        }),
      },
      user: {
        getDisplayName: async () => "Tester",
      },
      xp: {
        getProfile: async () => ({
          xp: 10,
          level: 2,
          banned: false,
          bio: "",
          accessState: "allowed",
          streakCount: 2,
          avatarUrl: "",
          timezone: "",
        }),
        getRank: async () => ({ currentXp: 10, nextLevelXp: 25, level: 2, rankTitle: "Beginner" }),
        getRole: () => "Beginner",
        addXp: async () => ({ profile: { avatarUrl: "" }, leveledUp: false }),
      },
      economy: {
        getBalance: async () => ({
          wallet: 150,
          bank: 250,
          totalWealth: 400,
          inventory: {},
          activeBuffs: [],
          jobKey: "",
          factionKey: "",
          equippedToolKey: "",
        }),
        getWealthRank: async () => ({ rank: 3, totalWealth: 400 }),
        formatBalanceLines: (balance) => [
          `Wallet: $${balance.wallet}`,
          `Bank: $${balance.bank}`,
          `Total wealth: $${balance.totalWealth}`,
        ],
        pay: async () => ({
          amount: 50,
          sender: { wallet: 100, bank: 0, totalWealth: 100 },
          receiver: { wallet: 75, bank: 0, totalWealth: 75 },
        }),
        getShopItems: () => [
          {
            key: "lucky_charm",
            name: "Lucky Charm",
            price: 250,
            type: "cosmetic",
            description: "A shiny charm said to bring better luck.",
          },
        ],
      },
      islamic: {
        getUserIslamicSettings: async () => ({ islamicLanguageMode: "tri" }),
        getAyah: async () => ({
          verse: {
            key: "2:255",
            chapterNo: 2,
            verseNo: 255,
            surah: { nameSimple: "Al-Baqarah" },
          },
          image: Buffer.from("ayah"),
          lines: [
            "Arabic: ...",
            "English: Allah - there is no deity except Him...",
            "Urdu: اللہ کے سوا کوئی معبود نہیں...",
            "Reference: 2:255 | Al-Baqarah",
          ],
        }),
        answerIslamicQuestion: async () => ({
          ok: true,
          questionType: "fiqh-dispute",
          issueTitle: "Raf al-Yadayn in Salah",
          issueTitleUr: "نماز میں رفع الیدین",
          answerEn: "Salah is a central obligation in Islam.",
          answerUr: "نماز اسلام کا ایک بنیادی فرض ہے۔",
          citations: [
            { ref: "2:43", label: "Quran 2:43" },
            { ref: "29:45", label: "Quran 29:45" },
          ],
          support: [
            { ref: "2:43", english: "Establish prayer and give zakah." },
          ],
          evidence: [
            { ref: "2:43", excerptEn: "The Quran commands establishing prayer." },
            { ref: "Bukhari 735", excerptEn: "Ibn Umar reported raising the hands before and after ruku." },
          ],
          viewComparison: [
            {
              labelEn: "View 1",
              summaryEn: "Many scholars retained raising the hands at multiple points based on authentic narrations.",
            },
          ],
          safetyNote: "This is a recognized scholarly difference and not a fatwa.",
        }),
        savePrayerSettings: async () => ({
          prayerCity: "Karachi",
          prayerCountry: "Pakistan",
          prayerLatitude: 24.8607,
          prayerLongitude: 67.0011,
          prayerMethod: "Karachi",
        }),
      },
      visuals: {
        sendQuoteCard: async (payload) => {
          sent.push({ type: "quote-card", ...payload });
        },
        sendLeaderboardCard: async (payload) => {
          sent.push({ type: "leaderboard-card", ...payload });
        },
        sendRankCard: async (payload) => {
          sent.push({ type: "rank-card", ...payload });
        },
        sendEconomyResultCard: async (payload) => {
          sent.push({ type: "economy-card", ...payload });
        },
        sendGambleCard: async (payload) => {
          sent.push({ type: "gamble-card", ...payload });
        },
        sendFactionCard: async (payload) => {
          sent.push({ type: "faction-card", ...payload });
        },
        sendProfileCard: async (payload) => {
          sent.push({ type: "profile-card", ...payload });
        },
        sendQuranAyahCard: async (payload) => {
          sent.push({ type: "quran-card", ...payload });
        },
        sendHadithCard: async (payload) => {
          sent.push({ type: "hadith-card", ...payload });
        },
        sendPrayerCard: async (payload) => {
          sent.push({ type: "prayer-card", ...payload });
        },
        sendDuaCard: async (payload) => {
          sent.push({ type: "dua-card", ...payload });
        },
        sendIslamicAnswerCard: async (payload) => {
          sent.push({ type: "islamic-card", ...payload });
        },
      },
      settings: {
        banUser: async () => {},
        updateUserSettings: async () => {},
        getUserSettings: async () => ({
          mediaPreferencesJson: "",
        }),
        getBotSettings: async () => ({ chatMode: "all" }),
        setBotChatMode: async (chatMode) => ({ chatMode }),
      },
      media: {
        describePreferences: () => [
          { commandName: "video", mode: "ask", options: ["video", "document"] },
          { commandName: "play", mode: "document", options: ["audio", "document"] },
        ],
        getSupportedCommands: () => ["video", "play", "tiktok", "instagram"],
        getCommandConfig: (commandName) => ({
          options: commandName === "play"
            ? [{ mode: "audio" }, { mode: "document" }]
            : [{ mode: "video" }, { mode: "document" }],
        }),
        setPreference: async () => {},
        resetPreference: async () => {},
        resetAllPreferences: async () => {},
      },
      vu: {
        login: async () => ({ assignments: [] }),
        getStatus: async () => ({
          connected: false,
          username: "",
          alertsMode: "off",
          dailyDigestEnabled: false,
          deadlineReminderLabels: [],
          lastSyncAt: null,
          lastError: "",
        }),
      },
      external: {
        weather: {
          isConfigured: () => false,
          current: async () => ({}),
        },
        google: {
          isConfigured: () => false,
          search: async () => [],
        },
      },
    },
    sock: {
      fetchStatus: async () => ({ status: "About me" }),
      profilePictureUrl: async () => "https://placehold.co/256x256/png",
    },
    reply: async (text) => {
      replies.push(text);
    },
    send: async (_jid, payload) => {
      sent.push(payload);
    },
    ...overrides,
  };

  return { ctx, replies, sent };
}

test("help command renders grouped command list", async () => {
  const { ctx, replies } = createCtx();
  await helpCommand.execute(ctx);
  assert.equal(replies.length, 1);
  assert.match(replies[0], /general/i);
});

test("ariani command includes the persisted chat mode", async () => {
  const { ctx, replies } = createCtx({
    services: {
      ...createCtx().ctx.services,
      settings: {
        ...createCtx().ctx.services.settings,
        getBotSettings: async () => ({ chatMode: "private" }),
      },
    },
  });
  await arianiCommand.execute(ctx);
  assert.match(replies[0], /Chat mode: private only/i);
});

test("profile command renders mentioned profile", async () => {
  const { ctx, sent } = createCtx({
    msg: {
      from: "chat@s.whatsapp.net",
      sender: "me@s.whatsapp.net",
      mentions: ["target@s.whatsapp.net"],
      quoted: null,
      raw: {},
    },
  });
  await profileCommand.execute(ctx);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, "profile-card");
  assert.match(sent[0].title, /PROFILE/i);
  assert.match(sent[0].lines.join("\n"), /Total Wealth/i);
  assert.match(sent[0].caption, /Job:/i);
});

test("rank command responds through send or reply", async () => {
  const { ctx, sent, replies } = createCtx();
  await rankCommand.execute(ctx);
  assert.equal(sent.length + replies.length > 0, true);
});

test("balance command renders wallet and bank data", async () => {
  const { ctx, sent } = createCtx();
  await balanceCommand.execute(ctx);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, "economy-card");
  assert.match(sent[0].lines.join("\n"), /Wallet/i);
  assert.match(sent[0].lines.join("\n"), /Wealth rank/i);
});

test("pay command uses economy service and mentions the target", async () => {
  const { ctx, sent } = createCtx({
    args: ["target@s.whatsapp.net", "50"],
  });
  await payCommand.execute(ctx);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, "economy-card");
  assert.match(sent[0].lines.join("\n"), /Amount: \$50/i);
});

test("shop command renders item catalog card", async () => {
  const { ctx, sent } = createCtx();
  await shopCommand.execute(ctx);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, "leaderboard-card");
  assert.match(sent[0].lines.join("\n"), /Lucky Charm/i);
});

test("ban command bans mentioned user", async () => {
  let banned = null;
  const { ctx, replies } = createCtx({
    msg: {
      from: "chat@s.whatsapp.net",
      sender: "owner@s.whatsapp.net",
      mentions: ["target@s.whatsapp.net"],
      quoted: null,
      raw: {},
    },
    services: {
      ...createCtx().ctx.services,
      settings: {
        banUser: async (jid, value) => {
          banned = [jid, value];
        },
      },
    },
  });
  await banCommand.execute(ctx);
  assert.deepEqual(banned, ["target@s.whatsapp.net", true]);
  assert.equal(replies.length, 1);
});

test("bot command updates chat mode", async () => {
  const { ctx, replies } = createCtx({
    args: ["private"],
  });
  await botCommand.execute(ctx);
  assert.equal(replies.length, 1);
  assert.match(replies[0], /only respond in private chat/i);
});

test("weather command reports disabled integration when api key is missing", async () => {
  const { ctx, replies } = createCtx({ text: "Karachi" });
  await weatherCommand.execute(ctx);
  assert.match(replies[0], /WEATHER_API_KEY/);
});

test("google command reports disabled integration when credentials are missing", async () => {
  const { ctx, replies } = createCtx({ text: "OpenAI" });
  await googleCommand.execute(ctx);
  assert.match(replies[0], /GOOGLE_API_KEY/);
});

test("vu login command confirms verified login instead of only saving credentials", async () => {
  const { ctx, replies } = createCtx({
    args: ["login", "BC260230194", "secret"],
    services: {
      ...createCtx().ctx.services,
      vu: {
        login: async () => ({ assignments: [{ title: "CS301: Assignment# 1" }] }),
        getStatus: async () => ({
          connected: true,
          username: "BC260230194",
          alertsMode: "off",
          dailyDigestEnabled: false,
          deadlineReminderLabels: [],
          lastSyncAt: null,
          lastError: "",
        }),
      },
      settings: {
        updateUserSettings: async () => {},
      },
    },
  });

  await vuCommand.execute(ctx);
  assert.equal(replies.length, 1);
  assert.match(replies[0], /VU login successful/i);
  assert.match(replies[0], /Calendar items detected: 1/i);
});

test("vu command opens the guided menu when used without arguments", async () => {
  const { ctx, replies } = createCtx();
  await vuCommand.execute(ctx);
  assert.equal(replies.length, 1);
  assert.match(replies[0], /\*VU Menu\*/);
  assert.match(replies[0], /Reply with a number/i);
});

test("vu alerts before command stores custom reminder offsets", async () => {
  let stored = null;
  const { ctx, replies } = createCtx({
    args: ["alerts", "before", "1d,6h,30m"],
    services: {
      ...createCtx().ctx.services,
      vu: {
        parseReminderOffsets: () => [30, 360, 1440],
        updateAlertPreferences: async (_jid, payload) => {
          stored = payload.deadlineReminderMinutes;
          return {
            dailyDigestEnabled: false,
            deadlineReminderMinutes: payload.deadlineReminderMinutes,
            deadlineReminderLabels: ["30m", "6h", "1d"],
            alertsMode: "deadline",
          };
        },
        getAlertSettings: (account) => account,
      },
      settings: {
        updateUserSettings: async () => {},
      },
    },
  });

  await vuCommand.execute(ctx);
  assert.deepEqual(stored, [30, 360, 1440]);
  assert.match(replies[0], /Before deadline: 30m, 6h, 1d/i);
});

test("ayah command renders the Quran image-first card", async () => {
  const { ctx, sent } = createCtx({ text: "2:255", args: ["2:255"] });
  await ayahCommand.execute(ctx);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, "quran-card");
  assert.match(sent[0].title, /AYAH/i);
  assert.ok(sent[0].image);
});

test("islamask command returns structured text-only Sunni fiqh answer", async () => {
  const { ctx, sent, replies } = createCtx({
    text: "if we pray with rafadain then our namaz is invalid?",
    args: ["if", "we", "pray", "with", "rafadain", "then", "our", "namaz", "is", "invalid?"],
    services: {
      ...createCtx().ctx.services,
      islamic: {
        ...createCtx().ctx.services.islamic,
        answerIslamicQuestion: async () => ({
          ok: true,
          questionType: "fiqh-dispute",
          issueTitle: "Raf al-Yadayn in Salah",
          issueTitleUr: "نماز میں رفع الیدین",
          answerEn:
            "This is a recognized Sunni fiqh difference and prayer is not invalid merely for following a recognized Sunni view.",
          answerUr:
            "یہ ایک معتبر سنی فقہی اختلاف ہے اور کسی معتبر سنی قول پر عمل کرنے سے نماز خود بخود باطل نہیں ہوتی۔",
          quranEvidence: [
            {
              ref: "2:43",
              label: "Establish prayer",
              excerptEn: "Prayer and bowing are established in revelation.",
              excerptUr: "نماز اور رکوع کی اصل وحی سے ثابت ہے۔",
              url: "https://quran.com/2/43",
            },
          ],
          hadithEvidence: [
            {
              ref: "Bukhari 736",
              label: "Ibn Umar on raising the hands",
              excerptEn:
                "The Prophet raised his hands at the opening, before ruku, and after rising from ruku.",
              excerptUr:
                "نبی صلی اللہ علیہ وسلم نے شروع میں، رکوع سے پہلے، اور رکوع کے بعد ہاتھ اٹھائے۔",
              url: "https://sunnah.com/bukhari:736",
              grade: "Reported in Sahih al-Bukhari",
            },
          ],
          madhhabViews: [
            {
              imam: "Imam Abu Hanifa",
              school: "Hanafi",
              summaryEn: "Opening takbir only in the relied-upon school practice.",
              summaryUr: "معتمد طریقے میں ابتدائی تکبیر کے ساتھ۔",
              sourceUrl: "https://www.islamweb.net/en/printfatwa.php?id=360367",
            },
            {
              imam: "Imam Malik ibn Anas",
              school: "Maliki",
              summaryEn: "Recognizes the narrations, with practical detail in application.",
              summaryUr: "روایات کو مانتا ہے، مگر عملی تفصیل کے ساتھ۔",
              sourceUrl: "https://www.islamweb.net/en/printfatwa.php?id=360367",
            },
            {
              imam: "Imam al-Shafi'i",
              school: "Shafi'i",
              summaryEn: "Recommends raising before and after ruku.",
              summaryUr: "رکوع سے پہلے اور بعد میں استحباب کا قائل۔",
              sourceUrl: "https://www.islamweb.net/en/printfatwa.php?id=360367",
            },
            {
              imam: "Imam Ahmad ibn Hanbal",
              school: "Hanbali",
              summaryEn: "Also recommends the reported positions of raising the hands.",
              summaryUr: "منقول مقامات میں رفع الیدین کو مسنون مانتا ہے۔",
              sourceUrl: "https://www.islamweb.net/en/printfatwa.php?id=360367",
            },
          ],
          khulafaPractice: [],
          scholarNotes: [
            {
              label: "Qualified Sunni summary",
              summaryEn:
                "This is a recognized Sunni difference and not a basis for careless invalidity claims.",
              summaryUr:
                "یہ معتبر سنی اختلاف ہے، اور نماز کو جلد باطل کہنے کی بنیاد نہیں۔",
              sourceUrl: "https://www.islamweb.net/en/printfatwa.php?id=360367",
            },
          ],
          citations: [
            { ref: "2:43", label: "Quran 2:43", url: "https://quran.com/2/43" },
            { ref: "Bukhari 736", label: "Bukhari 736", url: "https://sunnah.com/bukhari:736" },
          ],
          sourceLinks: [
            { label: "Quran 2:43", url: "https://quran.com/2/43" },
            { label: "Bukhari 736", url: "https://sunnah.com/bukhari:736" },
            { label: "IslamWeb fiqh comparison", url: "https://www.islamweb.net/en/printfatwa.php?id=360367" },
          ],
          safetyNote:
            "This is a recognized scholarly difference and not a fatwa.",
        }),
      },
    },
  });
  await islamaskCommand.execute(ctx);
  assert.equal(sent.length, 0);
  assert.equal(replies.length, 1);
  assert.match(replies[0], /FIQH DIFFERENCE/i);
  assert.match(replies[0], /Raf al-Yadayn/i);
  assert.match(replies[0], /Four Sunni schools/i);
  assert.match(replies[0], /Hanafi/i);
  assert.match(replies[0], /Maliki/i);
  assert.match(replies[0], /Shafi'i/i);
  assert.match(replies[0], /Hanbali/i);
  assert.match(replies[0], /https:\/\/quran\.com\/2\/43/i);
  assert.match(replies[0], /https:\/\/sunnah\.com\/bukhari:736/i);
});

test("prayerset command persists prayer preferences", async () => {
  const { ctx, replies } = createCtx({
    text: "Karachi, Pakistan Karachi",
    args: ["Karachi,", "Pakistan", "Karachi"],
  });
  await prayersetCommand.execute(ctx);
  assert.equal(replies.length, 1);
  assert.match(replies[0], /Prayer settings saved/i);
  assert.match(replies[0], /Karachi/i);
});

test("mediaformat command renders saved preferences", async () => {
  const { ctx, replies } = createCtx();
  await mediaformatCommand.execute(ctx);
  assert.equal(replies.length, 1);
  assert.match(replies[0], /Media Format Preferences/i);
  assert.match(replies[0], /\/video: ask every time/i);
  assert.match(replies[0], /\/play: document/i);
});
