const util = require("util");

const LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: Infinity,
};

const LEVEL_STYLES = {
  trace: "\x1b[90m",
  debug: "\x1b[36m",
  info: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  fatal: "\x1b[35m",
};

const TAG_STYLE = "\x1b[96m";
const DIM = "\x1b[2m";

const RESET = "\x1b[0m";

function createLogger(config) {
  const level = normalizeLevel(config.logLevel);
  const state = {
    decryptBursts: new Map(),
    transientEvents: new Map(),
  };
  return buildLogger({
    level,
    bindings: {},
    state,
  });
}

function buildLogger({ bindings, level, state }) {
  return {
    level,
    child(childBindings = {}) {
      return buildLogger({
        level,
        bindings: {
          ...bindings,
          ...childBindings,
        },
        state,
      });
    },
    trace: (...args) => writeLog({ level: "trace", bindings, baseLevel: level, args, state }),
    debug: (...args) => writeLog({ level: "debug", bindings, baseLevel: level, args, state }),
    info: (...args) => writeLog({ level: "info", bindings, baseLevel: level, args, state }),
    warn: (...args) => writeLog({ level: "warn", bindings, baseLevel: level, args, state }),
    error: (...args) => writeLog({ level: "error", bindings, baseLevel: level, args, state }),
    fatal: (...args) => writeLog({ level: "fatal", bindings, baseLevel: level, args, state }),
  };
}

function writeLog({ level, bindings, baseLevel, args, state }) {
  const effectiveLevel = bindings.module === "baileys" && LEVELS[baseLevel] > LEVELS.debug
    ? "warn"
    : baseLevel;

  const { message, context } = parseArgs(args);
  const normalizedEvent = normalizeLogEvent({
    level,
    bindings,
    message,
    context,
    state,
  });

  if (normalizedEvent.suppress || LEVELS[normalizedEvent.level] < LEVELS[effectiveLevel]) {
    return;
  }

  const mergedContext = summarizeContext({
    ...bindings,
    ...normalizedEvent.context,
  });
  const { tag, context: displayContext } = extractDisplayTag(mergedContext);

  const timestamp = colorizeTimestamp(formatTimestamp(new Date()));
  const levelLabel = colorize(normalizedEvent.level.toUpperCase().padEnd(5), normalizedEvent.level);
  const line = [
    `[${timestamp}]`,
    levelLabel,
    tag,
    normalizedEvent.message || defaultMessage(normalizedEvent.level),
    formatContext(displayContext),
  ]
    .filter(Boolean)
    .join(" ");

  const stream = LEVELS[normalizedEvent.level] >= LEVELS.error ? process.stderr : process.stdout;
  stream.write(`${line}\n`);

  if (displayContext.error?.stack) {
    stream.write(`${indentBlock(displayContext.error.stack)}\n`);
  }
}

function parseArgs(args) {
  if (!args.length) {
    return { message: "", context: {} };
  }

  const [first, second] = args;

  if (typeof first === "string") {
    return {
      message: first,
      context: isPlainObject(second) ? second : second instanceof Error ? { error: second } : {},
    };
  }

  if (first instanceof Error) {
    return {
      message: typeof second === "string" ? second : first.message,
      context: { error: first },
    };
  }

  if (isPlainObject(first)) {
    const context = { ...first };
    const message =
      typeof second === "string"
        ? second
        : typeof context.msg === "string"
          ? context.msg
          : typeof context.message === "string"
            ? context.message
            : "";

    delete context.msg;
    delete context.message;

    return { message, context };
  }

  return {
    message: args.map((value) => String(value)).join(" "),
    context: {},
  };
}

