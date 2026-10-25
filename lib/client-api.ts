"use client";

const BASE = "/api";

function tenantQuery(tenantSlug?: string) {
  return tenantSlug ? `&tenant=${encodeURIComponent(tenantSlug)}` : "";
}

export type Service = {
  name: string;
  price: number;
  duration: number;
  img: string;
};

export type Slot = { time: string; free: boolean; ocupadas: number; sillas: number };

export type AvailabilityData = {
  barberName: string;
  message: string;
  imgLogo?: string;
  services: Service[];
  date: string;
  slots: Slot[];
};

export type BookingConfirmation = {
  _id: string;
  name: string;
  phone: string;
  service: string;
  duration: number;
  price: number;
  date: string;
  time: string;
  status: string;
  paymentStatus?: "pending" | "paid" | "refunded";
  manageToken?: string;
  address?: string;
};

export type AdminBooking = BookingConfirmation;

export type RevenuePeriod = {
  from: string;
  to: string;
  total: number;
  collected: number;
  pending: number;
  appointmentCount: number;
};

export type AdminRevenue = {
  asOf: string;
  today: RevenuePeriod;
  week: RevenuePeriod;
  month: RevenuePeriod;
  global: RevenuePeriod;
};

export type Settings = {
  barberName: string;
  message: string;
  slogan: string;
  heroTitle1: string;
  heroTitle2: string;
  heroDescription: string;
  aboutTitle: string;
  aboutTitle2: string;
  aboutText: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  email: string;
  direccion: string;
  mapaQuery: string;
  mapLink: string;
  imgHero: string;
  imgAbout: string;
  imgReservar: string;
  imgLogo: string;
  imgGaleria: string[];
  profesionales: {
    nombre: string;
    rol: string;
    img: string;
    tags: string[];
  }[];
  services: Service[];
  days: { day: number; enabled: boolean; open: string; close: string }[];
  slotMinutes: number;
  cantidadBarberos: number;
  adminEmail: string;
  adminPassword?: string;
  unavailableDates: string[];
};

export type AdminSession = {
  authenticated: boolean;
  role?: "superadmin" | "owner";
  tenantId?: string | null;
  email?: string;
  isImpersonating?: boolean;
  tenantName?: string | null;
  tenantSlug?: string | null;
};

export type SuperadminTenant = {
  _id: string;
  slug: string;
  name: string;
  status: "active" | "suspended";
  ownerId: { email: string };
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error de conexión con el servidor");
  return data as T;
}

export function getAvailability(
  date: string,
  service?: string,
  tenantSlug?: string
): Promise<AvailabilityData> {
  return request(
    `/availability?date=${date}&service=${encodeURIComponent(service || "")}${tenantQuery(tenantSlug)}`
  );
}

export function getMonthAvailability(
  from: string,
  service?: string,
  tenantSlug?: string
): Promise<{ days: { date: string; status: string }[] }> {
  return request(
    `/month?from=${from}&service=${encodeURIComponent(service || "")}${tenantQuery(tenantSlug)}`
  );
}

export function createBooking(payload: {
  name: string;
  phone: string;
  service: string;
  date: string;
  time: string;
}, tenantSlug?: string): Promise<BookingConfirmation> {
  return request(`/bookings${tenantSlug ? `?tenant=${encodeURIComponent(tenantSlug)}` : ""}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cancelBooking(token: string): Promise<BookingConfirmation> {
  return request(`/bookings/manage/${encodeURIComponent(token)}`, { method: "DELETE" });
}

export function getManagedBooking(token: string): Promise<BookingConfirmation> {
  return request(`/bookings/manage/${encodeURIComponent(token)}`);
}

export function updateBookingSchedule(
  token: string,
  payload: { service: string; date: string; time: string }
): Promise<BookingConfirmation> {
  return request(`/bookings/manage/${encodeURIComponent(token)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function adminLogin(email: string, password: string): Promise<{ authenticated: boolean }> {
  return request("/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function adminSession(): Promise<AdminSession> {
  return request("/admin/session");
}

export function superadminGetTenants(_token?: string): Promise<SuperadminTenant[]> {
  void _token;
  return request("/superadmin/tenants");
}

export function superadminCreateTenant(payload: {
  name: string;
  slug: string;
  ownerEmail: string;
  ownerPassword: string;
}, _token?: string): Promise<{ id: string; slug: string; name: string; ownerEmail: string }> {
  void _token;
  return request("/superadmin/tenants", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function superadminEnterTenant(tenantId: string): Promise<AdminSession> {
  return request(`/superadmin/tenants/${encodeURIComponent(tenantId)}/enter`, {
    method: "POST",
  });
}

export function adminExitTenant(): Promise<AdminSession> {
  return request("/admin/leave-tenant", { method: "POST" });
}

export function adminLogout(): Promise<{ authenticated: false }> {
  return request("/admin/logout", { method: "POST" });
}

export function adminGetBookings(
  token: string,
  params: { date?: string; status?: string } = {}
): Promise<AdminBooking[]> {
  const query = new URLSearchParams();
  if (params.date) query.set("date", params.date);
  if (params.status) query.set("status", params.status);
  const qs = query.toString();
  return request(`/admin/bookings${qs ? `?${qs}` : ""}`);
}

export function adminCreateBooking(
  token: string,
  booking: { name: string; phone?: string; service: string; date?: string; time?: string }
): Promise<AdminBooking> {
  void token;
  return request("/admin/bookings", {
    method: "POST",
    body: JSON.stringify(booking),
  });
}

export function adminGetRevenue(
  token: string,
  options: { dayOffset?: number; weekOffset?: number; monthOffset?: number } = {}
): Promise<AdminRevenue> {
  void token;
  const query = new URLSearchParams();
  if (options.dayOffset) query.set("dayOffset", String(options.dayOffset));
  if (options.weekOffset) query.set("weekOffset", String(options.weekOffset));
  if (options.monthOffset) query.set("monthOffset", String(options.monthOffset));
  const qs = query.toString();
  return request(`/admin/revenue${qs ? `?${qs}` : ""}`);
}

export function adminUpdateBooking(
  token: string,
  id: string,
  changes: { status?: string; paymentStatus?: "pending" | "paid" | "refunded" } | string
): Promise<AdminBooking> {
  const body = typeof changes === "string" ? { status: changes } : changes;
  return request(`/admin/bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function adminDeleteBooking(
  token: string,
  id: string
): Promise<{ ok: boolean }> {
  return request(`/admin/bookings/${id}`, {
    method: "DELETE",
  });
}

export function adminGetSettings(token: string): Promise<Settings> {
  void token;
  return request("/admin/settings");
}

export function adminUpdateSettings(
  token: string,
  settings: Partial<Settings>
): Promise<Settings> {
  return request("/admin/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export type UploadResult = { url: string; publicId: string };

export async function adminUploadImage(
  token: string,
  file: File,
  folder?: string
): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("file", file);
  if (folder) fd.append("folder", folder);
  const res = await fetch(`${BASE}/admin/upload`, {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error al subir la imagen");
  return data as UploadResult;
}
