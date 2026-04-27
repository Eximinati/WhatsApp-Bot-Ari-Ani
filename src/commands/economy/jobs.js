module.exports = {
  meta: {
    name: "jobs",
    aliases: [],
    category: "economy",
    description: "Browse all available economy jobs.",
    cooldownSeconds: 4,
    access: "user",
    chat: "both",
    usage: "",
  },
  async execute(ctx) {
    const result = await ctx.services.economy.getJobsState(ctx.msg.sender);
    const lines = result.jobs.map((job, index) => {
      const current = result.currentJob?.key === job.key ? " [ACTIVE]" : "";
      return `${index + 1}. ${job.name} (${job.key})${current} - ${job.description}`;
    });

    await ctx.services.visuals.sendLeaderboardCard({
      ctx,
      title: "JOB BOARD",
      jid: ctx.msg.sender,
      username: await ctx.services.user.getDisplayName(ctx.msg.sender),
      lines,
      caption: `Use ${ctx.config.prefix}job set <job-key> to switch roles.`,
    });
  },
};
