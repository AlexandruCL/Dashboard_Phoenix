import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Wire format shared with the bot (design §2.1): base64(nonce[12] ‖ ciphertext ‖ tag[16]), aad "dp1".
const AAD = Buffer.from("dp1");

export function seal(key: Buffer, payload: unknown, nonce: Buffer = randomBytes(12)): string {
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(AAD);
  const ct = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final(), cipher.getAuthTag()]);
  return Buffer.concat([nonce, ct]).toString("base64");
}

// Throws on a wrong key or tampered data.
export function open<T>(key: Buffer, envelope: string): T {
  const buf = Buffer.from(envelope, "base64");
  if (buf.length < 12 + 16) throw new Error("envelope too short");
  const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  decipher.setAAD(AAD);
  decipher.setAuthTag(buf.subarray(buf.length - 16));
  const pt = Buffer.concat([decipher.update(buf.subarray(12, buf.length - 16)), decipher.final()]);
  return JSON.parse(pt.toString("utf8")) as T;
}
