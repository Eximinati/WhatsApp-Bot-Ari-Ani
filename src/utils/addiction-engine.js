const STREAK_BONUS_PER_STREAK = 0.05;
const MAX_STREAK_BONUS = 0.5;

function getStreakBonus(streakCount) {
  const bonus = Math.min(streakCount * STREAK_BONUS_PER_STREAK, MAX_STREAK_BONUS);
  return Math.round(bonus * 100);
}

function getStreakText(streakCount) {
  if (streakCount <= 0) return "";
  const bonus = getStreakBonus(streakCount);
  return bonus > 0 ? `🔥 Streak: +${bonus}%` : "";
}

const ANTICIPATION_LINES = {
  fish: [
    "Casting line...",
    "Waiting for a bite...",
    "Something feels lucky...",
    "Reeling in...",
  ],
  mine: [
    "Digging deep...",
    "Searching for ore...",
    "The earth whispers...",
    "Almost there...",
  ],
  hunt: [
    "Tracking prey...",
    "Stalking the wild...",
    "Senses tingling...",
    "Preparing to strike...",
  ],
  work: [
    "Getting to work...",
    "Focusing energy...",
    "Building momentum...",
    "Making progress...",
  ],
  beg: [
    "Hoping for kindness...",
    "Someone will respond...",
    "Patiently waiting...",
    "Feeling hopeful...",
  ],
};

function getAnticipationLine(domain) {
  const lines = ANTICIPATION_LINES[domain] || ANTICIPATION_LINES.work;
  return lines[Math.floor(Math.random() * lines.length)];
}

const COOLDOWN_PSYCHOLOGY = {
  veryFresh: [
    "Energy recharging... ⚡",
    "Building momentum...",
    "Preparing for next...",
  ],
  almostReady: [
    "Almost ready! 🎯",
    "Just a moment more...",
    "Feel that energy rising...",
  ],
  halfway: [
    "Getting anxious...",
    "Patience pays off...",
    "Good things take time...",
  ],
};

function getCooldownPsychology(remainingMs, totalMs) {
  const ratio = 1 - (remainingMs / totalMs);
  if (ratio > 0.8 && ratio <= 1.0) {
    return COOLDOWN_PSYCHOLOGY.almostReady[Math.floor(Math.random() * COOLDOWN_PSYCHOLOGY.almostReady.length)];
  }
  if (ratio > 0.4) {
    return COOLDOWN_PSYCHOLOGY.halfway[Math.floor(Math.random() * COOLDOWN_PSYCHOLOGY.halfway.length)];
  }
  return COOLDOWN_PSYCHOLOGY.veryFresh[Math.floor(Math.random() * COOLDOWN_PSYCHOLOGY.veryFresh.length)];
}

const SUCCESS_HOOKS = [
  "Try again for streak bonus! 🔥",
  "Momentum is building! Keep going!",
  "You're on fire! One more!",
  "The universe conspires with you!",
];

const FAIL_HOOKS = [
  "Redeem yourself with another try! 💪",
  "Everyone stumbles. Try again!",
  "The hunt continues... Don't give up!",
  "A setback before the triumph!",
];

function getSuccessHook() {
  return SUCCESS_HOOKS[Math.floor(Math.random() * SUCCESS_HOOKS.length)];
}

function getFailHook() {
  return FAIL_HOOKS[Math.floor(Math.random() * FAIL_HOOKS.length)];
}

const NEAR_MISS_LINES = [
  "So close! The fish escaped!",
  "Almost had it!",
  "That one got away...",
  "Almost rare! Next time...",
  "Missed by that much!",
];

function getNearMissLine() {
  return NEAR_MISS_LINES[Math.floor(Math.random() * NEAR_MISS_LINES.length)];
}

const SESSION_HOOKS = {
  afterSuccessStreak: [
    "🔥 {streak} streak! +{bonus}% bonus active!",
    "Keep it going! {streak} in a row!",
    "You're unstoppable! {streak}x streak!",
  ],
  afterFail: [
    "Streak reset. Start fresh! 💫",
    "New streak opportunity!",
    "Every attempt counts!",
  ],
  afterCooldown: [
    "Ready for another go? ⚡",
    "Your energy returned!",
    "Let's try again!",
  ],
};

function getSessionHook(type, data = {}) {
  const hooks = SESSION_HOOKS[type] || [];
  let line = hooks[Math.floor(Math.random() * hooks.length)];
  if (line && data.streak) {
    line = line.replace(/{streak}/g, data.streak);
    line = line.replace(/{bonus}/g, data.bonus || 0);
  }
  return line;
}

const TIER_NAMES = [
  "Beggar", "Novice", "Apprentice", "Journeyman", "Expert", "Master", "Grandmaster", "Legend"
];

function getCurrentTier(level) {
  const tierIndex = Math.floor(level / 5);
  return TIER_NAMES[Math.min(tierIndex, TIER_NAMES.length - 1)];
}

