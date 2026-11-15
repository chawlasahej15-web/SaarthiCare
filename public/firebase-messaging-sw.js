/*
 * Minimal service worker display handler for Firebase Cloud Messaging web push.
 * The FCM SDK obtains the subscription via the service worker registration.
 * This worker intentionally contains no project credentials or API secrets.
 */
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { notification: { body: event.data?.text() ?? '' } }; }
  const notification = payload.notification ?? payload.data ?? {};
  const title = notification.title ?? 'SaarthiCare update';
  const body = notification.body ?? 'There is a new update in your care circle.';
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: payload.data?.reminderId ?? 'saarthicare-reminder',
    data: { url: payload.data?.url ?? '/dashboard' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? '/dashboard', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if (client.url === target && 'focus' in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
    return undefined;
  }));
});
