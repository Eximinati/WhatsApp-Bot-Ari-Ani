/**
 * Identity Resolver — establishes a SINGLE identity per user across all
 * WhatsApp JID/LID formats. The rule: every user has ONE canonical phone
 * number. LIDs are discovered via user interaction and linked to phones.
 *
 * Persistence:
 * - In-memory Map for fast lookups (survives within process)
 * - Optional DB-backed persistence via initIdentityResolver()
 */
const userMap = new Map();
let identityStore = null;
let logger = null;

function setLogger(l) {
  logger = l;
}

/**
 * Initialize with a DB-backed store for persistence across restarts.
 * @param {{ upsert: (id: string, phone: string) => Promise<void>, loadAll: () => Promise<Array<{id: string, phone: string}>> }} store
 */
function initIdentityResolver(store) {
  identityStore = store;
}

/**
 * Extract the bare user ID from any JID format.
 * "58777214701585@lid" → "58777214701585"
 * "923087880256@s.whatsapp.net" → "923087880256"
 * "923265825610:1@s.whatsapp.net" → "923265825610"
 */
function extract(jid) {
  if (!jid) {
    return "";
  }
  const str = String(jid);
  const atIndex = str.indexOf("@");
  const raw = atIndex > -1 ? str.slice(0, atIndex) : str;
  const colonIndex = raw.indexOf(":");
  return colonIndex > -1 ? raw.slice(0, colonIndex) : raw;
}

/**
 * Heuristic: does this ID look like a phone number?
 * Pakistani / international format: starts with 92, 0, or is 10+ digit numeric.
 */
function isPhone(id) {
  if (!id) {
    return false;
  }
  const numeric = /^\d+$/.test(id);
  if (!numeric) {
    return false;
  }
  return id.startsWith("92") || id.startsWith("0") || id.length >= 10;
}

/**
 * Resolve any JID to the canonical user ID.
 * Uses Baileys signalRepository.lidMapping for LID → phone resolution.
 * Falls back to LID if mapping unavailable.
 */
async function resolveIdentity(jid, sock = null) {
  const rawId = extract(jid);

  // Already phone (not LID)
  if (!jid.includes('@lid')) {
    return userMap.get(rawId) || rawId;
  }

  // Try Baileys signalRepository.lidMapping for LID → phone
  if (sock?.signalRepository?.lidMapping) {
    const lidMapping = sock.signalRepository.lidMapping;
    const getPNForLID = lidMapping.getPNForLID || lidMapping.getPhoneNumberForLID;
    if (typeof getPNForLID === 'function') {
      try {
        const pn = await getPNForLID(rawId);
        if (pn) {
          const resolved = extract(pn);
          await linkIdentities(rawId, resolved, { source: "signalRepository" });
          return resolved;
        }
      } catch {
        // Mapping failed, continue to fallback
      }
    }
  }

  // Fallback: use in-memory map or return LID
  return userMap.get(rawId) || rawId;
}

function getUserId({ senderId, phoneId }) {
  return extract(phoneId || senderId);
}

/**
 * Learn a raw ID. If it's a phone number, register it.
 * Unknown IDs are stored as-is until a phone link is established.
 */
function learnIdentity(jid, logCtx = null) {
  const rawId = extract(jid);
  if (!rawId || userMap.has(rawId)) {
    return;
  }

  if (isPhone(rawId)) {
    userMap.set(rawId, rawId);
    if (logger) logger.info({ rawId, ...logCtx }, "Identity: learned phone");
  } else {
    userMap.set(rawId, rawId);
    if (logger) logger.info({ rawId, ...logCtx }, "Identity: learned unknown ID");
  }
}

/**
 * Link an ID (e.g., LID) to its real phone number.
 * After this, resolveIdentity(lid) returns the phone.
 * Also persists to DB if a store is configured.
 */
async function linkIdentities(lidOrJid, phone, logCtx = null) {
  const lidId = extract(lidOrJid);
  const phoneId = extract(phone);

  if (!lidId || !phoneId) {
    return;
  }

  userMap.set(phoneId, phoneId);
  userMap.set(lidId, phoneId);

  if (logger) logger.info({ lidId, phoneId, ...logCtx }, "Identity: linked LID to phone");

  if (identityStore) {
    await identityStore.upsert(lidId, phoneId).catch(() => {});
  }
}

/**
 * Load all identity mappings from the DB store into memory.
 * Call this once during bootstrap.
 */
async function loadMappingsFromStore() {
  if (!identityStore) {
    return;
  }

  try {
    const mappings = await identityStore.loadAll();
    for (const { id, phone } of mappings) {
      if (id) userMap.set(id, phone);
    }
  } catch {
    // Non-fatal — in-memory map will rebuild through learnIdentity()
  }
}

/**
 * Normalize a JID - converts raw numbers to proper JID format.
 * Used for WhatsApp API calls, NOT for identity resolution.
 */
function normalizeJid(jid) {
  if (!jid) {
    return jid;
  }

  if (jid.includes("@")) {
    return jid;
  }

  const digits = String(jid).replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : jid;
}

/**
 * Create a mention tag from any JID format.
 * Used for WhatsApp API mention arrays.
 */
function mentionTag(jid) {
  const id = extract(jid);
  return `@${id}`;
}

/**
 * Check if two JIDs refer to the same user.
 */
function sameUser(jidA, jidB) {
  return extract(jidA) === extract(jidB);
}

module.exports = {
  extract,
  extractUserId: extract,
  initIdentityResolver,
  isPhone,
  learnIdentity,
  linkIdentities,
  loadMappingsFromStore,
  mentionTag,
  normalizeJid,
  resolveIdentity,
  getUserId,
  sameUser,
  setLogger,
  // For debugging
  _reset: () => userMap.clear(),
  _dump: () => {
    const entries = [];
    for (const [k, v] of userMap) {
      entries.push({ key: k, value: v });
    }
    return entries;
  },
};
