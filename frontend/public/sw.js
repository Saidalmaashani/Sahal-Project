// Service Worker — سهل | Lock-Screen Push (iOS 16.4+ / Android)
// IMPORTANT: Must be served from root scope /

self.addEventListener('install', () => {
  // تثبيت فوري بدون انتظار
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // السيطرة على كل نوافذ التطبيق فوراً
  event.waitUntil(self.clients.claim());
});

// ===== استقبال Push من الخادم =====
self.addEventListener('push', (event) => {
  // Parse payload — iOS sends data even on locked screen
  let payload = { title: 'سهل', body: 'لديك إشعار جديد', url: '/shop' };
  if (event.data) {
    try { Object.assign(payload, event.data.json()); }
    catch { payload.body = event.data.text() || payload.body; }
  }

  // iOS Safari lock screen: MUST use these exact minimal options
  // Adding unsupported options (vibrate, badge, actions) silently breaks iOS
  const notifOptions = {
    body: payload.body,
    icon: '/logo192.png',
    data: { url: payload.url },
    // tag جديد لكل إشعار — لا تستبدله بإشعار قديم
    tag: 'sahal-' + Date.now(),
  };

  // event.waitUntil ضروري — يمنع iOS من إيقاف الـ SW قبل ظهور الإشعار
  event.waitUntil(
    self.registration.showNotification(payload.title, notifOptions)
  );
});

// ===== الضغط على الإشعار =====
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (self.location.origin) + (event.notification.data?.url || '/shop');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const c of clients) {
          if (c.url.startsWith(self.location.origin) && 'focus' in c) {
            c.focus();
            if ('navigate' in c) c.navigate(url);
            return;
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
