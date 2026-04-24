const crypto = require("crypto");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const REQUIRED_ENV = ["MONGO_URI", "SESSION_ID"];
const DEFAULT_BAILEYS_VERSION = [2, 3000, 1035194821];

function parseIntegerEnv(value, fallback) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function normalizeOwnerJid(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return trimmed.includes("@") ? trimmed : null;
  }

  return `${digits}@s.whatsapp.net`;
}

function parseOwnerJids() {
  const raw = process.env.OWNER_JIDS || process.env.MODS || "";
  const owners = raw
    .split(",")
    .map(normalizeOwnerJid)
    .filter(Boolean);

  if (!process.env.OWNER_JIDS && process.env.MODS) {
    process.emitWarning(
      "MODS is deprecated. Use OWNER_JIDS for bot owners.",
      "DeprecationWarning",
    );
  }

  return [...new Set(owners)];
}

function parseModJids() {
  const raw = process.env.MOD_JIDS || "";
  return [
    ...new Set(
      raw
        .split(",")
        .map(normalizeOwnerJid)
        .filter(Boolean),
    ),
  ];
}

function createQrToken() {
  return (
    process.env.QR_TOKEN ||
    crypto.randomBytes(24).toString("hex")
  );
}

function normalizePublicUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

function createPublicBaseUrl() {
  return normalizePublicUrl(
    process.env.APP_BASE_URL ||
      process.env.PUBLIC_BASE_URL ||
      process.env.RAILWAY_STATIC_URL ||
      process.env.RAILWAY_PUBLIC_DOMAIN ||
      process.env.KOYEB_PUBLIC_DOMAIN ||
      process.env.VERCEL_URL,
  );
}

function detectPlatform() {
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) {
    return "railway";
  }

  if (process.env.KOYEB_SERVICE_ID || process.env.KOYEB_PUBLIC_DOMAIN) {
    return "koyeb";
  }

  if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL) {
    return "vercel";
  }

  return "generic";
}

function createInstanceId() {
  return (
    process.env.INSTANCE_ID ||
    process.env.RAILWAY_REPLICA_ID ||
    process.env.HOSTNAME ||
    crypto.randomUUID()
  );
}

function parseBaileysVersion(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const parts = raw
    .split(/[.,]/)
    .map((part) => Number.parseInt(part.trim(), 10));

  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error("BAILEYS_VERSION must contain exactly 3 integers, e.g. 2,3000,1025091840.");
  }

  return parts;
}

function validateConfig(config) {
  const missing = REQUIRED_ENV.filter((key) => {
    const value = process.env[key];
    return !value || !String(value).trim();
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  if (!config.mongoUri.includes("mongodb")) {
    throw new Error("MONGO_URI must be a valid MongoDB connection string.");
  }

  if (config.ownerJids.length === 0) {
    throw new Error("Set OWNER_JIDS or MODS with at least one owner JID.");
  }

  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error("PORT must be a valid TCP port between 1 and 65535.");
  }

  if (!config.prefix.trim()) {
    throw new Error("PREFIX cannot be empty.");
  }

  if (!["default", "none"].includes(config.baileys.historySyncMode)) {
    throw new Error("BAILEYS_HISTORY_SYNC must be either 'default' or 'none'.");
  }
}

function buildConfig() {
  const platform = detectPlatform();
  const config = {
    appRoot: path.resolve(__dirname, "..", ".."),
    publicDir: path.resolve(__dirname, "..", "..", "public"),
    mongoUri: process.env.MONGO_URI,
    sessionId: process.env.SESSION_ID,
    prefix: process.env.PREFIX || "/",
    port: parseIntegerEnv(process.env.PORT, 3000),
    ownerJids: parseOwnerJids(),
    modJids: parseModJids(),
    qrToken: createQrToken(),
    botName: process.env.NAME || "Ari-Ani",
    packname: process.env.PACKNAME || "Ari-Ani",
    nodeEnv: process.env.NODE_ENV || "development",
    logLevel: process.env.LOG_LEVEL || "info",
    timezone: process.env.TZ || "UTC",
    platform,
    publicBaseUrl: createPublicBaseUrl(),
    privateBot: process.env.PRIVATE_BOT === "true",
    security: {
      appEncryptionKey: process.env.APP_ENCRYPTION_KEY || "",
    },
    baileys: {
      version: parseBaileysVersion(process.env.BAILEYS_VERSION) || DEFAULT_BAILEYS_VERSION,
      historySyncMode: process.env.BAILEYS_HISTORY_SYNC || "default",
      syncFullHistory: process.env.SYNC_FULL_HISTORY === "true",
    },
    apis: {
      googleKey: process.env.GOOGLE_API_KEY || "",
      googleCx: process.env.GOOGLE_SEARCH_ENGINE_ID || "",
      weatherKey: process.env.WEATHER_API_KEY || "",
    },
    vu: {
      baseUrl: process.env.VU_BASE_URL || "https://vulms.vu.edu.pk",
      loginPath: process.env.VU_LOGIN_PATH || "/",
      homePath: process.env.VU_HOME_PATH || "/Home.aspx",
      calendarPath: process.env.VU_CALENDAR_PATH || "/ActivityCalendar/ActivityCalendar.aspx",
    },
    runtime: {
      instanceId: createInstanceId(),
      leaseMs: parseIntegerEnv(process.env.ACTIVE_INSTANCE_LEASE_MS, 90_000),
      renewIntervalMs: parseIntegerEnv(process.env.ACTIVE_INSTANCE_RENEW_MS, 30_000),
    },
  };

  validateConfig(config);
  return config;
}

const config = buildConfig();

module.exports = {
  REQUIRED_ENV,
  DEFAULT_BAILEYS_VERSION,
  buildConfig,
  config,
  normalizeOwnerJid,
};
