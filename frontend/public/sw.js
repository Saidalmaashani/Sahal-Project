// Service Worker — سهل Web Push
// iOS 16.4+ compatible

self.addEventListener('push', (event) => {
  // لا تتجاهل حتى لو البيانات فارغة
  let data = {};
  if (event.data) {
    try { data = event.data.json(); }
    catch { data = { title: 'سهل', body: event.data.text() }; }
  }

  const title = data.title || 'سهل';

  // iOS Safari: أبسط options ممكنة (لا badge, لا vibrate, لا actions, لا image)
  const options = {
    body: data.body || '',
    icon: '/logo192.png',
    data: { url: data.url || '/shop' },
    tag: 'sahal-' + (data.tag || Date.now()),
    // dir و lang مهمين للعربية
    dir: 'rtl',
    lang: 'ar',
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ضغط على الإشعار → فتح التطبيق
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/shop';
  const origin = self.location.origin;
  const fullUrl = targetUrl.startsWith('http') ? targetUrl : origin + targetUrl;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.startsWith(origin) && 'focus' in client) {
            client.focus();
            if ('navigate' in client) client.navigate(fullUrl);
            return;
          }
        }
        return clients.openWindow(fullUrl);
      })
  );
});

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(clients.claim()); });
