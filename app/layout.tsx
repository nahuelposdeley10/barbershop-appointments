import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { getSettings } from "@/lib/booking-logic";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  let nombre = "BarberYá";
  try {
    const s = await getSettings();
    if (s?.barberName) nombre = s.barberName;
  } catch {
    // fallback: no romper el layout raíz si la DB no responde
  }

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
    title: `${nombre} | Tu barbería de confianza`,
    description:
      `Cortes modernos, degradados, barba y más. Reservá tu turno online en ${nombre}.`,
    keywords: [
      "barbería",
      "corte de pelo",
      "degradado",
      "barba",
      "turno online",
      "barbería cercana",
    ],
    openGraph: {
      title: nombre,
      description: "Tu barbería de confianza. Cortes, barba, degradados y más.",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: nombre,
      description: `Reservá tu turno online en ${nombre}.`,
    },
    alternates: { canonical: "/" },
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  );
}
