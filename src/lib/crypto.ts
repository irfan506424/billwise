import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// 32-byte AES-256 key. Prefer ENCRYPTION_KEY; fall back to deriving from
// AUTH_SECRET so local dev works without an extra var. Production MUST set
// ENCRYPTION_KEY (rotating it requires re-encrypting stored tokens).
function key(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) throw new Error("ENCRYPTION_KEY or AUTH_SECRET must be set");
  return createHash("sha256").update(secret).digest();
}

// Format: base64(iv) . : . base64(ciphertext+tag)   (GCM tag appended by Node)
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${Buffer.concat([ct, tag]).toString("base64")}`;
}

export function decrypt(payload: string): string {
  const [ivB64, dataB64] = payload.split(":");
  if (!ivB64 || !dataB64) throw new Error("invalid ciphertext payload");
  const iv = Buffer.from(ivB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const tag = data.subarray(data.length - 16);
  const ct = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
