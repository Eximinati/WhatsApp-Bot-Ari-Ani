function getXpRequired(level) {
  return 5 * (level + 1) * (level + 1) + 50 * (level + 1) + 100;
}

function getProgressBar(currentXp, level, length = 8) {
  const nextLevelXp = getXpRequired(level);
  const percent = Math.min(currentXp / nextLevelXp, 1);
  const filled = Math.floor(percent * length);
  const bar = "█".repeat(filled) + "░".repeat(length - filled);
  return {
    bar: `[${bar}] ${Math.floor(percent * 100)}%`,
    xpLeft: Math.max(nextLevelXp - currentXp, 0),
    percent: Math.floor(percent * 100),
    nextLevelXp
  };
}

function formatSuccessUI(title, flavor, reward, baseXp, finalXp, profile, leveledUp, progress, rare) {
  const levelText = getXpLevelText(profile.level);
  const levelUpMsg = leveledUp ? `\n🎉 LEVEL UP! You are now Lv ${profile.level}!` : "";
  const xpLeft = Math.max(progress.xpLeft, 0);
  const xpGainedText = baseXp !== finalXp ? `(+${finalXp - baseXp} bonus)` : "";
  
  let text = `${title}\n\n${flavor}\n\n`;
  
  if (rare) {
    text += `🎉 *RARE EVENT!*\n${rare.text}\n\n`;
    text += `━━━━━━━━━━━━━━━\n`;
    text += `💰 Earned: +${reward} coins\n`;
    if (rare.coins) text += `🎁 Bonus: +${rare.coins} coins!\n`;
    text += `✨ XP: +${finalXp} ${levelText} ${xpGainedText}\n`;
    text += `📊 ${progress.bar}\n`;
    text += `⬆️ ${xpLeft} XP to next level\n`;
    text += `━━━━━━━━━━━━━━━\n${levelUpMsg}\n\n`;
  } else {
    text += `━━━━━━━━━━━━━━━\n`;
    text += `💰 Earned: +${reward} coins\n`;
    text += `✨ XP: +${finalXp} ${levelText}\n`;
    text += `📊 ${progress.bar}\n`;
    text += `⬆️ ${xpLeft} XP to next level\n`;
    text += `━━━━━━━━━━━━━━━\n${levelUpMsg}\n\n`;
  }
  
  return text;
}

function formatFailUI(title, flavor, progress, levelUpMsg = "") {
  const xpLeft = Math.max(progress.xpLeft, 0);
  
  let text = `${title}\n\n${flavor}\n\n`;
  text += `━━━━━━━━━━━━━━━\n`;
  text += `📊 ${progress.bar}\n`;
  text += `⬆️ ${xpLeft} XP to next level\n`;
  text += `━━━━━━━━━━━━━━━\n${levelUpMsg}\n\n`;
  
  return text;
}

function getXpLevelText(level) {
  return level >= 10 ? `(Lv ${level}+)` : `(Lv ${level})`;
}

function getContextTip(result, balance, action) {
  if (result?.success && balance.wallet > 500) return "💡 Tip: /bank to secure earnings";
  if (result?.success && balance.wallet > 200) return "💡 Tip: /invest to grow earnings";
  if (!result?.success && balance.wallet < 50) return "💡 Tip: /beg for quick cash";
  if (balance.wallet < 100) return "💡 Tip: /work for steady income";
  if (action === "gathering") return "💡 Tip: /work for variety";
  if (action === "risky") return "💡 Tip: /fund for safer returns";
  return "💡 Tip: /invest to grow";
}

function getLoopHook(cooldown, success, action) {
  if (cooldown > 0) {
    if (action === "fish") return "👉 Fish again in 2 min";
    if (action === "mine") return "👉 Mine again in 2 min";
    if (action === "hunt") return "👉 Hunt again in 2 min";
    if (action === "work") return "👉 Work again in 1 min";
    if (action === "beg") return "👉 Try again in 1 min";
    if (action === "crime") return "👉 Try again soon";
    return "👉 Try again in 2 min";
  }
  if (success === false) {
    if (action === "trivia") return "👉 Try /trivia again!";
    if (action === "rps") return "👉 Try /rps again!";
    if (action === "guess") return "👉 Try /guess again!";
    if (action === "math") return "👉 Try /math again!";
    return "👉 Try again - luck will turn!";
  }
  if (action === "fish") return "👉 Try /mine or /hunt next";
  if (action === "mine") return "👉 Try /fish or /hunt next";
  if (action === "hunt") return "👉 Try /fish or /mine next";
  if (action === "work") return "👉 Try /fish for variety";
  if (action === "gathering") return "👉 Keep gathering!";
  if (action === "slot") return "👉 Spin again for luck!";
  if (action === "game") return "👉 Play another game!";
  return "👉 Keep the momentum going!";
}

const RARE_EVENTS = [
  { text: "💰 Hidden treasure!", type: "coins", bonusMult: 5 },
  { text: "✨ XP Surge!", type: "xp", bonusMult: 2 },
  { text: "⚡ Lucky strike!", type: "coins", bonusMult: 3 },
  { text: "🌟 Rare find!", type: "coins", bonusMult: 4 },
  { text: "🎯 Perfect catch!", type: "multi", bonusMult: 2 },
];

function rollRareEvent(baseBonus, baseXp) {
  if (Math.random() > 0.03) return null;
  const event = RARE_EVENTS[Math.floor(Math.random() * RARE_EVENTS.length)];
  return {
    ...event,
    coins: event.type === "coins" ? baseBonus * event.bonusMult : 0,
    xp: event.type === "xp" ? baseXp * event.bonusMult : 0,
    multiplier: event.type === "multi" ? event.bonusMult : 1
  };
}

module.exports = {
  getXpRequired,
  getProgressBar,
  getXpLevelText,
  getContextTip,
  getLoopHook,
  rollRareEvent,
  RARE_EVENTS,
  formatSuccessUI,
  formatFailUI
};