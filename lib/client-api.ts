"use client";

const BASE = "/api";

export type Service = {
  name: string;
  price: number;
  duration: number;
};

export type Slot = { time: string; free: boolean };

export type AvailabilityData = {
  barberName: string;
  message: string;
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
};

export type AdminBooking = BookingConfirmation & { _id: string };

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
  imgHero: string;
  imgAbout: string;
  imgReservar: string;
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
  pin: string;
  unavailableDates: string[];
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
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
  service?: string
): Promise<AvailabilityData> {
  return request(
    `/availability?date=${date}&service=${encodeURIComponent(service || "")}`
  );
}

export function getMonthAvailability(
  from: string,
  service?: string
): Promise<{ days: { date: string; status: string }[] }> {
  return request(
    `/month?from=${from}&service=${encodeURIComponent(service || "")}`
  );
}

export function createBooking(payload: {
  name: string;
  phone: string;
  service: string;
  date: string;
  time: string;
}): Promise<BookingConfirmation> {
  return request("/bookings", { method: "POST", body: JSON.stringify(payload) });
}

export function adminLogin(pin: string): Promise<{ token: string }> {
  return request("/admin/login", { method: "POST", body: JSON.stringify({ pin }) });
}

export function adminGetBookings(
  token: string,
  params: { date?: string; status?: string } = {}
): Promise<AdminBooking[]> {
  const query = new URLSearchParams();
  if (params.date) query.set("date", params.date);
  if (params.status) query.set("status", params.status);
  const qs = query.toString();
  return request(`/admin/bookings${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function adminUpdateBooking(
  token: string,
  id: string,
  status: string
): Promise<AdminBooking> {
  return request(`/admin/bookings/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
}

export function adminDeleteBooking(
  token: string,
  id: string
): Promise<{ ok: boolean }> {
  return request(`/admin/bookings/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function adminGetSettings(token: string): Promise<Settings> {
  return request("/admin/settings", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function adminUpdateSettings(
  token: string,
  settings: Partial<Settings>
): Promise<Settings> {
  return request("/admin/settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
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
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error al subir la imagen");
  return data as UploadResult;
}
