const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

async function check(name, path, expectedStatus, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  if (response.status !== expectedStatus) {
    throw new Error(`${name}: esperaba ${expectedStatus} y recibí ${response.status}`);
  }
  return response;
}

await check("health", "/api/health", 200);
const session = await check("sesión anónima", "/api/admin/session", 200);
const sessionBody = await session.json();
if (sessionBody.authenticated !== false) {
  throw new Error("sesión anónima: el endpoint informó una sesión válida");
}
await check("admin protegido", "/api/admin/bookings", 401);
await check("validación de reserva", "/api/bookings", 400, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "", phone: "", service: "", date: "bad", time: "bad" }),
});

console.log(`Smoke test OK: ${baseUrl}`);
