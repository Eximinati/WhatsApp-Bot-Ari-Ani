const { createCanvas, loadImage } = require("@napi-rs/canvas");
const canvacord = require("canvacord");
const { formatMoney } = require("./economy-service");

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

const THEMES = {
  economy: {
    bgA: "#10162c",
    bgB: "#1b2f54",
    accent: "#f59e0b",
    accentSoft: "rgba(245, 158, 11, 0.28)",
    chip: "rgba(255,255,255,0.12)",
    deco: "#ffd166",
    caption: "Economy Pulse",
  },
  gamble: {
    bgA: "#1c1027",
    bgB: "#4c1d95",
    accent: "#ef4444",
    accentSoft: "rgba(239, 68, 68, 0.28)",
    chip: "rgba(255,255,255,0.12)",
    deco: "#fb7185",
    caption: "High Stakes",
  },
  games: {
    bgA: "#071b2f",
    bgB: "#0f766e",
    accent: "#38bdf8",
    accentSoft: "rgba(56, 189, 248, 0.25)",
    chip: "rgba(255,255,255,0.12)",
    deco: "#7dd3fc",
    caption: "Play Loop",
  },
  leaderboard: {
    bgA: "#1f1235",
    bgB: "#7c3aed",
    accent: "#f472b6",
    accentSoft: "rgba(244, 114, 182, 0.25)",
    chip: "rgba(255,255,255,0.12)",
    deco: "#f9a8d4",
    caption: "Top Board",
  },
  faction: {
    bgA: "#0c1f1a",
    bgB: "#166534",
    accent: "#4ade80",
    accentSoft: "rgba(74, 222, 128, 0.25)",
    chip: "rgba(255,255,255,0.12)",
    deco: "#86efac",
    caption: "Faction Signal",
  },
  profile: {
    bgA: "#111827",
    bgB: "#334155",
    accent: "#60a5fa",
    accentSoft: "rgba(96, 165, 250, 0.25)",
    chip: "rgba(255,255,255,0.12)",
    deco: "#c4b5fd",
    caption: "Identity Scan",
  },
  islamic: {
    bgA: "#0b1020",
    bgB: "#20434e",
    accent: "#d4af37",
    accentSoft: "rgba(212, 175, 55, 0.22)",
    chip: "rgba(255,255,255,0.12)",
    deco: "#f6e7a1",
    caption: "Noor Panel",
  },
};

class VisualCardService {
  getTheme(theme = "economy") {
    return THEMES[theme] || THEMES.economy;
  }

  async resolveAvatar({ sock, jid, storedAvatarUrl = "" }) {
    try {
      const avatar = await sock.profilePictureUrl(jid, "image");
      return avatar || storedAvatarUrl || "https://placehold.co/512x512/png?text=User";
    } catch {
      return storedAvatarUrl || "https://placehold.co/512x512/png?text=User";
    }
  }

  buildFallbackText(title, lines) {
    return [`*${title}*`, ...lines].join("\n");
  }

  buildCaption(title, lines, footer = "") {
    return [`*${title}*`, ...lines, footer].filter(Boolean).join("\n");
  }

