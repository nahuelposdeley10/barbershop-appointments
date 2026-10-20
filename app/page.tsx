import Image from "next/image";
import Link from "next/link";
import { cache } from "react";
import Navbar from "./components/Navbar";
import { BarberPole } from "./components/booking/BarberIcons";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/lib/booking-logic";

export const dynamic = "force-dynamic";

/* ─────────────────────────────────────────────
   Site data (read from the database)
   ───────────────────────────────────────────── */
type SiteService = { nombre: string; precio: number; duracion: number; img: string };
type SiteDay = { dia: string; horario: string };
type SiteProfesional = { nombre: string; rol: string; img: string; tags: string[] };

type SiteData = {
  nombre: string;
  slogan: string;
  heroTitle1: string;
  heroTitle2: string;
  heroDescription: string;
  aboutTitle: string;
  aboutTitle2: string;
  aboutText: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  email: string;
  direccion: string;
  mapaQuery: string;
  mapLink: string;
  imgHero: string;
  imgAbout: string;
  imgReservar: string;
  imgLogo: string;
  imgGaleria: string[];
  profesionales: SiteProfesional[];
  reservarUrl: string;
  servicios: SiteService[];
  horarios: SiteDay[];
};

const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

/* Unsplash images (real barbershop photos) */
const IMG = {
  hero: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=1800&auto=format&fit=crop",
  about:
    "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=1200&auto=format&fit=crop",
  reservar:
    "https://images.unsplash.com/photo-1747832802200-7aaceb517e0c?q=80&w=1200&auto=format&fit=crop",
  servicios: {
    corte:
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=800&auto=format&fit=crop",
    barba:
      "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=800&auto=format&fit=crop",
    degradado:
      "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?q=80&w=800&auto=format&fit=crop",
    cejas:
      "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=800&auto=format&fit=crop",
    diseno:
      "https://images.unsplash.com/photo-1747832802200-7aaceb517e0c?q=80&w=800&auto=format&fit=crop",
    combo:
      "https://images.unsplash.com/photo-1567894340315-735d7c361db0?q=80&w=800&auto=format&fit=crop",
  },
  galeria: [
    "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1747832802200-7aaceb517e0c?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1567894340315-735d7c361db0?q=80&w=800&auto=format&fit=crop",
  ],
  profesionales: [
    {
      nombre: "Lucas",
      rol: "Barbero Senior",
      img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=600&auto=format&fit=crop",
      tags: ["Degradados", "Corte clásico"],
    },
    {
      nombre: "Martín",
      rol: "Especialista en Barba",
      img: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=600&auto=format&fit=crop",
      tags: ["Barba", "Perfilado"],
    },
    {
      nombre: "Sofía",
      rol: "Estilista",
      img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=600&auto=format&fit=crop",
      tags: ["Color", "Diseños"],
    },
  ],
};

function fallbackSiteData(): SiteData {
  return {
    nombre: "Barbería Los Tilos",
    slogan: "Tu estilo, nuestra pasión",
    heroTitle1: "Tu Estilo,",
    heroTitle2: "Nuestra Pasión",
    heroDescription:
      "Cortes modernos, degradados impecables y una experiencia premium que te hace volver.",
    aboutTitle: "Más que un corte,",
    aboutTitle2: "una experiencia",
    aboutText:
      "Combinamos técnica, estilo y calidez para que cada visita sea única.",
    whatsapp: "5491100000000",
    instagram: "#",
    facebook: "#",
    email: "contacto@barberia.com",
    direccion: "Av. Ejemplo 1234, Ciudad",
    mapaQuery: "Av.+Ejemplo+1234,+Ciudad",
    mapLink: "https://maps.app.goo.gl/eYWFdpahSLpVakd68",
    imgHero: IMG.hero,
    imgAbout: IMG.about,
    imgReservar: IMG.reservar,
    imgLogo: "",
    imgGaleria: IMG.galeria,
    profesionales: IMG.profesionales,
    reservarUrl: "/reservar",
    servicios: [
      { nombre: "Corte de cabello", precio: 5000, duracion: 30, img: "" },
      { nombre: "Barba", precio: 3000, duracion: 20, img: "" },
      { nombre: "Corte y barba", precio: 7000, duracion: 40, img: "" },
    ],
    horarios: [
      { dia: "Lunes", horario: "09:00 - 20:00" },
      { dia: "Martes", horario: "09:00 - 20:00" },
      { dia: "Miércoles", horario: "09:00 - 20:00" },
      { dia: "Jueves", horario: "09:00 - 20:00" },
      { dia: "Viernes", horario: "09:00 - 20:00" },
      { dia: "Sábado", horario: "09:00 - 20:00" },
    ],
  };
}

