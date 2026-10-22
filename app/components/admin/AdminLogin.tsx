"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { adminLogin } from "@/lib/client-api";
import { BarberPole } from "../booking/BarberIcons";

export default function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      <Link
        href="/reservar"
        className="self-start rounded-lg px-2 py-1.5 text-xs font-semibold text-zinc-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] sm:self-auto sm:py-2 sm:text-sm"
      >
        <span aria-hidden="true">←</span> Volver a la página de reservas
      </Link>

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
              <input
                type="password"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3.5 py-2.5 text-[var(--text)] outline-none transition placeholder:text-zinc-600 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 sm:py-3"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                autoComplete="current-password"
                required
              />
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
