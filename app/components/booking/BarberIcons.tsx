"use client";

type IconProps = {
  service: string;
  className?: string;
};

export function ServiceIcon({ service, className = "" }: IconProps) {
  const n = service.toLowerCase();
  let icon: React.ReactNode;

  const base = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (/(barba|afeit|navaja|rasur|perfilad)/.test(n)) {
    icon = (
      <svg {...base}>
        <path d="M20.5 3.5L9.5 14.5" />
        <path d="M9.5 14.5L11 23" />
        <path d="M20.5 3.5l1.9 1.9" />
        <path d="M9.5 14.5l-3.4 3.4-2.3.9.9-2.3 3.4-3.4" />
      </svg>
    );
  } else if (/(bigote|mustache|barbita)/.test(n)) {
    icon = (
      <svg {...base} stroke="none">
        <path
          d="M2.5 12.5c1.9-1.5 3.6-1.8 4.5-.6.4.6 1 .4 1.2-2.6.2-1 .6-1.4 1.8-1.4s1.6.4 1.8 1.4c.2 3 .8 3.2 1.2 2.6.9-1.2 2.6-.9 4.5.6-1.1 3.4-3.3 5-7.5 5s-6.4-1.6-7.5-5z"
          fill="currentColor"
        />
      </svg>
    );
  } else if (/(cepillado|lavado|peinado|color|alaciado|keratina|brushing|diseñ|disen)/.test(n)) {
    icon = (
      <svg {...base}>
        <rect x="5" y="3" width="14" height="5.5" rx="1.2" fill="currentColor" opacity="0.35" />
        <path d="M7.5 8.5v6.5M12 8.5v8.5M16.5 8.5v6.5M19.5 9.5v9" />
      </svg>
    );
  } else {
    icon = (
      <svg {...base}>
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <line x1="20" y1="4" x2="8.12" y2="15.88" />
        <line x1="14.47" y1="14.48" x2="20" y2="20" />
        <line x1="8.12" y1="8.12" x2="12" y2="12" />
      </svg>
    );
  }

  return (
    <span
      className={`grid place-items-center w-11 h-11 rounded-xl bg-accent/15 text-accent shrink-0 ${className}`}
    >
      {icon}
    </span>
  );
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
