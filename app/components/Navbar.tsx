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

export default function Navbar({
  nombre,
  logo,
  onLogout,
}: {
  nombre: string;
  logo?: string;
  onLogout?: () => void;
}) {
  const [open, setOpen] = useState(false);
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

  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/#hero" className="flex items-center gap-2.5 group min-w-0">
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
        </div>
      </div>

      {open && (
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
