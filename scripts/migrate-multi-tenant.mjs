import crypto from "node:crypto";
import fs from "node:fs";
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const SUPERADMIN_EMAIL = "admin@gmail.com";
const OWNER_EMAIL = "nahuelposdeley10@gmail.com";
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || "";

function loadLocalEnv() {
  const path = ".env.local";
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

function slugify(value) {
  return String(value || "barberia")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63) || "barberia";
}

function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

function model(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema);
}

loadLocalEnv();
if (!process.env.MONGODB_URI) throw new Error("Falta MONGODB_URI");
if (APPLY && SUPERADMIN_PASSWORD.length < 4) {
  throw new Error("Para aplicar la migración definí SUPERADMIN_PASSWORD solo en el proceso actual.");
}

const AdminUser = model("AdminUser", new mongoose.Schema({
  email: String,
  passwordHash: String,
  role: String,
  tenantId: mongoose.Schema.Types.ObjectId,
}, { collection: "adminusers" }));
const Tenant = model("Tenant", new mongoose.Schema({
  slug: String,
  name: String,
  ownerId: mongoose.Schema.Types.ObjectId,
  status: String,
}, { collection: "tenants", timestamps: true }));
const Setting = model("Setting", new mongoose.Schema({ tenantId: mongoose.Schema.Types.ObjectId, barberName: String }, { collection: "settings" }));
const Booking = model("Booking", new mongoose.Schema({ tenantId: mongoose.Schema.Types.ObjectId }, { collection: "bookings" }));
const BookingLock = model("BookingLock", new mongoose.Schema({ tenantId: mongoose.Schema.Types.ObjectId, date: String }, { collection: "bookinglocks" }));

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
try {
  const owner = await AdminUser.findOne({ email: OWNER_EMAIL });
  if (!owner) throw new Error(`No existe el dueño actual ${OWNER_EMAIL}; no se migró nada.`);
  const settings = await Setting.findOne({});
  if (!settings) throw new Error("No existe configuración para migrar; no se migró nada.");

  let slug = slugify(settings.barberName || "barberia");
  let suffix = 1;
  while (await Tenant.exists({ slug, ownerId: { $ne: owner._id } })) {
    suffix += 1;
    slug = `${slugify(settings.barberName || "barberia")}-${suffix}`.slice(0, 63);
  }
  const existingTenant = await Tenant.findOne({ ownerId: owner._id });
  const tenantId = existingTenant?._id || new mongoose.Types.ObjectId();
  const counts = {
    legacyBookings: await Booking.countDocuments({ tenantId: { $exists: false } }),
    legacyLocks: await BookingLock.countDocuments({ tenantId: { $exists: false } }),
    superadminExists: Boolean(await AdminUser.exists({ email: SUPERADMIN_EMAIL })),
  };

  console.log(JSON.stringify({
    mode: APPLY ? "apply" : "dry-run",
    ownerEmail: OWNER_EMAIL,
    tenant: { id: String(tenantId), slug, name: settings.barberName || "Barbería" },
    counts,
    note: APPLY ? "La migración modificará solo esta base configurada en el proceso." : "No se modificó la base.",
  }, null, 2));
  if (!APPLY) process.exit(0);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const tenant = existingTenant || await Tenant.create([{
        _id: tenantId,
        slug,
        name: settings.barberName || "Barbería",
        ownerId: owner._id,
        status: "active",
      }], { session }).then((docs) => docs[0]);
      await AdminUser.updateOne({ _id: owner._id }, { $set: { role: "owner", tenantId: tenant._id } }, { session });
      await Setting.updateOne({ _id: settings._id }, { $set: { tenantId: tenant._id } }, { session });
      await Booking.updateMany({ tenantId: { $exists: false } }, { $set: { tenantId: tenant._id } }, { session });
      await BookingLock.updateMany({ tenantId: { $exists: false } }, { $set: { tenantId: tenant._id } }, { session });
      const superadmin = await AdminUser.findOne({ email: SUPERADMIN_EMAIL }).session(session);
      if (superadmin) {
        await AdminUser.updateOne({ _id: superadmin._id }, { $set: { role: "superadmin", tenantId: null } }, { session });
      } else {
        await AdminUser.create([{
          email: SUPERADMIN_EMAIL,
          passwordHash: passwordHash(SUPERADMIN_PASSWORD),
          role: "superadmin",
          tenantId: null,
        }], { session });
      }
    });
  } finally {
    await session.endSession();
  }
  const indexes = await BookingLock.collection.indexes();
  for (const index of indexes) {
    if (index.unique && index.key && Object.keys(index.key).length === 1 && index.key.date === 1) {
      await BookingLock.collection.dropIndex(index.name);
    }
  }
  await BookingLock.collection.createIndex({ tenantId: 1, date: 1 }, { unique: true });
  console.log("Migración multi-tenant aplicada correctamente.");
} finally {
  await mongoose.disconnect();
}
