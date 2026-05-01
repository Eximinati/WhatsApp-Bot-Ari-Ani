const DEFAULT_STATS = { luck: 1, strength: 1, intelligence: 1, defense: 1 };
const STAT_POINTS_PER_LEVEL = 3;
const MAX_STAT = 50;

// Clamp stat values to prevent abuse
function clampStats(stats) {
  return {
    luck: Math.min(Math.max(stats.luck || 1, 1), MAX_STAT),
    strength: Math.min(Math.max(stats.strength || 1, 1), MAX_STAT),
    intelligence: Math.min(Math.max(stats.intelligence || 1, 1), MAX_STAT),
    defense: Math.min(Math.max(stats.defense || 1, 1), MAX_STAT)
  };
}

// Get stat bonuses with capped scaling
function getStatBonuses(stats) {
  const clamped = clampStats(stats);
  
  // Luck: +0.2% per level (base 3% + max 9.8% = 12.8% at MAX)
  const luckBonus = (clamped.luck - 1) * 0.002;
  const rareChance = Math.min(0.03 + luckBonus, 0.15); // Cap at 15%
  
  // Strength: +5% per level (max +245%)
  const strengthBonus = (clamped.strength - 1) * 0.05;
  const rewardScale = Math.min(1 + strengthBonus, 3.0); // Cap at 3x
  
  // Intelligence: +5% per level (max +245%)
  const intelligenceBonus = (clamped.intelligence - 1) * 0.05;
  const xpScale = Math.min(1 + intelligenceBonus, 3.0); // Cap at 3x
  
  // Defense: +4% per level (max +196%)
  const defenseBonus = (clamped.defense - 1) * 0.04;
  const lossReduction = Math.min(defenseBonus, 0.80); // Cap at 80%
  
  return {
    rareChance,
    rewardScale: Math.round(rewardScale * 100) / 100, // Round to 2 decimals
    xpScale: Math.round(xpScale * 100) / 100,
    lossReduction: Math.round(lossReduction * 100) / 100
  };
}

// Apply stat bonuses with proper rounding
function applyStatBonuses(baseReward, baseXp, stats) {
  const bonuses = getStatBonuses(stats);
  
  const finalReward = Math.floor(baseReward * bonuses.rewardScale);
  const finalXp = Math.floor(baseXp * bonuses.xpScale);
  
  return {
    finalReward,
    finalXp,
    rareChance: bonuses.rareChance,
    bonuses
  };
}

// Roll rare event with LUCK stat applied
function rollRareEvent(baseBonus, baseXp, stats) {
  const bonuses = getStatBonuses(stats);
  const rareChance = bonuses.rareChance;
  
  if (Math.random() > rareChance) return null;
  
  const RARE_EVENTS = [
    { text: "💰 Hidden treasure!", type: "coins", bonusMult: 5 },
    { text: "✨ XP Surge!", type: "xp", bonusMult: 2 },
    { text: "⚡ Lucky strike!", type: "coins", bonusMult: 3 },
    { text: "🌟 Rare find!", type: "coins", bonusMult: 4 },
    { text: "🎯 Perfect catch!", type: "multi", bonusMult: 2 },
  ];
  
  const event = RARE_EVENTS[Math.floor(Math.random() * RARE_EVENTS.length)];
  return {
    ...event,
    coins: event.type === "coins" ? Math.floor(baseBonus * event.bonusMult) : 0,
    xp: event.type === "xp" ? Math.floor(baseXp * event.bonusMult) : 0,
    multiplier: event.type === "multi" ? event.bonusMult : 1
  };
}

// Get scaled reward loss (for crime)
function applyLossReduction(loss, stats) {
  const bonuses = getStatBonuses(stats);
  const reducedLoss = Math.floor(loss * (1 - bonuses.lossReduction));
  return {
    reducedLoss,
    saved: loss - reducedLoss
  };
}

// Get stat scaling text for UI
function getStatScalingText(bonuses) {
  const parts = [];
  
  if (bonuses.rewardScale > 1) {
    const percent = Math.round((bonuses.rewardScale - 1) * 100);
    if (percent > 0) parts.push(`+${percent}% STR`);
  }
  
  if (bonuses.xpScale > 1) {
    const percent = Math.round((bonuses.xpScale - 1) * 100);
    if (percent > 0) parts.push(`+${percent}% INT`);
  }
  
  if (bonuses.rareChance > 0.03) {
    const percent = (bonuses.rareChance * 100).toFixed(1);
    parts.push(`${percent}% Luck`);
  }
  
  if (bonuses.lossReduction > 0) {
    const percent = Math.round(bonuses.lossReduction * 100);
    if (percent > 0) parts.push(`-${percent}% DEF`);
  }
  
  return parts;
}

// Validate stat upgrade with cap protection
function validateStatUpgrade(statName, amount, availablePoints) {
  const validStats = ["luck", "strength", "intelligence", "defense"];
  const stat = statName?.toLowerCase();
  
  if (!validStats.includes(stat)) {
    return { valid: false, error: `Invalid stat. Use: ${validStats.join(", ")}` };
  }
  
  const points = parseInt(amount, 10);
  if (isNaN(points) || points < 1) {
    return { valid: false, error: "Enter a valid number" };
  }
  
  if (points > availablePoints) {
    return { valid: false, error: `Only ${availablePoints} points available` };
  }
  
  return { valid: true, stat, points };
}

// Check if can upgrade (with max cap)
function canUpgrade(currentValue) {
  return currentValue < MAX_STAT;
}

function getStatDisplayName(stat) {
  const names = {
    luck: "🍀 Luck",
    strength: "💪 Strength",
    intelligence: "🧠 Intelligence",
    defense: "🛡️ Defense"
  };
  return names[stat] || stat;
}

function formatStatsUI(stats, statPoints, level) {
  const clamped = clampStats(stats);
  const bonuses = getStatBonuses(clamped);
  const scaling = getStatScalingText(bonuses);
  const scaleText = scaling.length > 0 ? `\n\n📈 Bonuses:\n${scaling.join("\n")}` : "";
  
  let text = `🧬 *Your Stats*\n\n`;
  text += `🍀 Luck: ${clamped.luck}\n`;
  text += `💪 Strength: ${clamped.strength}\n`;
  text += `🧠 Intelligence: ${clamped.intelligence}\n`;
  text += `🛡️ Defense: ${clamped.defense}\n`;
  text += `━━━━━━━━━━━━━━━\n`;
  text += `🎯 Available Points: ${statPoints}\n`;
  text += `📊 Level: ${level}\n${scaleText}\n\n`;
  text += `💡 Use /upgrade <stat> <points> to spend points`;
  
  return text;
}

// Get fail-safe stats
function getSafeStats(profile) {
  try {
    if (!profile?.statsJson) return { ...DEFAULT_STATS };
    const parsed = JSON.parse(profile.statsJson);
    return clampStats(parsed);
  } catch (e) {
    return { ...DEFAULT_STATS };
  }
}

module.exports = {
  DEFAULT_STATS,
  STAT_POINTS_PER_LEVEL,
  MAX_STAT,
  clampStats,
  getStatBonuses,
  applyStatBonuses,
  rollRareEvent,
  applyLossReduction,
  getStatScalingText,
  validateStatUpgrade,
  canUpgrade,
  getStatDisplayName,
  formatStatsUI,
  getSafeStats
};