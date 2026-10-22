"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import AdminLogin from "../components/admin/AdminLogin";
import AdminPage from "../components/admin/AdminPage";
import {
  adminExitTenant,
  adminLogout,
  adminSession,
  superadminEnterTenant,
  type AdminSession,
} from "@/lib/client-api";

export default function Admin() {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const [session, setSession] = useState<AdminSession | null>(null);

  useEffect(() => {
    adminSession()
      .then((result) => setSession(result.authenticated ? result : { authenticated: false }))
      .catch(() => setSession({ authenticated: false }));
  }, []);

  function handleLogin() {
    adminSession()
      .then((result) => setSession(result))
      .catch(() => setSession({ authenticated: true }));
  }

  async function handleLogout() {
    await adminLogout().catch(() => undefined);
    setSession({ authenticated: false });
  }

  async function handleEnterTenant(tenantId: string) {
    await superadminEnterTenant(tenantId);
    const result = await adminSession();
    setSession(result);
  }

  async function handleExitImpersonation() {
    await adminExitTenant();
    const result = await adminSession();
    setSession(result);
  }

  if (!mounted || session === null) {
    return <AdminSpinner />;
  }

  if (session.authenticated) {
    return (
      <AdminPage
        key={`${session.role || "owner"}:${session.tenantId || "central"}`}
        token="session"
        role={session.role || "owner"}
        isImpersonating={Boolean(session.isImpersonating)}
        tenantName={session.tenantName}
        tenantSlug={session.tenantSlug}
        onEnterTenant={handleEnterTenant}
        onExitImpersonation={handleExitImpersonation}
        onLogout={handleLogout}
      />
    );
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
