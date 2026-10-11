import crypto from "node:crypto";

export function createBookingManageToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: crypto.createHash("sha256").update(token).digest("hex") };
}

export function hashBookingManageToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
