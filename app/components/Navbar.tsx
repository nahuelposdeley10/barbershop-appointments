"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BarberPole } from "./booking/BarberIcons";

const CONFIG = {
  reservarUrl: "/reservar",
};

const Icons = {
  menu: (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  share: (
    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  ),
  scissors: (
    <svg
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  ),
};

const links = [
  { label: "Inicio", href: "/#hero" },
  { label: "Equipo", href: "/#profesionales" },
  { label: "Servicios", href: "/#servicios" },
  { label: "Galería", href: "/#galeria" },
  { label: "Ubicación", href: "/#ubicacion" },
];

export type AdminPanelTab = "agenda" | "resumen" | "config" | "web" | "imagenes" | "superadmin";

const ownerPanelLinks: { id: AdminPanelTab; label: string }[] = [
  { id: "agenda", label: "Agenda de turnos" },
  { id: "resumen", label: "Resumen financiero" },
  { id: "config", label: "Configuración" },
  { id: "imagenes", label: "Imágenes" },
  { id: "web", label: "Sitio web" },
];

const superadminPanelLinks: { id: AdminPanelTab; label: string }[] = [
  { id: "superadmin", label: "Barberías y dueños" },
];

export default function Navbar({
  nombre,
  logo,
  onLogout,
  adminMode = false,
  adminRole = "owner",
  adminTab = "agenda",
  onAdminTabChange,
  tenantSlug,
}: {
  nombre: string;
  logo?: string;
  onLogout?: () => void;
  adminMode?: boolean;
  adminRole?: "superadmin" | "owner";
  adminTab?: AdminPanelTab;
  onAdminTabChange?: (tab: AdminPanelTab) => void;
  tenantSlug?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState<"web" | "booking" | null>(null);
  const [shareError, setShareError] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && navRef.current && !navRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const panelLinks = adminRole === "superadmin" ? superadminPanelLinks : ownerPanelLinks;

  function selectPanelTab(tab: AdminPanelTab) {
    onAdminTabChange?.(tab);
    setOpen(false);
  }

  async function copyShareLink(kind: "web" | "booking") {
    if (!tenantSlug) return;
    const path = kind === "web" ? `/b/${tenantSlug}` : `/b/${tenantSlug}/reservar`;
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        textArea.remove();
        if (!copied) throw new Error("copy-failed");
      }
      setShareError(false);
      setCopiedShare(kind);
      window.setTimeout(() => setCopiedShare(null), 1800);
    } catch {
      setCopiedShare(null);
      setShareError(true);
      window.setTimeout(() => setShareError(false), 2200);
    }
  }

  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href={adminMode ? "/admin" : "/#hero"} className="flex items-center gap-2.5 group min-w-0">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={nombre || "Logo"}
                className={`h-9 sm:h-11 w-auto object-contain shrink-0 ${
                  nombre
                    ? "max-w-[104px] sm:max-w-[170px]"
                    : "max-w-[190px] sm:max-w-[240px]"
                }`}
              />
            ) : (
              <>
                <span className="text-accent shrink-0">{Icons.scissors}</span>
                <BarberPole className="w-10 h-[5px] opacity-70 shrink-0" />
              </>
            )}
            {nombre && (
              <span className="font-display text-xl font-bold tracking-tight group-hover:text-accent transition-colors truncate min-w-0">
                {nombre}
              </span>
            )}
          </Link>

          {adminMode ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-xs font-bold uppercase tracking-[0.16em] text-zinc-500 sm:inline">
                Panel de administración
              </span>
              <button
                type="button"
                className="grid h-11 w-11 place-items-center rounded-xl border border-zinc-700/70 text-zinc-300 transition hover:border-accent hover:text-accent"
                aria-label={open ? "Cerrar menú del panel" : "Abrir menú del panel"}
                aria-expanded={open}
                aria-controls="admin-panel-menu"
                onClick={() => setOpen(!open)}
              >
                {Icons.menu}
              </button>
            </div>
          ) : (
            <>
              <div className="hidden md:flex items-center gap-8">
                {links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-sm text-zinc-400 hover:text-accent transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
                {onLogout ? (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="text-sm text-zinc-400 hover:text-red-400 transition-colors border border-zinc-700/60 px-4 py-2 rounded-full hover:border-red-500/60"
                  >
                    Salir
                  </button>
                ) : (
                  <Link
                    href="/admin"
                    className="text-sm text-zinc-400 hover:text-accent transition-colors border border-zinc-700/60 px-4 py-2 rounded-full hover:border-accent"
                  >
                    Ingreso barbero
                  </Link>
                )}
                <Link
                  href={CONFIG.reservarUrl}
                  className="bg-accent text-zinc-950 px-5 py-2 rounded-full text-sm font-semibold hover:bg-accent-hover transition-colors"
                >
                  Reservar Turno
                </Link>
              </div>

              <button
                className="md:hidden text-zinc-400 hover:text-white p-2 -mr-2"
                aria-label={open ? "Cerrar menú" : "Menú"}
                aria-expanded={open}
                onClick={() => setOpen(!open)}
              >
                {Icons.menu}
              </button>
            </>
          )}
        </div>
      </div>

      {open && adminMode && (
        <div id="admin-panel-menu" className="border-t border-zinc-800/50">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <p className="px-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-accent">
              Navegación del panel
            </p>
            <div className="mt-2 grid gap-1 sm:max-w-md">
              {panelLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  aria-current={adminTab === link.id ? "page" : undefined}
                  onClick={() => selectPanelTab(link.id)}
                  className={`rounded-xl px-3 py-3 text-left text-base font-semibold transition ${
                    adminTab === link.id
                      ? "bg-accent text-zinc-950"
                      : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  {link.label}
                </button>
              ))}
              {tenantSlug && (
                <div className="mt-4 border-t border-zinc-800 pt-4">
                  <div className="flex items-center gap-2 px-2 text-accent">
                    {Icons.share}
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.18em]">
                      Compartir
                    </p>
                  </div>
                  <div className="mt-2 grid gap-2">
                    <button
                      type="button"
                      onClick={() => copyShareLink("web")}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-zinc-700 px-3 py-2.5 text-left text-sm font-semibold text-zinc-200 transition hover:border-accent hover:text-accent"
                    >
                      <span>{copiedShare === "web" ? "Web copiada ✓" : "Copiar web pública"}</span>
                      <span className="truncate text-xs font-normal text-zinc-500">/b/{tenantSlug}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => copyShareLink("booking")}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-zinc-700 px-3 py-2.5 text-left text-sm font-semibold text-zinc-200 transition hover:border-accent hover:text-accent"
                    >
                      <span>{copiedShare === "booking" ? "Reservas copiada ✓" : "Copiar link de reservas"}</span>
                      <span className="truncate text-xs font-normal text-zinc-500">/b/{tenantSlug}/reservar</span>
                    </button>
                  </div>
                  {shareError && <p className="mt-2 px-2 text-xs font-semibold text-red-300">No pudimos copiar el enlace.</p>}
                </div>
              )}
              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onLogout();
                  }}
                  className="mt-2 rounded-xl border border-red-500/30 px-3 py-3 text-left text-base font-semibold text-red-300 transition hover:bg-red-500/10"
                >
                  Cerrar sesión
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {open && !adminMode && (
        <div className="md:hidden border-t border-zinc-800/50">
          <div className="px-5 py-5 space-y-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block text-zinc-400 hover:text-accent transition-colors py-3 text-base"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            {onLogout ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="block w-full text-left text-zinc-400 hover:text-red-400 transition-colors py-3 text-base"
              >
                Salir
              </button>
            ) : (
              <Link
                href="/admin"
                className="block text-zinc-400 hover:text-accent transition-colors py-3 text-base"
                onClick={() => setOpen(false)}
              >
                Ingreso barbero
              </Link>
            )}
            <Link
              href={CONFIG.reservarUrl}
              className="block bg-accent text-zinc-950 px-5 py-3.5 rounded-full text-base font-semibold text-center hover:bg-accent-hover transition-colors mt-3"
              onClick={() => setOpen(false)}
            >
              Reservar Turno
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
