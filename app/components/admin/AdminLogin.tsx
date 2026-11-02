"use client";

import { useState } from "react";
import Image from "next/image";
import { adminLogin } from "@/lib/client-api";
import { BarberPole } from "../booking/BarberIcons";

export default function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await adminLogin(email.trim(), password);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="booking-bg flex min-h-[100svh] flex-col items-center justify-center gap-2.5 px-3 py-3 sm:gap-4 sm:px-5 sm:py-8">
      <p className="text-center text-xs font-semibold text-zinc-500 sm:text-sm">
        Acceso privado para administrar tu barbería
      </p>

      <section className="flex w-full max-w-[540px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] text-left shadow-2xl shadow-black/20 md:max-w-[780px] md:flex-row">
        <div className="relative hidden min-h-[340px] flex-[0_0_42%] md:block">
          <Image
            src="/action.jpg"
            alt="Barbero atendiendo a un cliente"
            fill
            priority
            sizes="(min-width: 768px) 42vw, 0px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0f13]/90 via-[#0e0f13]/15 to-transparent" />
          <p className="absolute bottom-4 left-5 right-5 text-[17px] font-extrabold leading-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
            Tu local, controlado desde acá.
          </p>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5 p-5 sm:gap-3.5 sm:p-[30px]">
          <BarberPole className="w-24 sm:w-28" />
          <div>
            <h1 className="text-[24px] font-bold tracking-tight text-white sm:text-[26px]">
              Panel del barbero
            </h1>
            <p className="mt-1.5 max-w-[430px] text-[13px] leading-5 text-[var(--muted)] sm:mt-2 sm:text-[15px] sm:leading-6">
              Ingresá tu email y contraseña para administrar los turnos.
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="w-full rounded-xl border border-red-400/25 bg-red-400/10 px-3.5 py-2.5 text-sm font-semibold leading-5 text-[var(--red)]"
            >
              {error}
            </p>
          )}

          <form className="flex w-full flex-col gap-2.5 sm:gap-3.5" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-1 text-sm font-semibold text-zinc-200 sm:gap-1.5">
              <span>Email</span>
              <input
                type="email"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3.5 py-2.5 text-[var(--text)] outline-none transition placeholder:text-zinc-600 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 sm:py-3"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                autoFocus
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-zinc-200 sm:gap-1.5">
              <span>Contraseña</span>
              <span className="relative block">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3.5 py-2.5 pr-12 text-[var(--text)] outline-none transition placeholder:text-zinc-600 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 sm:py-3"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                  title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute inset-y-0 right-1.5 grid w-10 place-items-center rounded-lg text-zinc-400 transition hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
                >
                  {showPassword ? (
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                      <path d="M9.4 5.2A10.8 10.8 0 0 1 12 4.9c5.5 0 9 5.1 9 7.1a8.8 8.8 0 0 1-2.1 3.2M6.2 6.3C3.9 7.8 3 10.5 3 12c0 2 3.5 7.1 9 7.1a9.6 9.6 0 0 0 4.3-1" />
                    </svg>
                  ) : (
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2.5 12s3.4-7 9.5-7 9.5 7 9.5 7-3.4 7-9.5 7-9.5-7-9.5-7Z" />
                      <circle cx="12" cy="12" r="2.7" />
                    </svg>
                  )}
                </button>
              </span>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="mt-0.5 w-full rounded-xl bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] px-5 py-3 font-bold text-[#1a1406] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)] disabled:cursor-wait disabled:opacity-60 sm:mt-1 sm:py-3.5"
            >
              {loading ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
          <p className="text-xs leading-5 text-[var(--muted)] sm:text-[13px]">
            Podés cambiar el email y la contraseña desde Configuración.
          </p>
        </div>
      </section>
    </main>
  );
}
