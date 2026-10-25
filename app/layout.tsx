import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import NoZoom from "./components/NoZoom";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
    title: "BarberYá | Turnos online",
    description:
      "Reservá tu turno online en tu barbería.",
    keywords: [
      "barbería",
      "corte de pelo",
      "degradado",
      "barba",
      "turno online",
      "barbería cercana",
    ],
    openGraph: {
      title: "BarberYá | Turnos online",
      description: "Tu barbería de confianza. Cortes, barba, degradados y más.",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "BarberYá | Turnos online",
      description: "Reservá tu turno online en tu barbería.",
    },
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body
        // Silencia atributos que inyectan extensiones del navegador
        // (ej. ColorZilla agrega cz-shortcut-listen) antes de la hidratación.
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-zinc-950 text-zinc-100"
      >
        <NoZoom />
        {children}
      </body>
    </html>
  );
}
