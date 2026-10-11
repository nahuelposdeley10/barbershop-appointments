import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="booking-bg min-h-screen px-5 py-24">
      <article className="max-w-2xl mx-auto bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 sm:p-10">
        <Link href="/" className="text-accent font-bold text-sm">← Volver al inicio</Link>
        <h1 className="text-3xl font-bold mt-6">Política de privacidad</h1>
        <p className="text-[var(--muted)] mt-3">Última actualización: octubre de 2026.</p>
        <div className="mt-8 text-[var(--muted)] leading-7 space-y-5">
          <p>Usamos los datos que ingresás al reservar —nombre y teléfono— únicamente para gestionar tu turno y comunicarnos sobre ese servicio.</p>
          <h2 className="text-xl font-bold text-[var(--text)]">Conservación</h2>
          <p>Los datos se conservan durante el tiempo necesario para administrar la agenda y atender consultas. Podés solicitar corrección o eliminación contactando al local.</p>
          <h2 className="text-xl font-bold text-[var(--text)]">Contacto</h2>
          <p>Para ejercer tus derechos o consultar sobre el tratamiento de datos, comunicate con la barbería mediante los canales publicados en el sitio.</p>
        </div>
      </article>
    </main>
  );
}
