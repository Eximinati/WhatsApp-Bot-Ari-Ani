class GroupMetadataCacheService {
  constructor({ logger }) {
    this.logger = logger;
    this.cache = new Map();
  }

  normalizeMetadata(metadata) {
    return metadata;
  }

  get(jid) {
    return this.cache.get(jid) || null;
  }

  set(jid, metadata) {
    if (!jid || !metadata) {
      return null;
    }

    const resolvedJid = metadata.id || jid;
    const normalized = this.normalizeMetadata(metadata);
    this.cache.set(resolvedJid, normalized);
    return normalized;
  }

  async getOrFetch(sock, jid) {
    const cached = this.get(jid);
    if (cached) {
      return cached;
    }

    try {
      const metadata = await sock.groupMetadata(jid);
      this.set(jid, metadata);
      return metadata;
    } catch (error) {
      if (error?.message === "forbidden" || error?.statusCode === 500) {
        this.logger.info({ jid }, "Group metadata not yet available (bot may have just joined)");
      } else {
        this.logger.warn({ error, jid }, "Failed to fetch group metadata");
      }
      return null;
    }
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
      // "forbidden" is expected right after bot joins a group — metadata
      // access hasn't propagated yet. Log at info level, not warn.
      if (error?.message === "forbidden" || error?.statusCode === 500) {
        this.logger.info({ jid }, "Group metadata not yet available (bot may have just joined)");
      } else {
        this.logger.warn({ error, jid }, "Failed to refresh group metadata");
      }
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
