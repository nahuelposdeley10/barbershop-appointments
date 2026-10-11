import mongoose from "mongoose";

const daySchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true },
    enabled: { type: Boolean, default: true },
    open: { type: String, default: "09:00" },
    close: { type: String, default: "20:00" },
  },
  { _id: false }
);

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, default: 0 },
    duration: { type: Number, default: 30 },
    img: { type: String, default: "" },
  },
  { _id: false }
);

const profesionalSchema = new mongoose.Schema(
  {
    nombre: { type: String, default: "" },
    rol: { type: String, default: "" },
    img: { type: String, default: "" },
    tags: { type: [String], default: [] },
  },
  { _id: false }
);

const settingSchema = new mongoose.Schema({
  barberName: { type: String, default: "Barbería" },
  message: { type: String, default: "Reservá tu turno online" },
  slogan: { type: String, default: "Tu estilo, nuestra pasión" },
  heroTitle1: { type: String, default: "Tu Estilo," },
  heroTitle2: { type: String, default: "Nuestra Pasión" },
  heroDescription: {
    type: String,
    default:
      "Cortes modernos, degradados impecables y una experiencia premium que te hace volver.",
  },
  aboutTitle: { type: String, default: "Más que un corte," },
  aboutTitle2: { type: String, default: "una experiencia" },
  aboutText: {
    type: String,
    default:
      "Combinamos técnica, estilo y calidez para que cada visita sea única. Nuestros profesionales están al día con las últimas tendencias en cortes y cuidado personal.",
  },
  whatsapp: { type: String, default: "5491100000000" },
  instagram: { type: String, default: "#" },
  facebook: { type: String, default: "#" },
  email: { type: String, default: "contacto@barberia.com" },
  direccion: { type: String, default: "Av. Ejemplo 1234, Ciudad" },
  mapaQuery: { type: String, default: "Av.+Ejemplo+1234,+Ciudad" },
  imgHero: { type: String, default: "" },
  imgAbout: { type: String, default: "" },
  imgReservar: { type: String, default: "" },
  imgGaleria: { type: [String], default: [] },
  profesionales: { type: [profesionalSchema], default: [] },
  services: { type: [serviceSchema], default: [] },
  days: { type: [daySchema], default: [] },
  slotMinutes: { type: Number, default: 30 },
  cantidadBarberos: { type: Number, default: 1, min: 1 },
  // Legacy field kept only long enough to migrate existing installations.
  pin: { type: String, default: "", select: false },
  pinHash: { type: String, default: "", select: false },
  unavailableDates: { type: [String], default: [] },
});

export type DaySetting = {
  day: number;
  enabled: boolean;
  open: string;
  close: string;
};

export type ServiceSetting = {
  name: string;
  price: number;
  duration: number;
  img: string;
};

export type ProfesionalSetting = {
  nombre: string;
  rol: string;
  img: string;
  tags: string[];
};

export type SettingsDoc = {
  barberName: string;
  message: string;
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
  imgHero: string;
  imgAbout: string;
  imgReservar: string;
  imgGaleria: string[];
  profesionales: ProfesionalSetting[];
  services: ServiceSetting[];
  days: DaySetting[];
  slotMinutes: number;
  cantidadBarberos: number;
  pin?: string;
  pinHash?: string;
  unavailableDates: string[];
};

export const Setting =
  (mongoose.models.Setting as mongoose.Model<SettingsDoc>) ||
  mongoose.model("Setting", settingSchema);
