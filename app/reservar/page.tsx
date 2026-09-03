import type { Metadata } from "next";
import BookingPage from "../components/booking/BookingPage";
import { getSettings } from "@/lib/booking-logic";

export async function generateMetadata(): Promise<Metadata> {
  let nombre = "BarberYá";
  try {
    const s = await getSettings();
    if (s?.barberName) nombre = s.barberName;
  } catch {
    // fallback
  }

  return {
    title: `Reservá tu turno · ${nombre}`,
    description: `Reservá tu turno online en ${nombre}. Elegí servicio, día y hora en segundos.`,
  };
}

export default function Reservar() {
  return <BookingPage />;
}
