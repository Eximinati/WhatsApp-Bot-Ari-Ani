const crypto = require("crypto");

const PREFIX = "enc:v1";

function encryptString(value, secret) {
  if (!secret || !value) {
    return value;
  }

  const iv = crypto.randomBytes(12);
  const key = deriveKey(secret);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

function decryptString(value, secret) {
  if (!secret || !value || !String(value).startsWith(`${PREFIX}:`)) {
    return value;
  }

  const payload = String(value).slice(`${PREFIX}:`.length);
  const [ivBase64, tagBase64, dataBase64] = payload.split(":");
  const key = deriveKey(secret);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivBase64, "base64"),
  );

  decipher.setAuthTag(Buffer.from(tagBase64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataBase64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function deriveKey(secret) {
  return crypto.createHash("sha256").update(String(secret)).digest();
}

module.exports = {
  decryptString,
  encryptString,
};
