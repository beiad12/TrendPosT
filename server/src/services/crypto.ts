import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for user-supplied AI provider API keys.
 * Keys are never logged; only ciphertext + iv + authTag are persisted.
 */

function getMasterKey(): Buffer {
  const hex = process.env.MASTER_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "MASTER_KEY must be set to a 64-char hex string (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, "hex");
}

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
}

export function encryptSecret(plaintext: string): EncryptedPayload {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getMasterKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(payload: EncryptedPayload): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getMasterKey(),
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf-8");
}
