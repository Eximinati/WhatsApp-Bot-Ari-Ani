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

const RESET = "\x1b[0m";

function createLogger(config) {
  const level = normalizeLevel(config.logLevel);
  return buildLogger({
    level,
    bindings: {},
  });
}

function buildLogger({ bindings, level }) {
  return {
    level,
    child(childBindings = {}) {
      return buildLogger({
        level,
        bindings: {
          ...bindings,
          ...childBindings,
        },
      });
    },
    trace: (...args) => writeLog({ level: "trace", bindings, baseLevel: level, args }),
    debug: (...args) => writeLog({ level: "debug", bindings, baseLevel: level, args }),
    info: (...args) => writeLog({ level: "info", bindings, baseLevel: level, args }),
    warn: (...args) => writeLog({ level: "warn", bindings, baseLevel: level, args }),
    error: (...args) => writeLog({ level: "error", bindings, baseLevel: level, args }),
    fatal: (...args) => writeLog({ level: "fatal", bindings, baseLevel: level, args }),
  };
}

function writeLog({ level, bindings, baseLevel, args }) {
  const effectiveLevel = bindings.module === "baileys" && LEVELS[baseLevel] > LEVELS.debug
    ? "warn"
    : baseLevel;

  if (LEVELS[level] < LEVELS[effectiveLevel]) {
    return;
  }

  const { message, context } = parseArgs(args);
  const mergedContext = summarizeContext({
    ...bindings,
    ...context,
  });

  const timestamp = formatTimestamp(new Date());
  const levelLabel = colorize(level.toUpperCase().padEnd(5), level);
  const line = [
    `[${timestamp}]`,
    levelLabel,
    message || defaultMessage(level),
    formatContext(mergedContext),
  ]
    .filter(Boolean)
    .join(" ");

  const stream = LEVELS[level] >= LEVELS.error ? process.stderr : process.stdout;
  stream.write(`${line}\n`);

  if (mergedContext.error?.stack) {
    stream.write(`${indentBlock(mergedContext.error.stack)}\n`);
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
  if (key === "error") {
    return summarizeError(value);
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

function supportsColor() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function normalizeLevel(level) {
  return LEVELS[level] ? level : "info";
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

module.exports = {
  createLogger,
};
