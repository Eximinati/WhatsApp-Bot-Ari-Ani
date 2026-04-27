const { normalizeJid } = require("./jid");

function clampMoney(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function parseInventory(value) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function parseJsonObject(value) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stringifyInventory(value) {
  return JSON.stringify(value || {});
}

function totalWealth(record) {
  return clampMoney(record?.wallet) + clampMoney(record?.bank);
}

function randomBetween(min, max) {
  const lower = Math.floor(Number(min) || 0);
  const upper = Math.floor(Number(max) || 0);
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

function formatMoney(value) {
  return `$${clampMoney(value).toLocaleString("en-US")}`;
}

function formatDurationMs(value) {
  const totalSeconds = Math.max(0, Math.ceil((Number(value) || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(" ");
}

function parseAmountInput(input, maxAmount) {
  const normalized = String(input || "").trim().toLowerCase();
  const maximum = clampMoney(maxAmount);

  if (!normalized) {
    throw new Error("Provide an amount.");
  }

  if (["all", "max"].includes(normalized)) {
    if (maximum <= 0) {
      throw new Error("You have nothing available for that action.");
    }

    return maximum;
  }

  const amount = clampMoney(normalized.replace(/[,_\s]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Use a valid positive amount.");
  }

  if (amount > maximum) {
    throw new Error(`You only have ${formatMoney(maximum)} available.`);
  }

  return amount;
}

function parseBetInput(input, { minBet, maxBet, available }) {
  const amount = parseAmountInput(input, available);
  if (amount < minBet) {
    throw new Error(`Minimum bet is ${formatMoney(minBet)}.`);
  }

  if (amount > maxBet) {
    throw new Error(`Maximum bet is ${formatMoney(maxBet)}.`);
  }

  return amount;
}

function resolveTransferTarget(message, rawArg = "") {
  return (
    message?.mentions?.[0] ||
    message?.quoted?.sender ||
    normalizeJid(rawArg)
  );
}

module.exports = {
  clampMoney,
  formatDurationMs,
  formatMoney,
  parseBetInput,
  parseJsonArray,
  parseJsonObject,
  parseAmountInput,
  parseInventory,
  randomBetween,
  resolveTransferTarget,
  stringifyInventory,
  totalWealth,
};
