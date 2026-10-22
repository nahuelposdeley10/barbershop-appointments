"use client";

export default function TenantError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-zinc-950 px-5 text-center text-zinc-100">
      <section className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/80 p-7 shadow-2xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-amber-300">Barbería temporalmente no disponible</p>
        <h1 className="mt-3 text-2xl font-black">No pudimos cargar esta página</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          La configuración no está disponible en este momento. Probá nuevamente en unos segundos.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-xl bg-amber-400 px-5 py-3 text-sm font-extrabold text-zinc-950 transition hover:bg-amber-300"
        >
          Intentar de nuevo
        </button>
      </section>
    </main>
  );
}