function getProgressToNextTier(currentXp, level) {
  const xpForNextTier = (level + 1) * 5 * ((level + 1) + 1) + 50 * (level + 1) + 100;
  const currentTierXp = level * 5 * (level + 1) + 50 * level + 100;
  const xpInCurrentTier = currentXp - currentTierXp;
  const xpNeededForNextTier = xpForNextTier - currentTierXp;
  const progress = Math.round((xpInCurrentTier / xpNeededForNextTier) * 100);
  return Math.min(100, Math.max(0, progress));
}

const RARE_CHANCE_PSYCHOLOGY = {
  low: [
    "Something feels off...",
    "The odds are gathering...",
    "A disturbance in the waters...",
  ],
  medium: [
    "You're feeling lucky...",
    "The universe notices you...",
    "Something sparkles nearby...",
  ],
  high: [
    "ALMOST RARE! ✨",
    "You feel a presence...",
    "The rarest is near!",
  ],
};

function getRarePsychology(rareChance) {
  if (rareChance > 0.1) {
    return RARE_CHANCE_PSYCHOLOGY.high[Math.floor(Math.random() * RARE_CHANCE_PSYCHOLOGY.high.length)];
  }
  if (rareChance > 0.04) {
    return RARE_CHANCE_PSYCHOLOGY.medium[Math.floor(Math.random() * RARE_CHANCE_PSYCHOLOGY.medium.length)];
  }
  return RARE_CHANCE_PSYCHOLOGY.low[Math.floor(Math.random() * RARE_CHANCE_PSYCHOLOGY.low.length)];
}

const FAKE_RARE_REVEALS = [
  "Was that...? Nope. Just a fish.",
  "Almost! But no.",
  "Something glimmered... got away.",
  "You saw it too, right? Gone now.",
];

function getFakeRareReveal() {
  return FAKE_RARE_REVEALS[Math.floor(Math.random() * FAKE_RARE_REVEALS.length)];
}

function getStreakTier(streak) {
  if (streak >= 10) return "🔥🔥🔥 On Fire";
  if (streak >= 6) return "🔥🔥 Hot";
  if (streak >= 3) return "🔥 Warm";
  return null;
}

function getStreakTierText(streak) {
  const tier = getStreakTier(streak);
  if (!tier) return streak > 0 ? `🔥 Streak: ${streak}` : "";
  return `🔥 Streak: ${streak} (${tier})`;
}

function getRareMeterDisplay(rareMeter) {
  const percent = Math.floor(rareMeter);
  const filled = Math.floor(percent / 10);
  const empty = 10 - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `✨ Rare Meter: [${bar}] ${percent}%`;
}

const NEAR_RARE_MESSAGES = {
  close: [
    "✨ You feel something rare nearby...",
    "Something valuable is close...",
    "The odds are shifting in your favor...",
  ],
  veryClose: [
    "⚡ Almost there. Something big is coming.",
    "💎 You can almost touch it...",
    "🔥 The energy is palpable...",
  ],
};

function getNearRareMessage(rareMeter, triggeredRare) {
  if (triggeredRare) return null;
  if (rareMeter > 90) {
    return NEAR_RARE_MESSAGES.veryClose[Math.floor(Math.random() * NEAR_RARE_MESSAGES.veryClose.length)];
  }
  if (rareMeter > 70) {
    return NEAR_RARE_MESSAGES.close[Math.floor(Math.random() * NEAR_RARE_MESSAGES.close.length)];
  }
  return null;
}

const FAILURE_PSYCHOLOGY = {
  fish: [
    "The fish slipped at the last second...",
    "Your line snapped!",
    "It was right there...",
    "Almost had it!",
  ],
  mine: [
    "You almost struck something valuable...",
    "The vein ran out...",
    "Just rocks this time...",
    "So close to ore!",
  ],
  hunt: [
    "Your prey escaped...",
    "The trail went cold...",
    "Right at the finish line...",
    "Almost had your catch!",
  ],
  work: [
    "The opportunity slipped away...",
    "Almost landed that deal...",
    "Better luck next shift...",
    "So close to a bonus!",
  ],
  beg: [
    "No one responded this time...",
    "Perhaps next time...",
    "The crowd walked past...",
    "So close to a handout!",
  ],
};

function getFailurePsychology(domain) {
  if (Math.random() > 0.7) return null;
  const lines = FAILURE_PSYCHOLOGY[domain] || FAILURE_PSYCHOLOGY.work;
  return lines[Math.floor(Math.random() * lines.length)];
}

const MOMENTUM_TIERS = [
  { min: 1, label: "x1" },
  { min: 3, label: "x2" },
  { min: 5, label: "x3" },
  { min: 8, label: "x4" },
  { min: 12, label: "x5" },
];

function getMomentumText(sessionCount) {
  if (!sessionCount || sessionCount < 1) return null;
  let label = "x1";
  for (let i = MOMENTUM_TIERS.length - 1; i >= 0; i--) {
    if (sessionCount >= MOMENTUM_TIERS[i].min) {
      label = MOMENTUM_TIERS[i].label;
      break;
    }
  }
  return `⚡ Momentum: ${label}`;
}

const RARE_BUILDUP_MESSAGES = {
  20: "Something feels different...",
  40: "You feel luck shifting...",
  60: "The odds are turning...",
  80: "Something rare is close...",
};

