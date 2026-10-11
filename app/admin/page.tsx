"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import AdminLogin from "../components/admin/AdminLogin";
import AdminPage from "../components/admin/AdminPage";
import { adminLogout, adminSession } from "@/lib/client-api";

export default function Admin() {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    adminSession()
      .then((result) => setAuthenticated(result.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  function handleLogin() {
    setAuthenticated(true);
  }

  async function handleLogout() {
    await adminLogout().catch(() => undefined);
    setAuthenticated(false);
  }

  if (!mounted || authenticated === null) {
    return <AdminSpinner />;
  }

  if (authenticated) {
    return <AdminPage token="session" onLogout={handleLogout} />;
  }
  return <AdminLogin onLogin={handleLogin} />;
}

function AdminSpinner() {
  return (
    <div className="booking-bg grid place-items-center min-h-screen">
      <div className="flex flex-col items-center gap-6">
        <span
          aria-hidden="true"
          className="inline-block w-40 h-[7px] rounded-full border border-white/25"
          style={{
            background:
              "repeating-linear-gradient(90deg,#e23b3b,#e23b3b 14px,#f4f4f4 14px,#f4f4f4 28px,#3b74e2 28px,#3b74e2 42px)",
            backgroundSize: "42px 100%",
            animation: "pole-spin 2.4s linear infinite",
            boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
          }}
        />
        <p className="text-sm text-zinc-500">Cargando…</p>
      </div>
    </div>
  );
}
