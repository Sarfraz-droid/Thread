import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { HttpError, required } from "./errors";
function key() {
  const hex = required("ENCRYPTION_KEY");
  if (!/^[a-f0-9]{64}$/i.test(hex))
    throw new HttpError(
      503,
      "ENCRYPTION_KEY must be 64 hexadecimal characters.",
    );
  return Buffer.from(hex, "hex");
}
export function encrypt(value: unknown) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), data]
    .map((part) => part.toString("base64url"))
    .join(".");
}
export function decrypt<T>(encrypted: string): T {
  const [iv, tag, data] = encrypted.split(".");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8"),
  ) as T;
}