function getRareBuildupMessage(rareMeter, triggeredRare) {
  if (triggeredRare || rareMeter < 20) return null;
  for (const [threshold, message] of Object.entries(RARE_BUILDUP_MESSAGES)) {
    if (rareMeter >= parseInt(threshold) && rareMeter < parseInt(threshold) + 20) {
      return message;
    }
  }
  return null;
}

const LOSS_AVERSION_HOOKS = {
  due: [
    "You're due for a win...",
    "Luck is about to turn...",
    "Don't stop now...",
    "The odds are in your favor...",
  ],
  hungry: [
    "Keep pushing.Big rewards come to those who persist.",
    "One more try. The universe is listening.",
    "You're so close to something big...",
    "Every attempt brings you nearer...",
  ],
};

function getLossAversionHook(failStreak) {
  if (!failStreak || failStreak < 2) return null;
  if (failStreak >= 4) {
    return LOSS_AVERSION_HOOKS.hungry[Math.floor(Math.random() * LOSS_AVERSION_HOOKS.hungry.length)];
  }
  return LOSS_AVERSION_HOOKS.due[Math.floor(Math.random() * LOSS_AVERSION_HOOKS.due.length)];
}

const NEXT_ACTION_HOOKS = {
  highRareMeter: [
    "One more… you're close.",
    "Don't let up now...",
    "The rare is practically yours...",
  ],
  onStreak: [
    "Don't break your streak now!",
    "Keep the fire burning!",
    "One more makes it bigger!",
  ],
  afterFail: [
    "Run it back.",
    "New attempt, same goal!",
    "Try again. Success favors the bold!",
  ],
  afterWin: [
    "Momentum is real. Don't waste it!",
    "You're hot! Keep going!",
    "Ride this wave!",
  ],
  afterRare: [
    "That was huge. Imagine another?",
    "Rare hits don't stop. Play again!",
    "Fortune favors the bold...",
  ],
  cooldown: [
    "Your patience will be rewarded.",
    "Rest now, strike later.",
    "Prepare for your next move...",
  ],
};

function getNextActionHook(context) {
  const { 
    rareMeter = 0, 
    streak = 0, 
    failStreak = 0, 
    lastResult = "",
    triggeredRare = false,
    onCooldown = false 
  } = context;

  if (onCooldown) {
    return NEXT_ACTION_HOOKS.cooldown[Math.floor(Math.random() * NEXT_ACTION_HOOKS.cooldown.length)];
  }
  if (triggeredRare) {
    return NEXT_ACTION_HOOKS.afterRare[Math.floor(Math.random() * NEXT_ACTION_HOOKS.afterRare.length)];
  }
  if (rareMeter >= 70) {
    return NEXT_ACTION_HOOKS.highRareMeter[Math.floor(Math.random() * NEXT_ACTION_HOOKS.highRareMeter.length)];
  }
  if (streak >= 3) {
    return NEXT_ACTION_HOOKS.onStreak[Math.floor(Math.random() * NEXT_ACTION_HOOKS.onStreak.length)];
  }
  if (lastResult === "fail" || failStreak >= 2) {
    return NEXT_ACTION_HOOKS.afterFail[Math.floor(Math.random() * NEXT_ACTION_HOOKS.afterFail.length)];
  }
  if (lastResult === "win") {
    return NEXT_ACTION_HOOKS.afterWin[Math.floor(Math.random() * NEXT_ACTION_HOOKS.afterWin.length)];
  }
  return NEXT_ACTION_HOOKS.afterWin[Math.floor(Math.random() * NEXT_ACTION_HOOKS.afterWin.length)];
}

const MINI_JACKPOT_MESSAGES = [
  "💫 Something almost happened...",
  "✨ Almost! You felt that?",
  "⚡ So close it tingled...",
  "💎 Something shimmered in the distance...",
];

function getMiniJackpotIllusion(rareMeter, triggeredRare) {
  if (triggeredRare) return null;
  if (rareMeter >= 85) {
    return MINI_JACKPOT_MESSAGES[Math.floor(Math.random() * MINI_JACKPOT_MESSAGES.length)];
  }
  return null;
}

const FAIL_BIAS_TEXTS = {
  due: "…you're due for a win.",
  shifting: "…luck is shifting.",
};

function getFailBiasText(failStreak) {
  if (failStreak >= 3) return FAIL_BIAS_TEXTS.due;
  if (failStreak === 2) return FAIL_BIAS_TEXTS.shifting;
  return null;
}

module.exports = {
  getStreakBonus,
  getStreakText,
  getStreakTier,
  getStreakTierText,
  getRareMeterDisplay,
  getNearRareMessage,
  getFailurePsychology,
  getMomentumText,
  getRareBuildupMessage,
  getLossAversionHook,
  getLossAversionHook,
  getNextActionHook,
  getMiniJackpotIllusion,
  getFailBiasText,
  getAnticipationLine,
  getCooldownPsychology,
  getSuccessHook,
  getFailHook,
  getNearMissLine,
  getSessionHook,
  getCurrentTier,
  getProgressToNextTier,
  getRarePsychology,
  getFakeRareReveal,
};