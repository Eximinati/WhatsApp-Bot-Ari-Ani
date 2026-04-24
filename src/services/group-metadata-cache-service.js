class GroupMetadataCacheService {
  constructor({ logger }) {
    this.logger = logger;
    this.cache = new Map();
  }

  get(jid) {
    return this.cache.get(jid) || null;
  }

  set(jid, metadata) {
    if (!jid || !metadata) {
      return null;
    }

    const resolvedJid = metadata.id || jid;
    this.cache.set(resolvedJid, metadata);
    return metadata;
  }

  async getOrFetch(sock, jid) {
    const cached = this.get(jid);
    if (cached) {
      return cached;
    }

    const metadata = await sock.groupMetadata(jid);
    this.set(jid, metadata);
    return metadata;
  }

  async refresh(sock, jid) {
    if (!jid) {
      return null;
    }

    try {
      const metadata = await sock.groupMetadata(jid);
      this.set(jid, metadata);
      return metadata;
    } catch (error) {
      this.logger.warn({ error, jid }, "Failed to refresh group metadata");
      return this.get(jid);
    }
  }

  async handleGroupsUpdate(sock, updates) {
    for (const update of updates || []) {
      if (update?.id) {
        await this.refresh(sock, update.id);
      }
    }
  }

  handleGroupsUpsert(upserts) {
    for (const metadata of upserts || []) {
      if (metadata?.id) {
        this.set(metadata.id, metadata);
      }
    }
  }
}

module.exports = {
  GroupMetadataCacheService,
};
