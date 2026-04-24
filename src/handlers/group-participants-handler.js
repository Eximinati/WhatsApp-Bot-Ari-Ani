const constants = require("../config/constants");

function applyTemplate(template, values) {
  return template.replaceAll(/\{\{(\w+)\}\}/g, (_, key) => values[key] || "");
}

function createGroupParticipantsHandler({ logger, services, groupMetadataCache }) {
  return async function handleGroupParticipantsUpdate(sock, update) {
    try {
      const settings = await services.settings.getGroupSettings(update.id);
      if (!settings.welcomeEnabled) {
        await groupMetadataCache.refresh(sock, update.id);
        return;
      }

      const metadata = await groupMetadataCache.refresh(sock, update.id);

      for (const participant of update.participants) {
        const name = participant.split("@")[0];
        const values = {
          name,
          group: metadata.subject || "this group",
          description: metadata.desc || "",
        };
        const template =
          update.action === "add"
            ? settings.welcomeTemplate || constants.groups.welcomeTemplate
            : constants.groups.farewellTemplate;
        const text = applyTemplate(template, values);

        await sock.sendMessage(update.id, {
          text,
          mentions: [participant],
        });
      }
    } catch (error) {
      logger.error({ error, update }, "Failed to process group participants update");
    }
  };
}

module.exports = {
  createGroupParticipantsHandler,
};