  drawBackground(ctx, width, height, theme) {
    const palette = this.getTheme(theme);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, palette.bgA);
    gradient.addColorStop(1, palette.bgB);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (let index = 0; index < 12; index += 1) {
      ctx.fillStyle = index % 2 === 0 ? palette.accentSoft : "rgba(255,255,255,0.05)";
      ctx.beginPath();
      ctx.ellipse(
        width - 120 - index * 24,
        70 + index * 22,
        110 - index * 5,
        30 - index,
        -0.55,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    for (let index = 0; index < 14; index += 1) {
      ctx.beginPath();
      ctx.moveTo(index * 80, 0);
      ctx.lineTo(index * 80 + 220, height);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.12;
    ctx.fillStyle = palette.deco;
    ctx.font = "bold 94px Sans";
    ctx.fillText("A", width - 140, 120);
    ctx.globalAlpha = 1;

    roundedRect(ctx, 26, 26, width - 52, height - 52, 28);
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawTitle(ctx, theme, title, subtitle = "") {
    const palette = this.getTheme(theme);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "bold 42px Sans";
    ctx.fillText(title, 48, 72);
    ctx.fillStyle = palette.deco;
    ctx.font = "600 18px Sans";
    ctx.fillText(subtitle || palette.caption, 50, 98);
  }

  drawChips(ctx, theme, chips) {
    const palette = this.getTheme(theme);
    let x = 48;
    for (const chip of chips.filter(Boolean).slice(0, 4)) {
      const text = String(chip);
      ctx.font = "600 16px Sans";
      const width = Math.ceil(ctx.measureText(text).width) + 30;
      roundedRect(ctx, x, 118, width, 34, 17);
      ctx.fillStyle = palette.chip;
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(text, x + 15, 140);
      x += width + 10;
    }
  }

  async drawAvatar(ctx, avatarUrl, x, y, size) {
    try {
      const avatar = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, x, y, size, size);
      ctx.restore();
    } catch {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawLines(ctx, lines, x, startY, maxWidth) {
    let y = startY;
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.font = "600 24px Sans";
    for (const line of lines.slice(0, 8)) {
      const safe = String(line);
      const fragments = safe.length > 64
        ? [safe.slice(0, 64), safe.slice(64)]
        : [safe];
      for (const fragment of fragments) {
        ctx.fillText(fragment, x, y, maxWidth);
        y += 34;
      }
    }
  }

  drawSidebar(ctx, theme, panelTitle, stats) {
    const palette = this.getTheme(theme);
    roundedRect(ctx, 620, 52, 230, 396, 24);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fill();
    ctx.fillStyle = palette.deco;
    ctx.font = "700 18px Sans";
    ctx.fillText(panelTitle, 644, 86);

    let y = 118;
    for (const stat of stats.filter(Boolean).slice(0, 5)) {
      roundedRect(ctx, 642, y, 186, 54, 18);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "600 14px Sans";
      ctx.fillText(stat.label, 658, y + 22);
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "700 20px Sans";
      ctx.fillText(stat.value, 658, y + 44);
      y += 66;
    }
  }

  async renderCard({
    title,
    subtitle = "",
    lines = [],
    chips = [],
    stats = [],
    theme = "economy",
    avatarUrl = "",
    panelTitle = "Stats",
  }) {
    const width = 900;
    const height = 500;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    this.drawBackground(ctx, width, height, theme);
    this.drawTitle(ctx, theme, title, subtitle);
    this.drawChips(ctx, theme, chips);
    if (avatarUrl) {
      await this.drawAvatar(ctx, avatarUrl, 52, 188, 112);
    }
    this.drawLines(ctx, lines, avatarUrl ? 190 : 52, 202, 390);
    this.drawSidebar(ctx, theme, panelTitle, stats);

    return canvas.toBuffer("image/png");
  }

  async sendImageBuffer({ ctx, image, caption = "", fallbackText = "", mentions = [] }) {
    try {
      await ctx.send(
        ctx.msg.from,
        {
          image,
          caption,
          mentions,
        },
        { quoted: ctx.msg.raw },
      );
    } catch {
      await ctx.reply(fallbackText);
    }
  }

  async sendThemeCard({
    ctx,
    title,
    lines,
    theme = "economy",
    caption = "",
    mentions = [],
    stats = [],
    chips = [],
    subtitle = "",
    panelTitle = "Stats",
    avatarUrl = "",
    fallbackTitle = "",
  }) {
    const fallbackText = this.buildFallbackText(fallbackTitle || title, lines);
    try {
      const image = await this.renderCard({
        title,
        subtitle,
        lines,
        chips,
        stats,
        theme,
        avatarUrl,
        panelTitle,
      });
      await this.sendImageBuffer({
        ctx,
        image,
        caption: caption || this.buildCaption(title, lines),
        fallbackText,
        mentions,
      });
    } catch {
      await ctx.reply(fallbackText);
    }
  }

  async sendQuoteCard({
    ctx,
    title,
    lines,
    caption = "",
    mentions = [],
    theme = "games",
    jid,
    storedAvatarUrl = "",
    username = "",
    color = "",
  }) {
    const avatarUrl = jid
      ? await this.resolveAvatar({
        sock: ctx.sock,
        jid,
        storedAvatarUrl,
      })
      : "";

    await this.sendThemeCard({
      ctx,
      title,
      lines,
      theme,
      caption,
      mentions,
      subtitle: username || color || "",
      avatarUrl,
      chips: [username || "", theme.toUpperCase()],
      stats: lines.slice(0, 4).map((line, index) => ({
        label: index === 0 ? "Outcome" : `Info ${index}`,
        value: String(line).slice(0, 24),
      })),
    });
  }

  async sendEconomyResultCard({
    ctx,
    title,
    lines,
    caption = "",
    mentions = [],
    jid,
    storedAvatarUrl = "",
    chips = [],
    stats = [],
    subtitle = "",
  }) {
    const avatarUrl = jid
      ? await this.resolveAvatar({ sock: ctx.sock, jid, storedAvatarUrl })
      : "";

    await this.sendThemeCard({
      ctx,
      title,
      lines,
      theme: "economy",
      caption,
      mentions,
      chips,
      stats,
      subtitle,
      avatarUrl,
      panelTitle: "Economy",
    });
  }

  async sendGambleCard({
    ctx,
    title,
    lines,
    caption = "",
    mentions = [],
    jid,
    storedAvatarUrl = "",
    chips = [],
    stats = [],
    subtitle = "",
  }) {
    const avatarUrl = jid
      ? await this.resolveAvatar({ sock: ctx.sock, jid, storedAvatarUrl })
      : "";

    await this.sendThemeCard({
      ctx,
      title,
      lines,
      theme: "gamble",
      caption,
      mentions,
      chips,
      stats,
      subtitle,
      avatarUrl,
      panelTitle: "Odds",
    });
  }

  async sendLeaderboardCard({
    ctx,
    title,
    lines,
    caption = "",
    username = "",
    jid = "",
    storedAvatarUrl = "",
  }) {
    const avatarUrl = jid
      ? await this.resolveAvatar({ sock: ctx.sock, jid, storedAvatarUrl })
      : "";

    await this.sendThemeCard({
      ctx,
      title,
      lines,
      theme: "leaderboard",
      caption,
      subtitle: username,
      avatarUrl,
      chips: ["TOP 10", username || ""],
      stats: lines.slice(0, 5).map((line, index) => ({
        label: `Rank ${index + 1}`,
        value: String(line).slice(0, 24),
      })),
      panelTitle: "Board",
    });
  }

  async sendFactionCard({
    ctx,
    title,
    lines,
    caption = "",
    mentions = [],
    chips = [],
    stats = [],
    subtitle = "",
  }) {
    await this.sendThemeCard({
      ctx,
      title,
      lines,
      theme: "faction",
      caption,
      mentions,
      chips,
      stats,
      subtitle,
      panelTitle: "Faction",
    });
  }

  async sendProfileCard({
    ctx,
    jid,
    title,
    lines,
    storedAvatarUrl = "",
    caption = "",
    mentions = [],
  }) {
    const avatar = await this.resolveAvatar({
      sock: ctx.sock,
      jid,
      storedAvatarUrl,
    });

    await this.sendImageBuffer({
      ctx,
      image: { url: avatar },
      caption: caption || this.buildCaption(title, lines),
      fallbackText: this.buildFallbackText(title, lines),
      mentions,
    });
  }

  async sendRankCard({
    ctx,
    displayName,
    jid,
    rank,
    wealth = 0,
    storedAvatarUrl = "",
  }) {
    try {
      const avatar = await this.resolveAvatar({
        sock: ctx.sock,
        jid,
        storedAvatarUrl,
      });
      const discriminator = String(jid || "").split("@")[0].slice(-4) || "0000";
      const image = await new canvacord.Rank()
        .setAvatar(avatar)
        .setCurrentXP(rank.currentXp)
        .setRequiredXP(rank.nextLevelXp)
        .setLevel(rank.level)
        .setUsername(displayName)
        .setDiscriminator(discriminator)
        .setRank(0, rank.rankTitle, false)
        .setBackground("COLOR", "#162033")
        .setProgressBar("#38bdf8", "COLOR")
        .build();

      await this.sendImageBuffer({
        ctx,
        image,
        caption: `${displayName} | Level ${rank.level} | XP ${rank.currentXp}/${rank.nextLevelXp} | Wealth ${formatMoney(wealth)}`,
        fallbackText: `Rank: level ${rank.level}\nXP: ${rank.currentXp}/${rank.nextLevelXp}\nRole: ${rank.rankTitle}\nWealth: ${formatMoney(wealth)}`,
      });
    } catch {
      await ctx.reply(
        `Rank: level ${rank.level}\nXP: ${rank.currentXp}/${rank.nextLevelXp}\nRole: ${rank.rankTitle}\nWealth: ${formatMoney(wealth)}`,
      );
    }
  }

  async sendQuranAyahCard({
    ctx,
    title,
    lines,
    image = null,
    caption = "",
    mentions = [],
    chips = [],
    stats = [],
    subtitle = "",
  }) {
    const fallbackText = this.buildFallbackText(title, lines);
    if (image) {
      await this.sendImageBuffer({
        ctx,
        image,
        caption: caption || this.buildCaption(title, lines),
        fallbackText,
        mentions,
      });
      return;
    }

    await this.sendThemeCard({
      ctx,
      title,
      lines,
      theme: "islamic",
      caption,
      mentions,
      chips,
      stats,
      subtitle,
      panelTitle: "Quran",
    });
  }

  async sendHadithCard({
    ctx,
    title,
    lines,
    caption = "",
    mentions = [],
    chips = [],
    stats = [],
    subtitle = "",
  }) {
    await this.sendThemeCard({
      ctx,
      title,
      lines,
      theme: "islamic",
      caption,
      mentions,
      chips,
      stats,
      subtitle,
      panelTitle: "Hadith",
    });
  }

  async sendPrayerCard({
    ctx,
    title,
    lines,
    caption = "",
    mentions = [],
    chips = [],
    stats = [],
    subtitle = "",
  }) {
    await this.sendThemeCard({
      ctx,
      title,
      lines,
      theme: "islamic",
      caption,
      mentions,
      chips,
      stats,
      subtitle,
      panelTitle: "Prayer",
    });
  }

  async sendDuaCard({
    ctx,
    title,
    lines,
    caption = "",
    mentions = [],
    chips = [],
    stats = [],
    subtitle = "",
  }) {
    await this.sendThemeCard({
      ctx,
      title,
      lines,
      theme: "islamic",
      caption,
      mentions,
      chips,
      stats,
      subtitle,
      panelTitle: "Dua",
    });
  }

  async sendIslamicAnswerCard({
    ctx,
    title,
    lines,
    caption = "",
    mentions = [],
    chips = [],
    stats = [],
    subtitle = "",
  }) {
    await this.sendThemeCard({
      ctx,
      title,
      lines,
      theme: "islamic",
      caption,
      mentions,
      chips,
      stats,
      subtitle,
      panelTitle: "Sources",
    });
  }
}

module.exports = {
  VisualCardService,
};