async function getSiteDataFromDatabase(): Promise<SiteData> {
  await connectDB();
  const s = await getSettings();
    const servicios: SiteService[] = (s.services || []).map(
      (sv: { name: string; price: number; duration: number; img?: string }) => ({
        nombre: sv.name || "Servicio",
        precio: sv.price || 0,
        duracion: sv.duration || 30,
        img: sv.img || "",
      })
    );
    const horarios: SiteDay[] = (s.days || [])
      .filter((d: { enabled: boolean }) => d.enabled)
      .map((d: { day: number; open: string; close: string }) => ({
        dia: DAY_NAMES[d.day] || "",
        horario: `${d.open} - ${d.close}`,
      }));

    const profesionalesDb: SiteProfesional[] = (s.profesionales || []).map(
      (p: { nombre?: string; rol?: string; img?: string; tags?: string[] }) => ({
        nombre: p.nombre || "",
        rol: p.rol || "",
        img: p.img || "",
        tags: p.tags || [],
      })
    );

  return {
    nombre: typeof s.barberName === "string" ? s.barberName : "Barbería",
    slogan: s.slogan || "Tu estilo, nuestra pasión",
    heroTitle1: s.heroTitle1 || "Tu Estilo,",
    heroTitle2: s.heroTitle2 || "Nuestra Pasión",
    heroDescription:
      s.heroDescription ||
      "Cortes modernos, degradados impecables y una experiencia premium que te hace volver.",
    aboutTitle: s.aboutTitle || "Más que un corte,",
    aboutTitle2: s.aboutTitle2 || "una experiencia",
    aboutText:
      s.aboutText ||
      "Combinamos técnica, estilo y calidez para que cada visita sea única.",
    whatsapp: s.whatsapp || "5491100000000",
    instagram: s.instagram || "#",
    facebook: s.facebook || "#",
    email: s.email || "contacto@barberia.com",
    direccion: s.direccion || "Av. Ejemplo 1234, Ciudad",
    mapaQuery: s.mapaQuery || "Av.+Ejemplo+1234,+Ciudad",
    mapLink: s.mapLink || "https://maps.app.goo.gl/eYWFdpahSLpVakd68",
    imgHero: s.imgHero || IMG.hero,
    imgAbout: s.imgAbout || IMG.about,
    imgReservar: s.imgReservar || IMG.reservar,
    imgLogo: s.imgLogo || "",
    imgGaleria:
      s.imgGaleria && s.imgGaleria.length > 0 ? s.imgGaleria : IMG.galeria,
    profesionales: profesionalesDb.length > 0 ? profesionalesDb : IMG.profesionales,
    reservarUrl: "/reservar",
    servicios,
    horarios,
  };
}

const getSiteData = cache(async (): Promise<SiteData> => {
  try {
    return await Promise.race([
      getSiteDataFromDatabase(),
      new Promise<SiteData>((_, reject) => {
        // Keep this slightly above MongoDB's 3s connection timeout. A shorter
        // race can render the generic fallback while a cold function is still
        // establishing a healthy connection to the database.
        setTimeout(() => reject(new Error("Site data request timed out")), 3500);
      }),
    ]);
  } catch (error) {
    console.error("Site data unavailable; rendering fallback content", error);
    return fallbackSiteData();
  }
});

function serviceImage(name: string): string {
  const n = name.toLowerCase();
  if (/(barba|afeit|navaja|rasur)/.test(n)) return IMG.servicios.barba;
  if (/(degrada|fade|pompadour)/.test(n)) return IMG.servicios.degradado;
  if (/(ceja|brow)/.test(n)) return IMG.servicios.cejas;
  if (/(disen|design|diseño)/.test(n)) return IMG.servicios.diseno;
  if (/(corte.*barba|combo|completo)/.test(n)) return IMG.servicios.combo;
  return IMG.servicios.corte;
}

/* ─────────────────────────────────────────────
   SVG Icons
   ───────────────────────────────────────────── */
