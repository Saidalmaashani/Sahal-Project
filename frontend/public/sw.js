// Service Worker — سهل Web Push
const CACHE_NAME = 'sahal-v1';

// استقبال إشعار Push
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'سهل', body: event.data.text(), url: '/' };
  }

  const title = data.title || 'سهل';
  const options = {
    body: data.body || '',
    icon: '/logo192.png',
    badge: '/logo72.png',
    image: data.image || undefined,
    data: { url: data.url || '/' },
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    tag: data.tag || 'sahal-notif',
    renotify: true,
    actions: data.url ? [
      { action: 'open', title: 'فتح التطبيق' },
      { action: 'close', title: 'إغلاق' },
    ] : [],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ضغط على الإشعار → فتح التطبيق
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/';
  const origin = self.location.origin;
  const fullUrl = targetUrl.startsWith('http') ? targetUrl : origin + targetUrl;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // إذا كان التطبيق مفتوحاً بالفعل
      for (const client of windowClients) {
        if (client.url.startsWith(origin)) {
          client.focus();
          client.navigate(fullUrl);
          return;
        }
      }
      // افتح نافذة جديدة
      return clients.openWindow(fullUrl);
    })
  );
});

// تثبيت Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
