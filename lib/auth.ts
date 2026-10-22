import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { AdminUser } from "@/lib/models/AdminUser";
import { AdminSession } from "@/lib/models/AdminSession";
import { Tenant } from "@/lib/models/Tenant";

export const ADMIN_SESSION_COOKIE = "barber_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const loginFailures = new Map<string, { count: number; firstFailureAt: number }>();

export type AdminContext = {
  userId: string;
  email: string;
  role: "superadmin" | "owner";
  tenantId: string | null;
  isImpersonating: boolean;
  actorUserId?: string;
};

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

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

function verifyPasswordHash(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected || expected.length !== 128) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function normalizeEmail(email: string) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function validEmail(email: string) {
  return email.length >= 5 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function verifyAdminCredentials(email: string, password: string) {
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = typeof password === "string" ? password : "";
  if (!validEmail(cleanEmail) || cleanPassword.length < 4 || cleanPassword.length > 128) return false;

  await connectDB();
  const user = await AdminUser.findOne({ email: cleanEmail }).select("+passwordHash");
  if (user) {
    return user.email === cleanEmail && verifyPasswordHash(cleanPassword, user.passwordHash);
  }

  const initialEmail = normalizeEmail(process.env.ADMIN_INITIAL_EMAIL || "");
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || "";
  if (
    !validEmail(initialEmail) ||
    !safeEqual(cleanEmail, initialEmail) ||
    !safeEqual(cleanPassword, initialPassword)
  ) {
    return false;
  }

  await AdminUser.create({
    email: cleanEmail,
    passwordHash: hashPassword(cleanPassword),
    role: "superadmin",
    tenantId: null,
  });
  return true;
}

export async function getAdminUserByEmail(email: string) {
  await connectDB();
  return AdminUser.findOne({ email: normalizeEmail(email) });
}

export async function getAdminAccount(userId?: string) {
  await connectDB();
  const user = await AdminUser.findOne(userId ? { _id: userId } : {}).select("email");
  return { email: user?.email || normalizeEmail(process.env.ADMIN_INITIAL_EMAIL || "") };
}

export async function setAdminCredentials(email: string, password: string, userId?: string) {
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = typeof password === "string" ? password : "";
  if (!validEmail(cleanEmail)) {
    throw new Error("Ingresá un email válido");
  }
  if (cleanPassword && (cleanPassword.length < 4 || cleanPassword.length > 128)) {
    throw new Error("La contraseña debe tener entre 4 y 128 caracteres");
  }

  await connectDB();
  const user = await AdminUser.findOne(userId ? { _id: userId } : {}).select("+passwordHash");
  if (!user) {
    if (!cleanPassword) throw new Error("Ingresá una contraseña para crear el acceso");
    await AdminUser.create({ email: cleanEmail, passwordHash: hashPassword(cleanPassword), role: "owner" });
    return { email: cleanEmail };
  }
  const credentialsChanged = user.email !== cleanEmail || Boolean(cleanPassword);
  user.email = cleanEmail;
  if (cleanPassword) user.passwordHash = hashPassword(cleanPassword);
  await user.save();
  if (credentialsChanged) {
    await AdminSession.deleteMany({ userId: String(user._id) });
  }
  return { email: user.email };
}

export async function createAdminSession(userId?: string, impersonatedBy?: string) {
  await connectDB();
  const token = crypto.randomBytes(32).toString("hex");
  await AdminSession.create({
    tokenHash: hashToken(token),
    ...(userId ? { userId } : {}),
    ...(impersonatedBy ? { impersonatedBy } : {}),
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

export async function getAdminContext(req: NextRequest): Promise<AdminContext | null> {
  await connectDB();
  const cookieToken = req.cookies.get(ADMIN_SESSION_COOKIE)?.value || "";
  if (cookieToken) {
    const session = await AdminSession.findOne({
      tokenHash: hashToken(cookieToken),
      expiresAt: { $gt: new Date() },
    });
    if (session) {
      const user = session.userId
        ? await AdminUser.findById(session.userId)
        : await AdminUser.findOne().sort({ createdAt: 1 });
      const actor = session.impersonatedBy
        ? await AdminUser.findById(session.impersonatedBy).select("role")
        : null;
      if (session.impersonatedBy && actor?.role !== "superadmin") return null;
      if (user) {
        if (user.role === "owner" && user.tenantId) {
          const tenant = await Tenant.findOne({ _id: user.tenantId, status: "active" }).select("_id").lean();
          if (!tenant) return null;
        }
        return {
          userId: String(user._id),
          email: user.email,
          role: user.role || "owner",
          tenantId: user.tenantId ? String(user.tenantId) : null,
          isImpersonating: Boolean(session.impersonatedBy),
          ...(session.impersonatedBy ? { actorUserId: String(session.impersonatedBy) } : {}),
        };
      }
    }
  }

  // Compatibilidad temporal para integraciones antiguas, sin fallback inseguro.
  const configuredToken = process.env.ADMIN_TOKEN?.trim();
  const legacyTokenEnabled = process.env.ALLOW_ADMIN_TOKEN === "true";
  if (legacyTokenEnabled && configuredToken && configuredToken.length >= 32 && bearerToken(req) === configuredToken) {
    const user = await AdminUser.findOne().sort({ createdAt: 1 });
    if (user) {
      return {
        userId: String(user._id),
        email: user.email,
        role: user.role || "superadmin",
        tenantId: user.tenantId ? String(user.tenantId) : null,
        isImpersonating: false,
      };
    }
  }
  return null;
}

export async function requireAdmin(req: NextRequest) {
  return Boolean(await getAdminContext(req));
}

export async function revokeAdminSession(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value || "";
  if (!token) return;
  await connectDB();
  await AdminSession.deleteOne({ tokenHash: hashToken(token) });
}

export async function restoreImpersonatorSession(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value || "";
  if (!token) return null;
  await connectDB();
  const session = await AdminSession.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!session?.impersonatedBy) return null;
  const actor = await AdminUser.findOne({ _id: session.impersonatedBy, role: "superadmin" });
  if (!actor) return null;
  await AdminSession.deleteOne({ _id: session._id });
  return createAdminSession(String(actor._id));
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
