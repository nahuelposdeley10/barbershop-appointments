self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = typeof data.title === "string" ? data.title : "Nueva reserva";
  const body = typeof data.body === "string" ? data.body : "Tenés una nueva reserva en BarberYá.";
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/admin";
  const tag = typeof data.tag === "string" ? data.tag : `barberya-${Date.now()}`;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/barberya-icon.svg",
      badge: "/barberya-icon.svg",
      tag,
      renotify: true,
      vibrate: [120, 60, 120],
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url || "/admin";
  const targetUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windowClients) => {
      for (const client of windowClients) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        if ("navigate" in client) await client.navigate(targetUrl);
        return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
