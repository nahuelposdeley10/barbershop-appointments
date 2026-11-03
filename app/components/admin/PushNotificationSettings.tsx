"use client";

import { useEffect, useState } from "react";
import {
  adminDeletePushSubscription,
  adminGetPushStatus,
  adminSavePushSubscription,
  adminTestPushSubscription,
} from "@/lib/client-api";

type Feedback = { tone: "success" | "error"; message: string } | null;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandaloneApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export default function PushNotificationSettings() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"activate" | "deactivate" | "test" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const hasSupport =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (!hasSupport) {
        if (!cancelled) {
          setSupported(false);
          setLoading(false);
        }
        return;
      }

      try {
        const [status, registration] = await Promise.all([
          adminGetPushStatus(),
          navigator.serviceWorker.register("/sw.js", {
            scope: "/",
            updateViaCache: "none",
          }),
        ]);
        const currentSubscription = await registration.pushManager.getSubscription();
        if (!cancelled) {
          setSupported(true);
          setConfigured(status.configured);
          setPublicKey(status.publicKey);
          setSubscription(currentSubscription);
          setPermission(Notification.permission);
          setIosNeedsInstall(isIosDevice() && !isStandaloneApp());
        }
      } catch (error) {
        if (!cancelled) {
          setSupported(true);
          setFeedback({
            tone: "error",
            message: error instanceof Error ? error.message : "No pudimos revisar este dispositivo.",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function activate() {
    setBusy("activate");
    setFeedback(null);
    try {
      if (!configured || !publicKey) {
        throw new Error("Las notificaciones todavía no están configuradas en el servidor.");
      }
      if (iosNeedsInstall) {
        throw new Error("En iPhone, primero agregá BarberYá a la pantalla de inicio y abrila desde su ícono.");
      }

      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        throw new Error(
          nextPermission === "denied"
            ? "Las notificaciones están bloqueadas. Habilitalas desde la configuración del navegador."
            : "Necesitamos tu permiso para avisarte cuando llegue una reserva."
        );
      }

      const registration = await navigator.serviceWorker.ready;
      let nextSubscription = await registration.pushManager.getSubscription();
      if (!nextSubscription) {
        nextSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      try {
        await adminSavePushSubscription(nextSubscription.toJSON());
      } catch (error) {
        await nextSubscription.unsubscribe().catch(() => false);
        throw error;
      }
      setSubscription(nextSubscription);
      setFeedback({
        tone: "success",
        message: "Listo. Este dispositivo recibirá las nuevas reservas aunque el panel esté cerrado.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No pudimos activar las notificaciones.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function deactivate() {
    if (!subscription) return;
    setBusy("deactivate");
    setFeedback(null);
    try {
      await adminDeletePushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
      setSubscription(null);
      setFeedback({ tone: "success", message: "Las notificaciones se desactivaron en este dispositivo." });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No pudimos desactivar este dispositivo.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function testNotification() {
    if (!subscription) return;
    setBusy("test");
    setFeedback(null);
    try {
      await adminTestPushSubscription(subscription.endpoint);
      setFeedback({ tone: "success", message: "Prueba enviada. Deberías verla en unos segundos." });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No pudimos enviar la prueba.",
      });
    } finally {
      setBusy(null);
    }
  }

  const active = Boolean(subscription && permission === "granted");

  return (
    <section
      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-3.5 sm:p-4"
      aria-labelledby="device-notifications-title"
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
            active
              ? "border-emerald-400/35 bg-emerald-500/12 text-emerald-300"
              : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)]"
          }`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17H9m9-2V11a6 6 0 0 0-12 0v4l-2 2h16l-2-2Zm-7 5h2" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <strong id="device-notifications-title" className="text-sm text-[var(--text)]">
              Avisos instantáneos en este dispositivo
            </strong>
            {!loading ? (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                  active
                    ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-300"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)]"
                }`}
              >
                {active ? "Activo" : "Inactivo"}
              </span>
            ) : null}
          </span>
          <span className="mt-1 block text-[12.5px] leading-5 text-[var(--muted)]">
            Recibí una notificación apenas un cliente reserve. No mostramos nombres ni teléfonos en la pantalla bloqueada.
          </span>
        </span>
      </div>

      {loading ? (
        <p className="mt-4 text-[12.5px] text-[var(--muted)]" role="status">Revisando este dispositivo…</p>
      ) : supported === false ? (
        <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-[12.5px] leading-5 text-amber-200">
          Este navegador no admite notificaciones web. Probá con Chrome, Edge, Firefox o Safari actualizado.
        </p>
      ) : !configured ? (
        <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-[12.5px] leading-5 text-amber-200">
          Falta completar la configuración segura de notificaciones en el servidor.
        </p>
      ) : iosNeedsInstall ? (
        <p className="mt-4 rounded-xl border border-blue-400/30 bg-blue-500/10 p-3 text-[12.5px] leading-5 text-blue-100">
          En iPhone: tocá <strong>Compartir</strong>, elegí <strong>Agregar a pantalla de inicio</strong> y abrí BarberYá desde el nuevo ícono. Después vas a poder activarlas acá.
        </p>
      ) : permission === "denied" ? (
        <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-[12.5px] leading-5 text-red-200">
          Este navegador bloqueó los avisos. Habilitá las notificaciones para este sitio desde la configuración del navegador y recargá el panel.
        </p>
      ) : null}

      {supported && configured && !iosNeedsInstall ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
          {active ? (
            <>
              <button
                type="button"
                disabled={busy !== null}
                onClick={testNotification}
                className="min-h-11 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {busy === "test" ? "Enviando…" : "Enviar prueba"}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={deactivate}
                className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-bold text-[var(--muted)] transition hover:border-red-400/45 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {busy === "deactivate" ? "Desactivando…" : "Desactivar acá"}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy !== null || permission === "denied"}
              onClick={activate}
              className="min-h-11 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {busy === "activate" ? "Activando…" : "Activar en este dispositivo"}
            </button>
          )}
        </div>
      ) : null}

      {feedback ? (
        <p
          role={feedback.tone === "error" ? "alert" : "status"}
          className={`mt-3 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold leading-5 ${
            feedback.tone === "success"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-400/30 bg-red-500/10 text-red-200"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
    </section>
  );
}
