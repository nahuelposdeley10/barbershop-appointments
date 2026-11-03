import crypto from "node:crypto";

const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BYTES = 32;
const PASSWORD_COST = 16_384;

export function createBookingManageToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: crypto.createHash("sha256").update(token).digest("hex") };
}

export function hashBookingManageToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function hashBookingPassword(password: string) {
  const salt = crypto.randomBytes(PASSWORD_SALT_BYTES);
  const derivedKey = crypto.scryptSync(password, salt, PASSWORD_KEY_BYTES, {
    N: PASSWORD_COST,
    r: 8,
    p: 1,
  });
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

export function verifyBookingPassword(password: string, storedHash: string) {
  const [saltHex, keyHex] = storedHash.split(":");
  if (!saltHex || !keyHex || keyHex.length % 2 !== 0) return false;

  try {
    const expected = Buffer.from(keyHex, "hex");
    const derivedKey = crypto.scryptSync(
      password,
      Buffer.from(saltHex, "hex"),
      expected.length,
      { N: PASSWORD_COST, r: 8, p: 1 }
    );
    return derivedKey.length === expected.length && crypto.timingSafeEqual(derivedKey, expected);
  } catch {
    return false;
  }
}
