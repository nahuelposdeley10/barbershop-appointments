import type { Metadata } from "next";
import BookingPage from "../components/booking/BookingPage";

export const metadata: Metadata = {
  title: "Reservá tu turno · BarberYá",
  description: "Reservá tu turno online. Elegí servicio, día y hora en segundos.",
};

export default function Reservar() {
  return <BookingPage />;
}
