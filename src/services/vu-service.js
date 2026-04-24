const axios = require("axios");
const VuAccount = require("../models/vu-account");
const { decryptString, encryptString } = require("../utils/secure-store");

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class VuService {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.cacheMaxAgeMs = 6 * 60 * 60 * 1000;
    this.defaultDeadlineReminderMinutes = [3 * 60, 24 * 60];
  }

  ensureEncryption() {
    if (!this.config.security.appEncryptionKey) {
      throw new Error("VU login is disabled until APP_ENCRYPTION_KEY is configured.");
    }
  }

  async getAccount(userJid) {
    return VuAccount.findOneAndUpdate(
      { userJid },
      { $setOnInsert: { userJid } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  }

  async login(userJid, username, password) {
    this.ensureEncryption();
    const { assignments, calendar } = await this.verifyCredentials({ username, password });
    const account = await this.getAccount(userJid);
    account.username = username;
    account.encryptedPassword = encryptString(password, this.config.security.appEncryptionKey);
    account.assignmentsJson = JSON.stringify(assignments);
    account.calendarJson = JSON.stringify(calendar);
    account.lastSyncAt = new Date();
    account.lastError = "";
    await account.save();
    return { account, assignments, calendar };
  }

  async logout(userJid) {
    return VuAccount.findOneAndUpdate(
      { userJid },
      {
        $set: {
          username: "",
          encryptedPassword: "",
          assignmentsJson: "[]",
          calendarJson: "[]",
          lastError: "",
          lastSyncAt: null,
          lastDigestOn: "",
          notifiedKeysJson: "[]",
        },
      },
      { new: true },
    );
  }

  async setAlerts(userJid, alertsMode) {
    const settings = this.getPresetAlertSettings(alertsMode);
    return VuAccount.findOneAndUpdate(
      { userJid },
      {
        $set: {
          alertsMode: settings.alertsMode,
          dailyDigestEnabled: settings.dailyDigestEnabled,
          deadlineReminderMinutesJson: JSON.stringify(settings.deadlineReminderMinutes),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  }

  async updateAlertPreferences(userJid, updates = {}) {
    const account = await this.getAccount(userJid);
    const current = this.getAlertSettings(account);
    const next = {
      dailyDigestEnabled:
        typeof updates.dailyDigestEnabled === "boolean"
          ? updates.dailyDigestEnabled
          : current.dailyDigestEnabled,
      deadlineReminderMinutes:
        updates.deadlineReminderMinutes !== undefined
          ? this.normalizeReminderMinutes(updates.deadlineReminderMinutes)
          : current.deadlineReminderMinutes,
    };

    account.dailyDigestEnabled = next.dailyDigestEnabled;
    account.deadlineReminderMinutesJson = JSON.stringify(next.deadlineReminderMinutes);
    account.alertsMode = this.resolveAlertsMode(
      next.dailyDigestEnabled,
      next.deadlineReminderMinutes,
    );
    await account.save();
    return account;
  }

  async getStatus(userJid) {
    const account = await VuAccount.findOne({ userJid }).lean();
    const alertSettings = this.getAlertSettings(account || {});
    return {
      connected: Boolean(account?.username && account?.encryptedPassword),
      username: account?.username || "",
      alertsMode: alertSettings.alertsMode,
      dailyDigestEnabled: alertSettings.dailyDigestEnabled,
      deadlineReminderMinutes: alertSettings.deadlineReminderMinutes,
      deadlineReminderLabels: alertSettings.deadlineReminderMinutes.map((value) =>
        this.formatReminderOffset(value),
      ),
      lastSyncAt: account?.lastSyncAt || null,
      lastError: account?.lastError || "",
    };
  }

  async sync(userJid) {
    const account = await this.getAccount(userJid);
    if (!account.username || !account.encryptedPassword) {
      throw new Error("No VU account is connected.");
    }

    const password = decryptString(account.encryptedPassword, this.config.security.appEncryptionKey);
    const { assignments, calendar } = await this.verifyCredentials({
      username: account.username,
      password,
    });

    account.assignmentsJson = JSON.stringify(assignments);
    account.calendarJson = JSON.stringify(calendar);
    account.lastSyncAt = new Date();
    account.lastError = "";
    await account.save();

    this.logger.info(
      {
        area: "VU",
        user: userJid.split("@")[0],
        items: assignments.length,
      },
      "VU sync completed",
    );

    return { assignments, calendar, account };
  }

  async verifyCredentials({ username, password }) {
    const items = await this.fetchCalendarItems({ username, password });
    const assignments = items
      .filter((item) => item.dueAt || item.startAt)
      .sort((left, right) => this.compareBySchedule(left, right));

    return {
      assignments,
      calendar: this.buildCalendar(assignments),
    };
  }

  buildCalendar(assignments) {
    return assignments.map((item) => ({
      title: item.title,
      dueAt: item.dueAt,
      dueText: item.dueText,
      startAt: item.startAt,
      endAt: item.endAt,
      course: item.course,
      courseCode: item.courseCode,
      type: item.type,
      url: item.url,
    }));
  }

  compareBySchedule(left, right) {
    const leftTime = this.getSortTime(left);
    const rightTime = this.getSortTime(right);
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return left.title.localeCompare(right.title);
  }

  getSortTime(item) {
    const value = item.dueAt || item.startAt || item.endAt;
    const time = value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;
    return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
  }

  async getAssignments(userJid) {
    const { assignments } = await this.getSnapshot(userJid);
    return assignments;
  }

  async getCalendar(userJid) {
    const { calendar } = await this.getSnapshot(userJid);
    return calendar;
  }

  async getUpcoming(userJid) {
    const { assignments } = await this.getSnapshot(userJid);
    return assignments
      .filter((item) => item.dueAt || item.startAt)
      .sort((left, right) => this.compareBySchedule(left, right))
      .slice(0, 8);
  }

  async getToday(userJid, timezone) {
    const { assignments } = await this.getSnapshot(userJid);
    const upcoming = assignments
      .filter((item) => item.dueAt || item.startAt)
      .sort((left, right) => this.compareBySchedule(left, right))
      .slice(0, 8);
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    return upcoming.filter((item) => {
      const candidate = item.dueAt || item.startAt;
      if (!candidate) {
        return false;
      }

      return new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(candidate)) === today;
    });
  }

  async getSnapshot(userJid) {
    const account = await this.getAccount(userJid);
    if (!account.username || !account.encryptedPassword) {
      throw new Error("No VU account is connected.");
    }

    const cached = this.readSnapshot(account);
    if (this.hasUsableCache(account, cached)) {
      return { ...cached, account, source: "cache" };
    }

    try {
      return await this.sync(userJid);
    } catch (error) {
      if (cached.assignments.length || cached.calendar.length) {
        this.logger.warn(
          {
            area: "VU",
            user: userJid.split("@")[0],
            error,
          },
          "VU refresh failed, using cached snapshot",
        );
        return { ...cached, account, source: "cache-fallback" };
      }

      throw error;
    }
  }

  readSnapshot(account) {
    const assignments = this.parseJsonArray(account.assignmentsJson);
    const calendar = this.parseJsonArray(account.calendarJson);
    return { assignments, calendar };
  }

  parseJsonArray(value) {
    try {
      const parsed = JSON.parse(value || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  hasUsableCache(account, cached) {
    if (!cached.assignments.length && !cached.calendar.length) {
      return false;
    }

    if (!account.lastSyncAt) {
      return true;
    }

    const ageMs = Date.now() - new Date(account.lastSyncAt).getTime();
    return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= this.cacheMaxAgeMs;
  }

  async getAccountsForAlerts() {
    return VuAccount.find({
      encryptedPassword: { $ne: "" },
    });
  }

  async markDailyDigestSent(account, key) {
    account.lastDigestOn = key;
    await account.save();
  }

  async markDeadlineKeys(account, keys) {
    const existing = JSON.parse(account.notifiedKeysJson || "[]");
    account.notifiedKeysJson = JSON.stringify([...new Set([...existing, ...keys])]);
    await account.save();
  }

  getAlertSettings(account = {}) {
    const fallback = this.getPresetAlertSettings(account.alertsMode || "off");
    const parsedMinutes = this.normalizeReminderMinutes(
      this.parseJsonArray(account.deadlineReminderMinutesJson),
    );

    const dailyDigestEnabled =
      typeof account.dailyDigestEnabled === "boolean"
        ? account.dailyDigestEnabled
        : fallback.dailyDigestEnabled;
    const deadlineReminderMinutes = parsedMinutes.length
      ? parsedMinutes
      : fallback.deadlineReminderMinutes;

    return {
      dailyDigestEnabled,
      deadlineReminderMinutes,
      deadlineReminderLabels: deadlineReminderMinutes.map((value) => this.formatReminderOffset(value)),
      alertsMode: this.resolveAlertsMode(dailyDigestEnabled, deadlineReminderMinutes),
    };
  }

  getPresetAlertSettings(alertsMode) {
    switch (String(alertsMode || "").toLowerCase()) {
      case "daily":
        return {
          alertsMode: "daily",
          dailyDigestEnabled: true,
          deadlineReminderMinutes: [],
        };
      case "deadline":
        return {
          alertsMode: "deadline",
          dailyDigestEnabled: false,
          deadlineReminderMinutes: [...this.defaultDeadlineReminderMinutes],
        };
      case "all":
        return {
          alertsMode: "all",
          dailyDigestEnabled: true,
          deadlineReminderMinutes: [...this.defaultDeadlineReminderMinutes],
        };
      default:
        return {
          alertsMode: "off",
          dailyDigestEnabled: false,
          deadlineReminderMinutes: [],
        };
    }
  }

  resolveAlertsMode(dailyDigestEnabled, deadlineReminderMinutes) {
    const hasDeadline = this.normalizeReminderMinutes(deadlineReminderMinutes).length > 0;
    if (dailyDigestEnabled && hasDeadline) {
      return "all";
    }
    if (dailyDigestEnabled) {
      return "daily";
    }
    if (hasDeadline) {
      return "deadline";
    }
    return "off";
  }

  normalizeReminderMinutes(values) {
    const numbers = Array.isArray(values) ? values : [];
    return [...new Set(
      numbers
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value) && value > 0 && value <= 7 * 24 * 60),
    )].sort((left, right) => left - right);
  }

  parseReminderOffsets(raw) {
    const tokens = String(raw || "")
      .split(/[,\s]+/)
      .map((token) => token.trim())
      .filter(Boolean);

    if (!tokens.length) {
      throw new Error("Provide reminder offsets like 1d, 6h, 30m.");
    }

    const minutes = tokens.map((token) => {
      const plain = token.match(/^(\d+)$/);
      if (plain) {
        return Number.parseInt(plain[1], 10) * 60;
      }

      const match = token.match(/^(\d+)([dhm])$/i);
      if (!match) {
        throw new Error(`Invalid reminder offset: ${token}. Use formats like 1d, 6h, or 30m.`);
      }

      const amount = Number.parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      if (unit === "d") {
        return amount * 24 * 60;
      }
      if (unit === "h") {
        return amount * 60;
      }
      return amount;
    });

    return this.normalizeReminderMinutes(minutes);
  }

  formatReminderOffset(minutes) {
    const value = Number.parseInt(minutes, 10);
    if (!Number.isInteger(value) || value <= 0) {
      return "";
    }
    if (value % (24 * 60) === 0) {
      return `${value / (24 * 60)}d`;
    }
    if (value % 60 === 0) {
      return `${value / 60}h`;
    }
    return `${value}m`;
  }

  getPendingDeadlineReminders(assignments, reminderMinutes, notifiedKeys = new Set(), now = new Date()) {
    const thresholds = this.normalizeReminderMinutes(reminderMinutes);
    if (!thresholds.length) {
      return [];
    }

    const nowMs = now.getTime();
    return assignments
      .map((item) => {
        if (!item?.dueAt) {
          return null;
        }

        const dueMs = new Date(item.dueAt).getTime();
        if (!Number.isFinite(dueMs)) {
          return null;
        }

        const diffMinutes = Math.ceil((dueMs - nowMs) / 60_000);
        if (diffMinutes <= 0) {
          return null;
        }

        const threshold = thresholds.find((value) => diffMinutes <= value);

        if (!threshold) {
          return null;
        }

        const notificationKey = this.buildDeadlineNotificationKey(item, threshold);
        if (notifiedKeys.has(notificationKey)) {
          return null;
        }

        return {
          ...item,
          reminderMinutes: threshold,
          reminderLabel: this.formatReminderOffset(threshold),
          notificationKey,
        };
      })
      .filter(Boolean)
      .sort((left, right) => this.compareBySchedule(left, right));
  }

  buildDeadlineNotificationKey(item, reminderMinutes) {
    return [item.title, item.dueAt || "", reminderMinutes].join("|");
  }

  async fetchCalendarItems({ username, password }) {
    const baseUrl = this.config.vu.baseUrl.replace(/\/+$/, "");
    const loginPath = this.config.vu.loginPath || "/";
    const calendarPath = this.config.vu.calendarPath || "/ActivityCalendar/ActivityCalendar.aspx";
    const homePath = this.config.vu.homePath || "/Home.aspx";
    const loginUrl = `${baseUrl}${loginPath.startsWith("/") ? loginPath : `/${loginPath}`}`;
    const calendarUrl = `${baseUrl}${calendarPath.startsWith("/") ? calendarPath : `/${calendarPath}`}`;
    const homeUrl = `${baseUrl}${homePath.startsWith("/") ? homePath : `/${homePath}`}`;

    const loginPage = await axios.get(loginUrl, {
      timeout: 20_000,
      headers: this.buildBrowserHeaders({ referer: loginUrl }),
    });

    const formState = this.extractLoginFormState(loginPage.data);
    const cookieHeader = this.serializeCookies(loginPage.headers["set-cookie"]);
    const loginBody = this.buildLoginBody({
      username,
      password,
      formState,
    });

    const loginResponse = await axios
      .post(loginUrl, loginBody.toString(), {
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
        timeout: 20_000,
        headers: this.buildBrowserHeaders({
          cookie: cookieHeader,
          origin: baseUrl,
          referer: loginUrl,
          contentType: "application/x-www-form-urlencoded",
        }),
      })
      .catch((error) => error.response || error);

    const mergedCookies = this.serializeCookies([
      ...(loginPage.headers["set-cookie"] || []),
      ...(loginResponse?.headers?.["set-cookie"] || []),
    ]);

    const loginError = this.extractLoginError(loginResponse?.data);
    if (loginError) {
      throw new Error(`VU login failed: ${loginError}`);
    }

    const homeResponse = await axios.get(homeUrl, {
      timeout: 20_000,
      headers: this.buildBrowserHeaders({
        cookie: mergedCookies,
        referer: loginUrl,
      }),
    });

    if (!this.isAuthenticatedHome(homeResponse.data)) {
      const homeError = this.extractLoginError(homeResponse.data);
      if (homeError) {
        throw new Error(`VU login failed: ${homeError}`);
      }

      if (this.containsLoginForm(homeResponse.data)) {
        throw new Error(
          "VU login could not be confirmed. The LMS returned the login page again, which usually means the verification flow blocked the session.",
        );
      }

      throw new Error("VU login could not be confirmed from the LMS home page.");
    }

    const calendarResponse = await axios.get(calendarUrl, {
      timeout: 20_000,
      headers: this.buildBrowserHeaders({
        cookie: mergedCookies,
        referer: homeUrl,
      }),
    });

    const calendarError = this.extractLoginError(calendarResponse.data);
    if (calendarError) {
      throw new Error(`VU calendar access failed: ${calendarError}`);
    }

    if (this.containsLoginForm(calendarResponse.data)) {
      throw new Error(
        "VU login succeeded, but the calendar page redirected back to the login form. The LMS verification flow may be blocking automated access.",
      );
    }

    if (!this.containsCalendarJson(calendarResponse.data)) {
      if (/To Do Calendar/i.test(calendarResponse.data)) {
        return [];
      }

      throw new Error("VU login succeeded, but the calendar page format was not recognized.");
    }

    const rawItems = this.extractCalendarJson(calendarResponse.data);
    return this.normalizeCalendarItems(rawItems, baseUrl);
  }

  buildBrowserHeaders({ cookie = "", origin = "", referer = "", contentType = "" } = {}) {
    const headers = {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    };

    if (cookie) {
      headers.Cookie = cookie;
    }

    if (origin) {
      headers.Origin = origin;
    }

    if (referer) {
      headers.Referer = referer;
    }

    if (contentType) {
      headers["Content-Type"] = contentType;
    }

    return headers;
  }

  extractLoginFormState(html) {
    return {
      ...this.extractAspNetFields(html),
      recaptchaResponse: this.extractInputValue(html, "g-recaptcha-response"),
      action: this.extractInputValue(html, "action") || "beta_LMS",
    };
  }

  buildLoginBody({ username, password, formState }) {
    return new URLSearchParams({
      __EVENTTARGET: "",
      __EVENTARGUMENT: "",
      __VIEWSTATE: formState.__VIEWSTATE || "",
      __VIEWSTATEGENERATOR: formState.__VIEWSTATEGENERATOR || "",
      __EVENTVALIDATION: formState.__EVENTVALIDATION || "",
      txtStudentID: username,
      txtPassword: password,
      ibtnLogin: "Sign In",
      "g-recaptcha-response": formState.recaptchaResponse || "",
      action: formState.action || "beta_LMS",
    });
  }

  extractAspNetFields(html) {
    const fields = {};
    for (const name of ["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION"]) {
      fields[name] = this.extractInputValue(html, name);
    }
    return fields;
  }

  extractInputValue(html, name) {
    const pattern = new RegExp(
      `<input[^>]*name=["']${escapeRegex(name)}["'][^>]*value=["']([^"']*)["']`,
      "i",
    );
    const match = String(html || "").match(pattern);
    return match?.[1] || "";
  }

  serializeCookies(setCookieHeader) {
    return (setCookieHeader || [])
      .map((value) => String(value).split(";")[0])
      .join("; ");
  }

  containsLoginForm(html) {
    const text = String(html || "");
    return /name=["']txtStudentID["']/i.test(text) || /id=["']txtStudentID["']/i.test(text);
  }

  extractLoginError(html) {
    const text = String(html || "");
    const divError = this.extractElementById(text, "divError");
    const invalidIp = this.extractElementById(text, "lblInvalidIp");
    const candidates = [];

    if (divError && !this.isElementHidden(divError.attributes)) {
      candidates.push(this.stripHtml(divError.inner));
    }

    if (invalidIp && !this.isElementHidden(invalidIp.attributes)) {
      candidates.push(this.stripHtml(invalidIp.inner));
    }

    const visible = candidates
      .map((value) => this.normalizeLoginError(value))
      .find(Boolean);
    if (visible) {
      return visible;
    }

    if (divError || invalidIp) {
      return "";
    }

    if (/Incorrect user name or password/i.test(text)) {
      return "Incorrect user name or password. The account will be locked after 5 failed login attempts.";
    }

    if (/Incorrect username or password/i.test(text)) {
      return "Incorrect username or password. Please try again.";
    }

    return "";
  }

  extractElementById(html, id) {
    const pattern = new RegExp(
      `<([a-z0-9]+)([^>]*)id=["']${escapeRegex(id)}["']([^>]*)>([\\s\\S]*?)<\\/\\1>`,
      "i",
    );
    const match = String(html || "").match(pattern);
    if (!match) {
      return null;
    }

    return {
      tagName: match[1].toLowerCase(),
      attributes: `${match[2] || ""} ${match[3] || ""}`.trim(),
      inner: match[4] || "",
    };
  }

  isElementHidden(attributes) {
    const attrs = String(attributes || "");
    if (/\bhidden\b/i.test(attrs)) {
      return true;
    }

    const styleMatch = attrs.match(/style=["']([^"']*)["']/i);
    const style = styleMatch?.[1] || "";
    if (/display\s*:\s*none/i.test(style) || /visibility\s*:\s*hidden/i.test(style)) {
      return true;
    }

    const classMatch = attrs.match(/class=["']([^"']*)["']/i);
    const classNames = classMatch?.[1] || "";
    if (/\bd-none\b/i.test(classNames) || /\binvisible\b/i.test(classNames)) {
      return true;
    }

    return false;
  }

  normalizeLoginError(value) {
    const text = this.stripHtml(value);
    if (!text) {
      return "";
    }

    if (/^incorrect username or password\. please try again\.?$/i.test(text)) {
      return "";
    }

    return text;
  }

  stripHtml(value) {
    return compact(
      String(value || "")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/<[^>]+>/g, " "),
    );
  }

  isAuthenticatedHome(html) {
    const text = String(html || "");
    return /id=["']lnkLogout["']/i.test(text) || /My Profile/i.test(text);
  }

  containsCalendarJson(html) {
    return /var\s+JsonData\s*=\s*\[/i.test(String(html || ""));
  }

  isLoginFailureHtml(html) {
    return Boolean(this.extractLoginError(html) || this.containsLoginForm(html));
  }

  extractCalendarJson(html) {
    const match = String(html || "").match(/var\s+JsonData\s*=\s*(\[[\s\S]*?\]);/i);
    if (!match) {
      return [];
    }

    try {
      return JSON.parse(match[1]);
    } catch (error) {
      this.logger.warn({ area: "VU", error }, "Failed to parse VU calendar JsonData");
      return [];
    }
  }

  normalizeCalendarItems(items, baseUrl) {
    return items
      .map((item) => this.normalizeCalendarItem(item, baseUrl))
      .filter(Boolean)
      .sort((left, right) => this.compareBySchedule(left, right));
  }

  normalizeCalendarItem(item, baseUrl) {
    const title = compact(item?.title);
    if (!title) {
      return null;
    }

    const courseCode = compact(item?.coursecode);
    const startAt = this.parseCalendarDate(item?.start || item?.Start);
    const endAt = this.parseCalendarDate(item?.end);
    const dueAt = endAt || startAt;
    const type = this.classifyCalendarItem(item);
    const url = this.resolveAbsoluteUrl(baseUrl, item?.url);
    const dueText = this.formatDueText(startAt, endAt);

    return {
      title,
      course: courseCode || this.extractCourseFromTitle(title),
      courseCode,
      type,
      semester: compact(item?.Semester),
      dueText,
      dueAt: dueAt ? dueAt.toISOString() : null,
      startAt: startAt ? startAt.toISOString() : null,
      endAt: endAt ? endAt.toISOString() : null,
      status: item?.IsExpired === "1" ? "expired" : "active",
      isExpired: item?.IsExpired === "1",
      allDay: String(item?.allDay || "").toLowerCase() === "true",
      url,
    };
  }

  classifyCalendarItem(item) {
    const url = String(item?.url || "");
    const title = String(item?.title || "");
    if (/ActivityType=Assignment/i.test(url) || /assignment/i.test(title)) {
      return "assignment";
    }
    if (/ActivityType=QuizList/i.test(url) || /quiz/i.test(title)) {
      return "quiz";
    }
    if (/gdb|discussion/i.test(title)) {
      return "gdb";
    }
    return "activity";
  }

  extractCourseFromTitle(title) {
    const match = String(title || "").match(/^([A-Z]{2,}\d+[A-Z]?)\s*:/i);
    return match?.[1] || "";
  }

  resolveAbsoluteUrl(baseUrl, value) {
    if (!value) {
      return "";
    }

    try {
      return new URL(String(value), `${baseUrl}/`).toString();
    } catch {
      return String(value);
    }
  }

  parseCalendarDate(value) {
    const match = String(value || "").match(/(\d{4}),(\d{1,2}),(\d{1,2})/);
    if (!match) {
      return null;
    }

    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = Number.parseInt(match[3], 10);
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  formatDueText(startAt, endAt) {
    if (!startAt && !endAt) {
      return "";
    }

    const formatter = new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      timeZone: "UTC",
    });

    if (startAt && endAt) {
      return `${formatter.format(startAt)} to ${formatter.format(endAt)}`;
    }

    return formatter.format(startAt || endAt);
  }
}

module.exports = {
  VuService,
};
