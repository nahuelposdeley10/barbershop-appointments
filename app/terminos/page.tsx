import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="booking-bg min-h-screen px-5 py-24">
      <article className="max-w-2xl mx-auto bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 sm:p-10">
        <Link href="/" className="text-accent font-bold text-sm">← Volver al inicio</Link>
        <h1 className="text-3xl font-bold mt-6">Términos de reserva</h1>
        <p className="text-[var(--muted)] mt-3">Última actualización: octubre de 2026.</p>
        <div className="mt-8 text-[var(--muted)] leading-7 space-y-5">
          <p>La solicitud de turno queda registrada como pendiente y puede requerir confirmación del local. La disponibilidad se considera confirmada cuando la barbería la valida.</p>
          <h2 className="text-xl font-bold text-[var(--text)]">Cancelaciones</h2>
          <p>Si no podés asistir, cancelá tu turno desde el enlace recibido o avisá al local con la mayor anticipación posible para liberar el horario.</p>
          <h2 className="text-xl font-bold text-[var(--text)]">Datos incorrectos</h2>
          <p>Revisá nombre, teléfono, servicio, fecha y horario antes de confirmar. Si detectás un error, contactá al local.</p>
        </div>
      </article>
    </main>
  );
}
