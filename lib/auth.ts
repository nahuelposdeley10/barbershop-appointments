import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { defaultSettings } from "@/lib/booking-logic";
import { AdminSession } from "@/lib/models/AdminSession";
import { Setting } from "@/lib/models/Setting";

export const ADMIN_SESSION_COOKIE = "barber_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const loginFailures = new Map<string, { count: number; firstFailureAt: number }>();

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret && process.env.NODE_ENV !== "production") {
    return "local-development-session-secret-change-before-production";
  }
  if (!secret || secret.length < 32) {
    throw new Error("Falta ADMIN_SESSION_SECRET o es demasiado corto");
  }
  return secret;
}

function hashToken(token: string) {
  return crypto.createHmac("sha256", sessionSecret()).update(token).digest("hex");
}

function hashPin(pin: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto.scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

function verifyPinHash(pin: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected || expected.length !== 128) return false;
  const actual = crypto.scryptSync(pin, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function authSettings() {
  let settings = await Setting.findOne().select("+pin +pinHash");
  if (!settings) {
    settings = await Setting.create(defaultSettings());
  }
  return settings as typeof settings & { pin?: string; pinHash?: string };
}

export async function verifyAdminPin(pin: string) {
  const cleanPin = typeof pin === "string" ? pin.trim() : "";
  if (cleanPin.length < 4 || cleanPin.length > 64) return false;

  const settings = await authSettings();
  let valid = false;
  if (settings.pinHash) {
    valid = verifyPinHash(cleanPin, settings.pinHash);
  } else if (settings.pin) {
    // Migración única del formato antiguo: nunca se vuelve a guardar en claro.
    valid = safeEqual(cleanPin, settings.pin);
  } else if (process.env.ADMIN_INITIAL_PIN) {
    valid = safeEqual(cleanPin, process.env.ADMIN_INITIAL_PIN.trim());
  }

  if (valid && !settings.pinHash) {
    settings.set("pinHash", hashPin(cleanPin));
    settings.set("pin", undefined);
    await settings.save();
  }
  return valid;
}

export async function setAdminPin(pin: string) {
  const cleanPin = typeof pin === "string" ? pin.trim() : "";
  if (cleanPin.length < 4 || cleanPin.length > 64) {
    throw new Error("El PIN debe tener entre 4 y 64 caracteres");
  }
  const settings = await authSettings();
  settings.set("pinHash", hashPin(cleanPin));
  settings.set("pin", undefined);
  await settings.save();
}

export async function createAdminSession() {
  await connectDB();
  const token = crypto.randomBytes(32).toString("hex");
  await AdminSession.create({
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
  });
  return token;
}

function clientKey(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown-client"
  );
}

export function isLoginRateLimited(req: NextRequest) {
  const item = loginFailures.get(clientKey(req));
  if (!item) return false;
  if (Date.now() - item.firstFailureAt > LOGIN_WINDOW_MS) {
    loginFailures.delete(clientKey(req));
    return false;
  }
  return item.count >= LOGIN_MAX_FAILURES;
}

export function recordLoginFailure(req: NextRequest) {
  const key = clientKey(req);
  const current = loginFailures.get(key);
  if (!current || Date.now() - current.firstFailureAt > LOGIN_WINDOW_MS) {
    loginFailures.set(key, { count: 1, firstFailureAt: Date.now() });
    return;
  }
  current.count += 1;
}

export function clearLoginFailures(req: NextRequest) {
  loginFailures.delete(clientKey(req));
}

function bearerToken(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

export async function requireAdmin(req: NextRequest) {
  await connectDB();
  const cookieToken = req.cookies.get(ADMIN_SESSION_COOKIE)?.value || "";
  if (cookieToken) {
    const session = await AdminSession.findOne({
      tokenHash: hashToken(cookieToken),
      expiresAt: { $gt: new Date() },
    });
    if (session) return true;
  }

  // Compatibilidad temporal para integraciones antiguas, sin fallback inseguro.
  const configuredToken = process.env.ADMIN_TOKEN?.trim();
  return Boolean(
    configuredToken && configuredToken.length >= 32 && bearerToken(req) === configuredToken
  );
}

export async function revokeAdminSession(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value || "";
  if (!token) return;
  await connectDB();
  await AdminSession.deleteOne({ tokenHash: hashToken(token) });
}

export function setAdminSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
