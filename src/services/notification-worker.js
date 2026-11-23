// Web Push payloads are transient; this worker stores no health content.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {}
  event.waitUntil(
    self.registration.showNotification("DiaGuide 服藥提醒", {
      body: "服藥時間到了，請檢查今日安排。",
      tag: `cloud-reminder:${payload.medicationId || ""}:${payload.date || ""}:${payload.slotId || ""}`,
      lang: "zh-HK",
      data: { url: self.location.origin + "/" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data;
  event.notification.close();
  if (!data?.url) return;
  const target = new URL(data.url);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const client = clients.find((c) => {
        const url = new URL(c.url);
        return (
          url.pathname === target.pathname &&
          url.searchParams.get("preview") === target.searchParams.get("preview")
        );
      });
      if (client) {
        try {
          await client.focus();
        } catch {
          /* Navigation still works when the browser blocks focus. */
        }
        if (data.intakeId)
          client.postMessage({
            type: "medication-notification",
            intakeId: data.intakeId,
          });
      } else {
        if (data.intakeId)
          target.hash = `medication=${encodeURIComponent(data.intakeId)}`;
        await self.clients.openWindow(target.href);
      }
    })(),
  );
});
