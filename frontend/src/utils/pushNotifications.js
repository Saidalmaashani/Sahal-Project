import api from './api';

// تحويل base64url إلى Uint8Array لـ VAPID
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

// هل المتصفح يدعم Push؟
export const isPushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// الحصول على حالة الإذن الحالية
export const getPushPermission = () => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
};

// التحقق من وجود اشتراك نشط
export const getActiveSubscription = async () => {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
};

// تسجيل Service Worker وإنشاء اشتراك Push
export const subscribeToPush = async () => {
  if (!isPushSupported()) throw new Error('Push not supported');

  // جلب المفتاح العام من الباكند
  const { data } = await api.get('/push/vapid-key');
  const publicKey = data.public_key;

  // تسجيل Service Worker
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  // اشتراك
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  // حفظ في الباكند
  await api.post('/push/subscribe', { subscription: subscription.toJSON() });

  return subscription;
};

// إلغاء الاشتراك
export const unsubscribeFromPush = async () => {
  const sub = await getActiveSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await api.delete('/push/unsubscribe', { data: { endpoint } }).catch(() => {});
};

// طلب إذن + اشتراك في خطوة واحدة
// يعيد: 'granted' | 'denied' | 'unsupported'
export const requestAndSubscribe = async () => {
  if (!isPushSupported()) return 'unsupported';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission;

  await subscribeToPush();
  return 'granted';
};
