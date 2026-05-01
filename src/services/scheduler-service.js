const constants = require("../config/constants");
const { formatDateTime, resolveTimezone, startOfTodayKey } = require("../utils/schedule");
const { extract } = require("../utils/identity-resolver");

class SchedulerService {
  constructor({ config, logger, services, getSocket }) {
    this.config = config;
    this.logger = logger;
    this.services = services;
    this.getSocket = getSocket;
    this.timer = null;
    this.runningTick = false;
    this.lastVuSyncAt = 0;
  }

  start() {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      this.tick().catch((error) => {
        this.logger.error({ area: "SCHED", error }, "Scheduler tick failed");
      });
    }, constants.scheduler.tickIntervalMs);
  }

  stop() {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this.runningTick) {
      return;
    }

    const sock = this.getSocket();
    if (!sock) {
      return;
    }

    this.runningTick = true;
    try {
      await this.processReminders(sock);

      if (Date.now() - this.lastVuSyncAt >= constants.scheduler.vuSyncIntervalMs) {
        await this.processVuAlerts(sock);
        this.lastVuSyncAt = Date.now();
      }
    } finally {
      this.runningTick = false;
    }
  }

  async processReminders(sock) {
    const dueReminders = await this.services.reminders.getDueReminders();
    for (const reminder of dueReminders) {
      const targetJid = reminder.delivery === "dm" ? reminder.userJid : reminder.chatJid;

      try {
        await sock.sendMessage(targetJid, {
          text: `Reminder: ${reminder.text}\nScheduled for ${formatDateTime(
            reminder.triggerAt,
            reminder.timezone || this.config.timezone,
          )}`,
        });
        await this.services.reminders.markSent(reminder);
        this.logger.info(
          {
            area: "REMINDER",
            user: extract(reminder.userJid),
            delivery: reminder.delivery,
            reminderId: String(reminder._id).slice(-6),
          },
          "Reminder delivered",
        );
      } catch (error) {
        await this.services.reminders.markFailed(reminder, error);
        this.logger.warn(
          {
            area: "REMINDER",
            reminderId: String(reminder._id).slice(-6),
            error,
          },
          "Reminder delivery failed",
        );
      }
    }
  }

  async processVuAlerts(sock) {
    const accounts = await this.services.vu.getAccountsForAlerts();
    for (const account of accounts) {
      try {
        const alertSettings = this.services.vu.getAlertSettings(account);
        if (!alertSettings.dailyDigestEnabled && !alertSettings.deadlineReminderMinutes.length) {
          continue;
        }

        const { assignments } = await this.services.vu.sync(account.userJid);
        const userSettings = await this.services.settings.getUserSettings(account.userJid);
        const timezone = resolveTimezone(this.config, userSettings);
        const todayKey = startOfTodayKey(timezone);

        if (
          alertSettings.dailyDigestEnabled &&
          account.lastDigestOn !== todayKey &&
          assignments.length
        ) {
          const lines = ["*VU Daily Digest*"];
          for (const item of assignments.slice(0, 5)) {
            lines.push(`- ${item.title} (${item.dueText || "no due date"})`);
          }
          await sock.sendMessage(account.userJid, { text: lines.join("\n") });
          await this.services.vu.markDailyDigestSent(account, todayKey);
          this.logger.info(
             { area: "VU", user: extract(account.userJid) },
             "VU daily digest sent",
          );
        }

        const existing = new Set(JSON.parse(account.notifiedKeysJson || "[]"));
        const deadlineSoon = this.services.vu.getPendingDeadlineReminders(
          assignments,
          alertSettings.deadlineReminderMinutes,
          existing,
          new Date(),
        );
        if (deadlineSoon.length) {
          const lines = ["*VU Deadline Reminder*"];
          for (const item of deadlineSoon.slice(0, 5)) {
            lines.push(
              `- ${item.title} (${item.dueText || formatDateTime(item.dueAt, timezone)}) - ${item.reminderLabel} before`,
            );
          }
          await sock.sendMessage(account.userJid, { text: lines.join("\n") });
          await this.services.vu.markDeadlineKeys(
            account,
            deadlineSoon.map((item) => item.notificationKey),
          );
          this.logger.info(
             { area: "VU", user: extract(account.userJid), count: deadlineSoon.length },
            "VU deadline alerts sent",
          );
        }
      } catch (error) {
        this.logger.warn(
           { area: "VU", user: extract(account.userJid), error },
          "VU scheduled sync failed",
        );
      }
    }
  }
}

module.exports = {
  SchedulerService,
};
