import api from './api';

// تحويل base64url إلى Uint8Array لـ VAPID
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

export const isPushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const getPushPermission = () => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
};

export const getActiveSubscription = async () => {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
};

export const subscribeToPush = async () => {
  if (!isPushSupported()) throw new Error('Push not supported in this browser');

  // جلب المفتاح العام
  let publicKey;
  try {
    const { data } = await api.get('/push/vapid-key');
    publicKey = data.public_key;
    if (!publicKey || publicKey.length < 10) throw new Error('Invalid VAPID public key from server');
  } catch (e) {
    throw new Error(`Failed to get VAPID key: ${e.message}`);
  }

  // تسجيل Service Worker
  let reg;
  try {
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await new Promise((resolve, reject) => {
      if (reg.active) { resolve(); return; }
      const sw = reg.installing || reg.waiting;
      if (sw) {
        sw.addEventListener('statechange', (e) => {
          if (e.target.state === 'activated') resolve();
          if (e.target.state === 'redundant') reject(new Error('SW redundant'));
        });
      } else {
        resolve();
      }
    });
  } catch (e) {
    throw new Error(`Service Worker registration failed: ${e.message}`);
  }

  // إلغاء أي اشتراك قديم
  const existing = await reg.pushManager.getSubscription();
  if (existing) await existing.unsubscribe();

  // اشتراك جديد
  let subscription;
  try {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  } catch (e) {
    throw new Error(`PushManager.subscribe failed: ${e.message}`);
  }

  // حفظ في الباكند
  try {
    await api.post('/push/subscribe', { subscription: subscription.toJSON() });
  } catch (e) {
    throw new Error(`Failed to save subscription: ${e.message}`);
  }

  return subscription;
};

export const unsubscribeFromPush = async () => {
  const sub = await getActiveSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await api.delete('/push/unsubscribe', { data: { endpoint } }).catch(() => {});
};

export const requestAndSubscribe = async () => {
  if (!isPushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission;
  await subscribeToPush();
  return 'granted';
};
