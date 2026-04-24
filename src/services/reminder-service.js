const Reminder = require("../models/reminder");
const { formatDateTime, parseScheduleInput } = require("../utils/schedule");

class ReminderService {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
  }

  async createReminder({ userJid, chatJid, delivery, text, scheduleInput, timezone }) {
    const parsed = parseScheduleInput(scheduleInput, timezone);
    if (!parsed || !parsed.isValid() || parsed.toDate().getTime() <= Date.now()) {
      throw new Error("Invalid reminder time.");
    }

    return Reminder.create({
      userJid,
      chatJid,
      delivery,
      text,
      timezone,
      triggerAt: parsed.toDate(),
    });
  }

  async listReminders(userJid) {
    return Reminder.find({
      userJid,
      status: "pending",
    })
      .sort({ triggerAt: 1 })
      .lean();
  }

  async cancelReminder(userJid, id) {
    const reminder = await this.findUserReminderBySuffix(userJid, id);
    if (!reminder) {
      return null;
    }

    return Reminder.findOneAndUpdate(
      { _id: reminder._id, userJid, status: "pending" },
      {
        $set: {
          status: "cancelled",
          cancelledAt: new Date(),
        },
      },
      { new: true },
    );
  }

  async snoozeReminder(userJid, id, scheduleInput, timezone) {
    const parsed = parseScheduleInput(scheduleInput, timezone);
    if (!parsed || !parsed.isValid()) {
      throw new Error("Invalid reminder time.");
    }

    const reminder = await this.findUserReminderBySuffix(userJid, id);
    if (!reminder) {
      return null;
    }

    return Reminder.findOneAndUpdate(
      { _id: reminder._id, userJid },
      {
        $set: {
          status: "pending",
          triggerAt: parsed.toDate(),
          cancelledAt: null,
          sentAt: null,
          lastError: "",
        },
      },
      { new: true },
    );
  }

  async getDueReminders(now = new Date()) {
    return Reminder.find({
      status: "pending",
      triggerAt: { $lte: now },
    }).sort({ triggerAt: 1 });
  }

  async markSent(reminder) {
    reminder.status = "sent";
    reminder.sentAt = new Date();
    reminder.lastError = "";
    await reminder.save();
  }

  async markFailed(reminder, error) {
    reminder.lastError = error?.message || String(error || "Unknown error");
    await reminder.save();
  }

  formatReminder(reminder) {
    return `#${String(reminder._id).slice(-6)} at ${formatDateTime(
      reminder.triggerAt,
      reminder.timezone || this.config.timezone,
    )} via ${reminder.delivery}`;
  }

  async findUserReminderBySuffix(userJid, suffix) {
    const reminders = await Reminder.find({ userJid, status: "pending" }).lean();
    return reminders.find((reminder) =>
      String(reminder._id).toLowerCase().endsWith(String(suffix || "").toLowerCase()),
    ) || null;
  }
}

module.exports = {
  ReminderService,
};
