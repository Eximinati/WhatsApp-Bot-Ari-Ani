const { formatMoney } = require("../../services/economy-service");

module.exports = {
  meta: {
    name: "job",
    aliases: [],
    category: "economy",
    description: "Show your job or switch to a new one.",
    cooldownSeconds: 3,
    access: "user",
    chat: "both",
    usage: "<show|set> [job-key]",
  },
  async execute(ctx) {
    const action = String(ctx.args[0] || "show").trim().toLowerCase();

    if (action === "show") {
      const result = await ctx.services.economy.getJobsState(ctx.msg.sender);
      if (!result.currentJob) {
        await ctx.reply(`You do not have a job yet. Use ${ctx.config.prefix}jobs to browse and ${ctx.config.prefix}job set <job-key> to choose one.`);
        return;
      }

      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: "CURRENT JOB",
        jid: ctx.msg.sender,
        lines: [
          `Role: ${result.currentJob.name}`,
          `Key: ${result.currentJob.key}`,
          result.currentJob.description,
        ],
        subtitle: "Economy specialization",
        chips: ["Jobs", result.currentJob.key],
        stats: [
          { label: "Role", value: result.currentJob.name },
          { label: "Key", value: result.currentJob.key },
        ],
      });
      return;
    }

    if (action !== "set" || !ctx.args[1]) {
      await ctx.reply(`Usage: ${ctx.config.prefix}job <show|set> [job-key]`);
      return;
    }

    try {
      const result = await ctx.services.economy.setJob(ctx.msg.sender, ctx.args[1]);
      await ctx.services.visuals.sendEconomyResultCard({
        ctx,
        title: "JOB SWITCHED",
        jid: ctx.msg.sender,
        lines: [
          `New role: ${result.job.name}`,
          `Key: ${result.job.key}`,
          result.job.description,
        ],
        subtitle: "Loadout updated",
        chips: ["Jobs", result.job.key],
        stats: [
          { label: "Role", value: result.job.name },
          { label: "Wallet", value: formatMoney(result.account.wallet) },
        ],
      });
    } catch (error) {
      await ctx.reply(error.message);
    }
  },
};
