"use client";

import Image from "next/image";

type IconProps = {
  service: string;
  className?: string;
};

/* ── Formas base (24×24, trazo de 1.7) ──────────────────────────
   Se dibujan para que se lean a 24px, que es el tamaño real
   dentro de la tarjeta de servicio. */

const scissors = (
  <>
    <circle cx="6" cy="6.4" r="2.9" />
    <circle cx="6" cy="17.6" r="2.9" />
    <path d="M8.4 8.2 20 18.3" />
    <path d="M20 5.7 8.4 15.8" />
    <path d="M8.4 15.8 10.6 13.9" />
  </>
);

/** Hoja de afeitar de doble filo: se reconoce como "barba/afeitado". */
const razorBlade = (
  <>
    <rect x="3.2" y="6.6" width="17.6" height="10.8" rx="1.6" />
    <rect x="8.4" y="10.4" width="7.2" height="3.2" rx="1.6" />
    <path d="M10 6.6v1.4M14 6.6v1.4M10 16v1.4M14 16v1.4" />
  </>
);

const mustache = (
  <path
    d="M12 11.4c-1.7-2.1-3.6-2.9-5-1.9-1.7 1.3-2.6 3.2-2.5 4.7.8-.4 1.5-.3 2 .2.9-1.2 2.3-1.9 3.4-1.5.7.3 1.4 1 2.1 2.1.7-1.1 1.4-1.8 2.1-2.1 1.1-.4 2.5.3 3.4 1.5.5-.5 1.2-.6 2-.2.1-1.5-.8-3.4-2.5-4.7-1.4-1-3.3-.2-5 1.9Z"
    fill="currentColor"
    stroke="none"
  />
);

const comb = (
  <>
    <rect x="4.6" y="3.4" width="14.8" height="5" rx="1.3" fill="currentColor" opacity="0.32" stroke="none" />
    <path d="M4.6 8.4h14.8" />
    <path d="M7.4 8.4v7.4M11 8.4v9.4M14.6 8.4v7.4M17.8 8.4v9.4" />
  </>
);

/** Corte + barba: la tijera arriba y la hoja abajo, cada una más chica. */
const scissorsAndBlade = (
  <>
    <g transform="translate(3.2 -.4) scale(.64)" strokeWidth={2.5}>
      {scissors}
    </g>
    <g transform="translate(4.4 12.2) scale(.62)" strokeWidth={2.5}>
      {razorBlade}
    </g>
  </>
);

export function ServiceIcon({ service, className = "" }: IconProps) {
  const n = service.toLowerCase();

  const esCorteYBarba = /(corte.*barba)|(barba.*corte)/.test(n);
  const esBarba = /(barba|barbit|afeit|navaja|rasur|maquinilla|perfilad)/.test(n);
  const esBigote = /(bigote|mustache)/.test(n);
  const esPelo = /(cepill|lavado|peinado|color|alaciad|keratina|brushing|dise[nñ])/.test(n);

  const forma = esCorteYBarba
    ? scissorsAndBlade
    : esBarba
      ? razorBlade
      : esBigote
        ? mustache
        : esPelo
          ? comb
          : scissors;

  return (
    <span
      className={`grid place-items-center w-12 h-12 rounded-[14px] bg-gradient-to-br from-accent/25 to-accent/5 border border-accent/30 text-accent shrink-0 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-6 h-6"
        aria-hidden="true"
        focusable="false"
      >
        {forma}
      </svg>
    </span>
  );
}

/** Miniatura del servicio: usa la foto cargada si existe y, si no, el ícono. */
export function ServiceThumb({ service, img, className = "" }: IconProps & { img?: string }) {
  if (img) {
    return (
      <Image
        src={img}
        alt=""
        width={48}
        height={48}
        sizes="48px"
        className={`h-12 w-12 shrink-0 rounded-[14px] border border-[var(--border)] object-cover ${className}`}
      />
    );
  }
  return <ServiceIcon service={service} className={className} />;
}

export function BarberPole({
  vertical = false,
  className = "",
}: {
  vertical?: boolean;
  className?: string;
}) {
  const base = {
    width: 8,
    background:
      "repeating-linear-gradient(0deg,#e23b3b,#e23b3b 14px,#f4f4f4 14px,#f4f4f4 28px,#3b74e2 28px,#3b74e2 42px)",
    backgroundSize: "100% 42px",
    animation: "pole-spin-v 2.4s linear infinite",
    boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
  };

  if (vertical) {
    return (
      <span
        aria-hidden="true"
        className={`inline-block rounded-full border border-white/25 ${className}`}
        style={base}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-block rounded-full border border-white/25 ${className}`}
      style={{
        height: 7,
        background:
          "repeating-linear-gradient(90deg,#e23b3b,#e23b3b 14px,#f4f4f4 14px,#f4f4f4 28px,#3b74e2 28px,#3b74e2 42px)",
        backgroundSize: "42px 100%",
        animation: "pole-spin 2.4s linear infinite",
        boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
      }}
    />
  );
}
