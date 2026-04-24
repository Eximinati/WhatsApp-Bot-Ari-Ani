const moment = require("moment-timezone");

function isValidTimezone(value) {
  return Boolean(value) && moment.tz.zone(value) !== null;
}

function resolveTimezone(config, userSettings) {
  return userSettings?.timezone || config.timezone || "UTC";
}

function parseScheduleInput(input, timezone) {
  const raw = String(input || "").trim();
  if (!raw) {
    return null;
  }

  const durationMatch = raw.match(/^(\d+)\s*([smhdw])$/i);
  if (durationMatch) {
    const amount = Number.parseInt(durationMatch[1], 10);
    const unitMap = {
      s: "seconds",
      m: "minutes",
      h: "hours",
      d: "days",
      w: "weeks",
    };

    return moment().add(amount, unitMap[durationMatch[2].toLowerCase()]);
  }

  const parsed = moment.tz(raw, ["YYYY-MM-DD HH:mm", "YYYY-MM-DDTHH:mm", moment.ISO_8601], timezone);
  if (parsed.isValid()) {
    return parsed;
  }

  return null;
}

function formatDateTime(date, timezone) {
  return moment(date).tz(timezone).format("YYYY-MM-DD HH:mm z");
}

function startOfTodayKey(timezone, date = new Date()) {
  return moment(date).tz(timezone).format("YYYY-MM-DD");
}

module.exports = {
  formatDateTime,
  isValidTimezone,
  parseScheduleInput,
  resolveTimezone,
  startOfTodayKey,
};
