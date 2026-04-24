const moment = require("moment-timezone");

function getGreeting(timezone) {
  const hour = Number.parseInt(moment().tz(timezone).format("H"), 10);

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function formatNow(timezone) {
  return moment().tz(timezone).format("YYYY-MM-DD HH:mm:ss");
}

module.exports = {
  formatNow,
  getGreeting,
};
