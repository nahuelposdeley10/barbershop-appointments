"use client";

import { useState } from "react";
import { adminLogin } from "@/lib/client-api";
import { BarberPole } from "../booking/BarberIcons";
import Navbar from "../Navbar";

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
    <div className="booking-bg">
      <Navbar nombre="Barbería" />
      <div className="max-w-[720px] mx-auto px-4 pt-24 pb-12 flex flex-col gap-5">

        <div className="w-full flex flex-col md:flex-row bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="hidden md:block relative flex-[0_0_42%] min-h-[340px] bg-gradient-to-b from-zinc-800 to-zinc-950">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
              <BarberPole />
              <p className="font-extrabold text-lg text-white">
                Tu local, controlado desde acá.
              </p>
            </div>
          </div>

          <div className="flex-1 min-w-0 p-8 flex flex-col items-start gap-3.5">
            <BarberPole />
            <h1 className="text-[26px] font-bold">Panel del barbero</h1>
            <p className="text-[var(--muted)]">
              Ingresá con tu email y contraseña para administrar los turnos.
            </p>
            {error && <p className="text-[var(--red)] font-semibold">{error}</p>}
            <form className="flex flex-col gap-3.5 w-full" onSubmit={handleSubmit}>
              <label className="flex flex-col gap-1.5 font-semibold text-sm">
                <span>Email</span>
                <input
                  type="email"
                  className="w-full px-3.5 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text)]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@tubarberia.com"
                  autoComplete="username"
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-1.5 font-semibold text-sm">
                <span>Contraseña</span>
                <input
                  type="password"
                  className="w-full px-3.5 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text)]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-5 py-3.5 rounded-xl font-bold bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] text-[#1a1406] disabled:opacity-60"
              >
                {loading ? "Ingresando…" : "Ingresar"}
              </button>
            </form>
            <p className="text-[var(--muted)] text-[13px]">
              Acceso privado para administrar turnos y la información del local.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