const Icons = {
  clock: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  mapPin: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  phone: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  arrow: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  ),
  instagram: (
    <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  ),
  facebook: (
    <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  scissors: (
    <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  ),
  quote: (
    <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6.5 10c-.7 0-1.3.1-1.9.4.5-2. Guards 2.6 3.7 4.4 1.8 2.7 1.1 1.1 1.5 2.5 1.5 4.2 0 1.8-1.5 3.2-3.2 3.2-1.9 0-3.4-1.6-3.4-3.6 0-.2 0-.4.1-.6-.5-1.4-.9-3.4-.9-5.1C-1 9.6 1.4 7 4.4 7c1.2 0 2.1.9 2.1 2 0 1.2-.9 2-2 2z" />
    </svg>
  ),
  star: (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  ),
  whatsapp: (
    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  ),
};

/* ─────────────────────────────────────────────
   SECTIONS
   ───────────────────────────────────────────── */
function SectionDivider() {
  return (
    <div className="flex items-center justify-center gap-4 py-2 opacity-50">
      <div className="h-px w-24 bg-zinc-800" />
      <BarberPole className="w-24 h-[6px]" />
      <div className="h-px w-24 bg-zinc-800" />
    </div>
  );
}

function Hero({ data }: { data: SiteData }) {
  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden scroll-mt-0">
      {/* Background with image */}
      <div className="absolute inset-0">
        <Image
          src={data.imgHero}
          alt="Barbería profesional"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-zinc-950/70" />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/60 to-zinc-950" />
      </div>

      {/* Decorative */}
      <div className="absolute top-24 left-8 w-px h-40 bg-gradient-to-b from-accent/40 to-transparent hidden sm:block" />
      <div className="absolute bottom-24 right-10 w-px h-60 bg-gradient-to-b from-accent/30 to-transparent hidden sm:block" />

      {/* Decorative vertical Barber Poles */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden lg:block">
        <BarberPole vertical className="h-48 opacity-60" />
      </div>
      <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden lg:block">
        <BarberPole vertical className="h-48 opacity-60" />
      </div>

      <div className="relative z-10 text-center px-4 sm:px-6 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-center gap-3 mb-6 sm:mb-8">
          <div className="h-px w-10 sm:w-12 bg-accent/60" />
          <span className="text-accent text-xs sm:text-sm font-medium tracking-[0.3em] sm:tracking-[0.35em] uppercase">
            Estilo & Tradición
          </span>
          <div className="h-px w-10 sm:w-12 bg-accent/60" />
        </div>

        <h1 className="font-display text-[40px] min-[400px]:text-5xl sm:text-7xl lg:text-8xl font-bold leading-[1.05] tracking-tight mb-6 break-words">
          {data.heroTitle1}
          <br />
          <span className="text-accent">{data.heroTitle2}</span>
        </h1>

        <p className="text-zinc-300 text-base sm:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
          {data.heroDescription} En {data.nombre || "la barbería"} nos importa cada detalle.
        </p>

        <div className="flex justify-center mb-8 sm:mb-10">
          <BarberPole className="w-32 sm:w-40 h-[7px]" />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 w-full">
          <Link
            href={data.reservarUrl}
            className="bg-accent text-zinc-950 px-9 py-4 rounded-full font-semibold text-base hover:bg-accent-hover transition-all hover:shadow-[0_0_40px_rgba(212,168,83,0.4)] flex items-center justify-center gap-2 group"
          >
            Reservar Turno
            <span className="group-hover:translate-x-1 transition-transform">{Icons.arrow}</span>
          </Link>
          <a
            href="#servicios"
            className="border border-zinc-500/60 text-zinc-200 px-9 py-4 rounded-full font-medium text-base hover:border-accent hover:text-accent transition-all bg-zinc-900/30 backdrop-blur-sm flex items-center justify-center"
          >
            Ver Servicios
          </a>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8 mt-12 sm:mt-14 text-sm text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="text-accent">{Icons.star}</span>
            <span>+500 clientes felices</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-zinc-700" />
          <div className="flex items-center gap-2">
            <span className="text-accent">{Icons.clock}</span>
            <span>Reserva online 24/7</span>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-zinc-500/60 rounded-full flex justify-center pt-2">
          <div className="w-1 h-2 bg-zinc-400 rounded-full" />
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={`mb-12 sm:mb-16 ${align === "center" ? "text-center" : "text-left"}`}>
      <span className="text-accent text-xs sm:text-sm font-medium tracking-[0.25em] uppercase">
        {eyebrow}
      </span>
      <h2 className="font-display text-3xl sm:text-5xl font-bold mt-3 sm:mt-4 mb-4 sm:mb-5 leading-tight">
        {title}
      </h2>
      {description && (
        <p className="text-zinc-400 max-w-xl mx-auto text-base sm:text-lg leading-relaxed">{description}</p>
      )}
    </div>
  );
}