function summarizeContext(context) {
  const summarized = {};

  for (const [key, value] of Object.entries(context || {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    summarized[key] = summarizeValue(key, value);
  }

  return summarized;
}

function summarizeValue(key, value) {
  if (/(password|secret|token|credential|encrypted)/i.test(key)) {
    return "[redacted]";
  }

  if (key === "error") {
    return summarizeError(value);
  }

  if (key === "err") {
    return summarizeError(value);
  }

  if (key === "key") {
    return summarizeBaileysKey(value);
  }

  if (key === "rawMessage") {
    return summarizeRawMessage(value);
  }

  if (key === "update") {
    return summarizeConnectionUpdate(value);
  }

  if (key === "contact" && isPlainObject(value)) {
    return {
      id: value.id,
      notify: value.notify,
    };
  }

  if (typeof value === "string") {
    return truncate(value, 120);
  }

  if (Array.isArray(value)) {
    return value.length > 6
      ? [...value.slice(0, 6), `...+${value.length - 6}`]
      : value;
  }

  if (isPlainObject(value)) {
    return compactObject(value);
  }

  return value;
}

function summarizeError(error) {
  if (!(error instanceof Error) && !isPlainObject(error)) {
    return error;
  }

  const stack = error?.stack
    ? String(error.stack)
      .split("\n")
      .slice(0, 8)
      .join("\n")
    : undefined;

  const outputStatusCode = error?.output?.statusCode;

  return compactObject({
    name: error.name,
    message: error.message,
    code: error.code,
    statusCode: error.statusCode || outputStatusCode,
    stack,
  });
}

function summarizeRawMessage(rawMessage) {
  const type = rawMessage?.message ? Object.keys(rawMessage.message)[0] : undefined;
  const payload = type ? rawMessage.message[type] : rawMessage?.message;

  return compactObject({
    id: rawMessage?.key?.id,
    from: rawMessage?.key?.remoteJid,
    participant: rawMessage?.key?.participant,
    fromMe: rawMessage?.key?.fromMe,
    type,
    text: extractText(payload),
  });
}

function summarizeConnectionUpdate(update) {
  return compactObject({
    connection: update?.connection,
    hasQr: Boolean(update?.qr),
    statusCode: update?.lastDisconnect?.error?.output?.statusCode,
    receivedPendingNotifications: update?.receivedPendingNotifications,
  });
}

function summarizeBaileysKey(key) {
  return compactObject({
    chat: shortJid(key?.remoteJid),
    participant: shortJid(key?.participant),
    fromMe: key?.fromMe,
    id: key?.id,
  });
}

function compactObject(object) {
  return Object.fromEntries(
    Object.entries(object || {}).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

function formatContext(context) {
  const entries = Object.entries(context || {});
  if (!entries.length) {
    return "";
  }

  return entries
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(" ");
}

function formatValue(value) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return util.inspect(value, {
    colors: supportsColor(),
    depth: 3,
    compact: true,
    breakLength: 120,
    maxArrayLength: 6,
  });
}

function formatTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function colorize(value, level) {
  if (!supportsColor()) {
    return value;
  }

  return `${LEVEL_STYLES[level] || ""}${value}${RESET}`;
}

function colorizeTag(value) {
  if (!supportsColor()) {
    return value;
  }

  return `${TAG_STYLE}${value}${RESET}`;
}

function colorizeTimestamp(value) {
  if (!supportsColor()) {
    return value;
  }

  return `${DIM}${value}${RESET}`;
}

function supportsColor() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function normalizeLevel(level) {
  return LEVELS[level] ? level : "info";
}

function normalizeLogEvent({ level, bindings, message, context, state }) {
  if (bindings.module !== "baileys") {
    return { level, message, context, suppress: false };
  }

  if (message === "stream errored out") {
    const statusCode = context?.node?.attrs?.code || context?.statusCode;
    if (String(statusCode || "") === "515") {
      return {
        level: "warn",
        message: "WhatsApp stream refreshed; reconnecting",
        context: {
          statusCode: Number(statusCode),
          note: "Usually temporary during reconnect or phone session refresh.",
        },
        suppress: false,
      };
    }
  }

  if (message === "no name present, ignoring presence update request...") {
    return {
      level: "debug",
      message,
      context,
      suppress: true,
    };
  }

  if (message === "failed to decrypt message") {
    return normalizeDecryptEvent({ context, state });
  }

  if (message === "error in handling message") {
    const errorMessage =
      context?.error?.message ||
      context?.err?.message ||
      "";

    if (/Cannot read properties of null \(reading 'toString'\)/i.test(errorMessage)) {
      return rateLimitEvent(state, "baileys:null-cache-key", 5 * 60 * 1000, {
        level: "warn",
        message: "Baileys skipped a harmless malformed cache key",
        context: {
          note: "Known library noise while processing some peer messages. Message flow usually continues.",
        },
        suppress: false,
      });
    }
  }

  if (message === "unexpected error in 'init queries'") {
    const statusCode =
      context?.err?.output?.statusCode ||
      context?.error?.output?.statusCode ||
      context?.err?.statusCode ||
      context?.error?.statusCode;

    if (statusCode === 408) {
      return {
        level: "warn",
        message: "WhatsApp startup sync timed out; continuing with live events",
        context: {
          statusCode,
          note: "This is usually temporary during reconnect or backlog sync.",
        },
        suppress: false,
      };
    }
  }

  return { level, message, context, suppress: false };
}

function normalizeDecryptEvent({ context, state }) {
  const key = context?.key || {};
  const chat = shortJid(key.remoteJid) || "unknown-chat";
  const participant = shortJid(key.participant) || "unknown-user";
  const errorMessage = context?.err?.message || context?.error?.message || "";
  const errorName = /Bad MAC/i.test(errorMessage)
    ? "SessionError"
    : context?.err?.name || context?.error?.name || "DecryptError";
  const bucketKey = `${chat}:${participant}:${errorName}`;
  const now = Date.now();
  const windowMs = 15_000;
  const existing = state.decryptBursts.get(bucketKey);

  if (!existing || now - existing.firstAt > windowMs) {
    if (existing?.count > 1) {
      emitBurstSummary({
        state,
        bucketKey,
        chat: existing.chat,
        participant: existing.participant,
        errorName: existing.errorName,
        count: existing.count,
        firstAt: existing.firstAt,
        lastAt: existing.lastAt,
      });
    }

    state.decryptBursts.set(bucketKey, {
      chat,
      participant,
      errorName,
      count: 1,
      firstAt: now,
      lastAt: now,
    });

    return {
      level: "warn",
      message: "Skipped undecryptable WhatsApp message",
      context: {
        chat,
        participant,
        errorName,
        messageId: key.id,
        note: "Common after reconnect, logout/login, or while catching up missed messages.",
      },
      suppress: false,
    };
  }

  existing.count += 1;
  existing.lastAt = now;

  if (existing.count % 10 === 0) {
    return {
      level: "warn",
      message: "Repeated undecryptable WhatsApp messages",
      context: {
        chat,
        participant,
        errorName,
        occurrences: existing.count,
        windowSeconds: Math.ceil((existing.lastAt - existing.firstAt) / 1000),
      },
      suppress: false,
    };
  }

  return {
    level: "warn",
    message: "Skipped undecryptable WhatsApp message",
    context,
    suppress: true,
  };
}

function emitBurstSummary({ state, bucketKey, chat, participant, errorName, count, firstAt, lastAt }) {
  const windowSeconds = Math.max(1, Math.ceil((lastAt - firstAt) / 1000));
  const timestamp = formatTimestamp(new Date(lastAt));
  const level = "warn";
  const levelLabel = colorize(level.toUpperCase().padEnd(5), level);
  const line = [
    `[${colorizeTimestamp(timestamp)}]`,
    levelLabel,
    colorizeTag("[WA]"),
    "Decrypt warnings summary",
    formatContext({
      chat,
      participant,
      errorName,
      occurrences: count,
      windowSeconds,
    }),
  ]
    .filter(Boolean)
    .join(" ");

  process.stdout.write(`${line}\n`);
  state.decryptBursts.delete(bucketKey);
}

function rateLimitEvent(state, key, windowMs, event) {
  const now = Date.now();
  const lastAt = state.transientEvents.get(key) || 0;
  if (now - lastAt < windowMs) {
    return {
      ...event,
      suppress: true,
    };
  }

  state.transientEvents.set(key, now);
  return event;
}

function defaultMessage(level) {
  return level === "fatal" ? "Fatal error" : "Log event";
}

function indentBlock(text) {
  return String(text)
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function truncate(value, maxLength) {
  if (!value || value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function extractText(payload) {
  if (!payload) {
    return undefined;
  }

  return truncate(
    payload.text ||
      payload.caption ||
      payload.conversation ||
      payload.contentText ||
      payload.selectedDisplayText ||
      payload.selectedButtonId ||
      payload.selectedId ||
      payload.singleSelectReply?.selectedRowId ||
      payload.protocolMessage?.type,
    80,
  );
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function shortJid(value) {
  const jid = String(value || "");
  return jid ? jid.split("@")[0] : "";
}

function extractDisplayTag(context) {
  const next = { ...context };
  const tagSource = next.area || next.module;
  delete next.area;
  delete next.module;

  if (!tagSource) {
    return {
      tag: colorizeTag("[APP]"),
      context: next,
    };
  }

  return {
    tag: colorizeTag(`[${String(tagSource).toUpperCase()}]`),
    context: next,
  };
}

module.exports = {
  createLogger,
};