function Profesionales({ data }: { data: SiteData }) {
  const profesionales = data.profesionales.filter((p) => p.nombre && p.img);
  if (profesionales.length === 0) return null;
  return (
    <section id="profesionales" className="py-20 sm:py-24 px-4 bg-zinc-900/30 scroll-mt-16">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="Nuestro equipo"
          title="Profesionales Expertos"
          description="Un equipo de barberos y estilistas apasionados, listos para darte el mejor servicio."
        />

        <div className="flex flex-wrap justify-center gap-5 sm:gap-8">
          {profesionales.map((prof) => (
            <div
              key={prof.nombre}
              className="group relative rounded-2xl overflow-hidden border border-card-border hover:border-accent/40 transition-all w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.3333rem)]"
            >
              <div className="relative aspect-[3/4] overflow-hidden">
                <Image
                  src={prof.img}
                  alt={prof.nombre}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h3 className="font-display text-2xl font-bold">{prof.nombre}</h3>
                <p className="text-accent text-sm mb-3">{prof.rol}</p>
                <div className="flex flex-wrap gap-2">
                  {prof.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] bg-zinc-950/70 backdrop-blur-sm border border-zinc-700/50 px-2.5 py-1 rounded-full text-zinc-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Servicios({ data }: { data: SiteData }) {
  const servicios = data.servicios.map((sv) => ({
    nombre: sv.nombre,
    precio: `$${sv.precio.toLocaleString("es-AR")}`,
    duracion: `${sv.duracion} min`,
    img: sv.img || serviceImage(sv.nombre),
  }));

  return (
    <section id="servicios" className="py-20 sm:py-24 px-4 scroll-mt-16">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="Lo que ofrecemos"
          title="Nuestros Servicios"
          description="Servicios premium diseñados para que salgas con la mejor actitud y el look perfecto."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {servicios.map((servicio) => (
            <div
              key={servicio.nombre}
              className="group overflow-hidden rounded-2xl border border-card-border bg-card hover:border-accent/50 transition-all hover:-translate-y-1"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={servicio.img}
                  alt={servicio.nombre}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 to-transparent" />
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-semibold">{servicio.nombre}</h3>
                  <span className="text-accent font-bold text-lg">{servicio.precio}</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-500 text-sm">
                  {Icons.clock}
                  <span>{servicio.duracion}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SobreNosotros({ data }: { data: SiteData }) {
  return (
    <section className="py-20 sm:py-24 px-4 bg-zinc-900/30">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
        <div className="relative">
          <div className="rounded-2xl overflow-hidden border border-card-border relative aspect-[4/3]">
            <Image
              src={data.imgAbout}
              alt="Equipo de la barbería"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="absolute -bottom-4 right-2 sm:-bottom-6 sm:-right-4 bg-accent text-zinc-950 rounded-2xl px-5 py-4 sm:p-6 shadow-2xl">
            <p className="font-display text-3xl sm:text-4xl font-bold leading-none">+10</p>
            <p className="text-xs sm:text-sm font-medium mt-1">años de experiencia</p>
          </div>
        </div>

        <div>
          <span className="text-accent text-xs sm:text-sm font-medium tracking-[0.25em] uppercase">
            Sobre nosotros
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-bold mt-3 sm:mt-4 mb-4 sm:mb-6 leading-tight">
            {data.aboutTitle}
            <br />
            {data.aboutTitle2}
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg leading-relaxed mb-6">
            {data.aboutText}
          </p>
          <div className="grid grid-cols-3 gap-4 sm:gap-6 mb-8">
            {[
              ["+500", "Clientes"],
              ["12k", "Cortes"],
              ["4.9★", "Valoración"],
            ].map(([num, label]) => (
              <div key={label}>
                <p className="font-display text-2xl sm:text-3xl font-bold text-accent">{num}</p>
                <p className="text-zinc-500 text-xs sm:text-sm">{label}</p>
              </div>
            ))}
          </div>
          <Link
            href={data.reservarUrl}
            className="inline-flex items-center justify-center gap-2 bg-accent text-zinc-950 px-8 py-3.5 rounded-full font-semibold hover:bg-accent-hover transition-all w-full sm:w-auto"
          >
            Reservá tu turno
            {Icons.arrow}
          </Link>
        </div>
      </div>
    </section>
  );
}

function Galeria({ data }: { data: SiteData }) {
  return (
    <section id="galeria" className="py-20 sm:py-24 px-4 scroll-mt-16">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="Nuestro trabajo habla"
          title="Galería"
          description="Mirá algunos de los trabajos que hacemos todos los días."
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {data.imgGaleria.map((src, i) => (
            <div
              key={i}
              className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer"
            >
              <Image
                src={src}
                alt={`Trabajo ${i + 1}`}
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-zinc-950/0 group-hover:bg-zinc-950/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="text-accent">{Icons.scissors}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Resenas({ nombre }: { nombre: string }) {
  const resenas = [
    {
      nombre: "Juan P.",
      texto:
        "El mejor lugar para hacerse un degradado. Salí renovado y el ambiente es espectacular.",
    },
    {
      nombre: "Carlos G.",
      texto:
        "Atención de primera, profesionales de verdad. La reserva online funciona perfecto.",
    },
    {
      nombre: "Mauro L.",
      texto:
        "Llevo a mis hijos y la experiencia siempre es perfecta. Recomendado 100%.",
    },
  ];

  return (
    <section className="py-20 sm:py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="Opiniones reales"
          title="Lo que dicen nuestros clientes"
          description={`La confianza de miles de clientes que eligen ${nombre || "la barbería"}.`}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {resenas.map((resena) => (
            <div
              key={resena.nombre}
              className="bg-card border border-card-border rounded-2xl p-8 hover:border-accent/30 transition-all"
            >
              <div className="flex text-accent mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i}>{Icons.star}</span>
                ))}
              </div>
              <p className="text-zinc-300 leading-relaxed mb-6">&ldquo;{resena.texto}&rdquo;</p>
              <p className="font-semibold text-accent">{resena.nombre}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Reservar({ data }: { data: SiteData }) {
  return (
    <section className="py-20 sm:py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden border border-card-border">
          <Image
            src={data.imgReservar}
            alt="Reservá tu turno"
            fill
            sizes="100vw"
            className="object-cover absolute inset-0"
          />
          <div className="absolute inset-0 bg-zinc-950/85" />

          <div className="relative z-10 p-7 sm:p-16 text-center">
            <span className="text-accent text-xs sm:text-sm font-medium tracking-[0.25em] uppercase">
              ¿Listo para un cambio?
            </span>
            <h2 className="font-display text-3xl sm:text-5xl font-bold mt-3 sm:mt-4 mb-4 sm:mb-6 leading-tight">
              Reservá Tu Turno
            </h2>
            <p className="text-zinc-300 max-w-lg mx-auto mb-8 sm:mb-10 text-base sm:text-lg">
              Elegí el servicio, dia, horario y confirmá en segundos. Rápido y fácil,
              desde tu celular o computadora.
            </p>

            <Link
              href={data.reservarUrl}
              className="inline-flex items-center justify-center gap-2 bg-accent text-zinc-950 px-10 py-4 rounded-full font-bold text-lg hover:bg-accent-hover transition-all hover:shadow-[0_0_50px_rgba(212,168,83,0.3)] w-full sm:w-auto"
            >
              Reservar Ahora
              {Icons.arrow}
            </Link>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 mt-8 text-sm text-zinc-400">
              <span className="flex items-center gap-1.5">
                {Icons.clock}
                Confirmación instantánea
              </span>
              <span className="hidden sm:flex items-center gap-1.5">
                {Icons.phone}
                Soporte por WhatsApp
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Ubicacion({ data }: { data: SiteData }) {
  const dias = data.horarios;
  const mapLink = data.mapLink || `https://www.google.com/maps/search/?api=1&query=${data.mapaQuery}`;

  return (
    <section id="ubicacion" className="py-20 sm:py-24 px-4 bg-zinc-900/30 scroll-mt-16">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="Visitános"
          title="Ubicación & Horarios"
          description="Encontranos fácil y reservá tu próximo turno."
        />

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="group relative h-[320px] overflow-hidden rounded-2xl border border-card-border sm:h-[400px]">
            <iframe
              src={`https://www.google.com/maps?q=${data.mapaQuery}&output=embed`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`Ubicación de ${data.nombre || "la barbería"}`}
              className="pointer-events-none"
            />
            <a
              href={mapLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir la ubicación de ${data.nombre || "la barbería"} en Google Maps`}
              className="absolute inset-0 z-10 flex items-end bg-zinc-950/0 p-4 transition-colors hover:bg-zinc-950/10 focus-visible:bg-zinc-950/20 focus-visible:outline-none"
            >
              <span className="rounded-full bg-zinc-950/85 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition-transform group-hover:-translate-y-1 group-focus-within:-translate-y-1">
                Abrir en Google Maps
              </span>
            </a>
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-card border border-card-border rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <span className="text-accent mt-0.5">{Icons.mapPin}</span>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Dirección</h3>
                  <a
                    href={mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-accent transition-colors"
                  >
                    {data.direccion}
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-card border border-card-border rounded-2xl p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <span className="text-accent">{Icons.clock}</span>
                Horarios
              </h3>
              <div className="space-y-2">
                {dias.map((d) => (
                  <div key={d.dia} className="flex justify-between text-sm">
                    <span className="text-zinc-400">{d.dia}</span>
                    <span className="text-zinc-200 font-medium">{d.horario}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-card-border rounded-2xl p-6">
              <h3 className="font-semibold text-lg mb-4">Contacto</h3>
              <div className="flex flex-wrap gap-3">
                <a
                  href={`https://wa.me/${data.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-green-600/20 text-green-400 border border-green-600/30 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-green-600/30 transition-colors"
                >
                  {Icons.whatsapp}
                  WhatsApp
                </a>
                <a
                  href={data.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-pink-600/20 text-pink-400 border border-pink-600/30 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-pink-600/30 transition-colors"
                >
                  {Icons.instagram}
                  Instagram
                </a>
                <a
                  href={`mailto:${data.email}`}
                  className="flex items-center gap-2 bg-zinc-700/20 text-zinc-300 border border-zinc-700/30 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-700/30 transition-colors"
                >
                  {Icons.phone}
                  Email
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ data }: { data: SiteData }) {
  return (
    <footer className="border-t border-zinc-800/50 py-14 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
              <span className="text-accent">{Icons.scissors}</span>
              {data.nombre && (
                <span className="font-display text-xl font-bold">{data.nombre}</span>
              )}
            </div>
            <p className="text-zinc-500 text-sm max-w-xs">
              {data.slogan}. Cortes premium y un servicio que te hace volver.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <a
              href={data.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-accent transition-colors"
              aria-label="Instagram"
            >
              {Icons.instagram}
            </a>
            <a
              href={data.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-accent transition-colors"
              aria-label="Facebook"
            >
              {Icons.facebook}
            </a>
            <a
              href={`https://wa.me/${data.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-accent transition-colors"
              aria-label="WhatsApp"
            >
              {Icons.whatsapp}
            </a>
          </div>

          <p className="text-zinc-600 text-sm text-center">
            © {new Date().getFullYear()}{data.nombre ? ` ${data.nombre}` : ""}. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────── */
export async function generateMetadata() {
  const data = await getSiteData();
  return {
    title: data.nombre || "Barbería",
    description: `${data.slogan}. Cortes premium y un servicio que te hace volver.`,
  };
}

export default async function Home() {
  const data = await getSiteData();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: data.nombre || "Barbería",
    description: data.heroDescription,
    url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    telephone: data.whatsapp ? `+${data.whatsapp}` : undefined,
    email: data.email || undefined,
    address: data.direccion
      ? { "@type": "PostalAddress", streetAddress: data.direccion }
      : undefined,
    sameAs: [data.instagram, data.facebook].filter((url) => url && url !== "#"),
    makesOffer: data.servicios.map((service) => ({
      "@type": "Offer",
      name: service.nombre,
      price: service.precio,
      priceCurrency: "ARS",
    })),
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Navbar nombre={data.nombre} logo={data.imgLogo} />
      <main className="flex-1">
        <Hero data={data} />
        <SectionDivider />
        <Profesionales data={data} />
        <Servicios data={data} />
        <SobreNosotros data={data} />
        <Galeria data={data} />
        <Resenas nombre={data.nombre} />
        <Reservar data={data} />
        <Ubicacion data={data} />
      </main>
      <Footer data={data} />
    </>
  );
}
