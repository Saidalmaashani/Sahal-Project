import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import {
  Bell, CheckCheck, Trash2, Package, Truck, CheckCircle,
  Store, Gift, ShoppingBag, X, AlertCircle, BellOff, BellRing
} from 'lucide-react';
import {
  isPushSupported, getPushPermission, getActiveSubscription,
  requestAndSubscribe, unsubscribeFromPush,
} from '../utils/pushNotifications';
import { useWebSocket } from '../hooks/useWebSocket';
import { useT } from '../contexts/ThemeContext';

const TYPE_CONFIG = {
  order_confirmed: { icon: CheckCircle, color: '#10B981', bg: '#ECFDF5', label: 'طلب مؤكد' },
  order_shipped:   { icon: Truck,        color: '#4338CA', bg: '#EEF2FF', label: 'جارٍ التوصيل' },
  order_delivered: { icon: CheckCheck,   color: '#10B981', bg: '#ECFDF5', label: 'تم التوصيل' },
  new_order:       { icon: ShoppingBag,  color: '#F97316', bg: '#FFF7ED', label: 'طلب جديد' },
  store_approved:  { icon: Store,        color: '#10B981', bg: '#ECFDF5', label: 'متجر معتمد' },
  store_rejected:  { icon: AlertCircle,  color: '#E11D48', bg: '#FFF1F2', label: 'متجر مرفوض' },
  referral_reward: { icon: Gift,         color: '#F97316', bg: '#FFF7ED', label: 'مكافأة إحالة' },
  default:         { icon: Bell,         color: '#4338CA', bg: '#EEF2FF', label: 'إشعار' },
};

const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'الآن';
  if (diff < 3600)  return `${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} س`;
  return `${Math.floor(diff / 86400)} ي`;
};

const useIsMobile = () => {
  const [mobile, setMobile] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = (e) => setMobile(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return mobile;
};

const NotificationBell = () => {
  const navigate   = useNavigate();
  const isMobile   = useIsMobile();
  const [open, setOpen]         = useState(false);
  const [notifs, setNotifs]     = useState([]);
  const [unread, setUnread]     = useState(0);
  const [loading, setLoading]   = useState(false);
  const [pushStatus, setPushStatus] = useState('default'); // 'default'|'granted'|'denied'|'unsupported'
  const [pushLoading, setPushLoading] = useState(false);
  const panelRef = useRef(null);
  const pollRef  = useRef(null);

  const token = localStorage.getItem('token');
  const t = useT();

  const fetchNotifs = useCallback(async () => {
    try {
      const r = await api.get('/notifications');
      setNotifs(r.data.notifications || []);
      setUnread(r.data.unread_count || 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifs();
    // polling كـ fallback كل دقيقتين بدلاً من 30 ثانية (WebSocket يتولى الفوري)
    pollRef.current = setInterval(fetchNotifs, 120000);
    return () => clearInterval(pollRef.current);
  }, [fetchNotifs]);

  // WebSocket — إشعارات فورية
  useWebSocket({
    path: '/ws/notifications',
    token,
    onMessage: useCallback((data) => {
      if (data.type === 'notification') {
        setNotifs(prev => {
          if (prev.find(n => n.notification_id === data.notification_id)) return prev;
          return [data, ...prev].slice(0, 50);
        });
        setUnread(prev => prev + 1);
      }
    }, []),
  });

  // تحقق من حالة Push عند الفتح
  useEffect(() => {
    if (!isPushSupported()) { setPushStatus('unsupported'); return; }
    const perm = getPushPermission();
    if (perm === 'granted') {
      getActiveSubscription().then(sub => {
        setPushStatus(sub ? 'granted' : 'default');
      });
    } else {
      setPushStatus(perm);
    }
  }, []);

  // قفل تمرير الصفحة عند فتح الـ sheet على الجوال
  useEffect(() => {
    if (open && isMobile) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open, isMobile]);

  const handlePushToggle = async () => {
    if (pushLoading) return;
    setPushLoading(true);
    try {
      if (pushStatus === 'granted') {
        await unsubscribeFromPush();
        setPushStatus('default');
      } else {
        const result = await requestAndSubscribe();
        setPushStatus(result);
      }
    } catch (e) {
      console.error('Push toggle error:', e);
    } finally {
      setPushLoading(false);
    }
  };

  // إغلاق عند الضغط خارج الـ panel
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, []);

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`).catch(() => {});
    setNotifs(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    setLoading(true);
    await api.patch('/notifications/read-all').catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
    setLoading(false);
  };

  const clearRead = async () => {
    await api.delete('/notifications/clear').catch(() => {});
    setNotifs(prev => prev.filter(n => !n.is_read));
  };

  const handleClick = (notif) => {
    if (!notif.is_read) markRead(notif.notification_id);
    if (notif.link) { navigate(notif.link); setOpen(false); }
  };

  const close = () => setOpen(false);

  // ===== محتوى اللوحة (مشترك بين سطح المكتب والجوال) =====
  const panelContent = (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid #F1F5F9',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell style={{ width: 18, height: 18, color: '#4338CA' }} />
          <span style={{ fontWeight: 700, fontSize: '15px', color: t.text }}>الإشعارات</span>
          {unread > 0 && (
            <span style={{ background: '#E11D48', color: '#fff', borderRadius: '20px', fontSize: '11px', fontWeight: 700, padding: '2px 8px' }}>{unread}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          {unread > 0 && (
            <button onClick={markAllRead} disabled={loading}
              style={{ padding: '6px 10px', border: 'none', background: 'none', cursor: 'pointer', color: '#4338CA', fontSize: '12px', fontWeight: 600, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', minHeight: 36 }}>
              <CheckCheck style={{ width: 15, height: 15 }} />
              <span style={{ display: isMobile ? 'none' : 'inline' }}>قراءة الكل</span>
            </button>
          )}
          <button onClick={clearRead} aria-label="حذف المقروء"
            style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', borderRadius: '8px', display: 'flex', alignItems: 'center', minWidth: 36, minHeight: 36 }}>
            <Trash2 style={{ width: 16, height: 16 }} />
          </button>
          <button onClick={close} aria-label="إغلاق"
            style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', borderRadius: '8px', display: 'flex', alignItems: 'center', minWidth: 36, minHeight: 36 }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>
      </div>

      {/* شريط تفعيل إشعارات الجهاز */}
      {pushStatus !== 'unsupported' && pushStatus !== 'denied' && (
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid #F1F5F9',
          background: pushStatus === 'granted' ? '#F0FDF4' : '#FFF7ED',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
            {pushStatus === 'granted'
              ? <BellRing style={{ width: 15, height: 15, color: '#10B981', flexShrink: 0 }} />
              : <BellOff style={{ width: 15, height: 15, color: '#F97316', flexShrink: 0 }} />
            }
            <span style={{ fontSize: '12px', color: pushStatus === 'granted' ? '#065F46' : '#92400E', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pushStatus === 'granted' ? 'إشعارات الجهاز مفعّلة ✓' : 'فعّل إشعارات الجهاز'}
            </span>
          </div>
          <button
            onClick={handlePushToggle}
            disabled={pushLoading}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: '20px', cursor: 'pointer',
              fontSize: '12px', fontFamily: 'Tajawal,sans-serif', fontWeight: 700,
              background: pushStatus === 'granted' ? '#DCFCE7' : '#4338CA',
              color: pushStatus === 'granted' ? '#065F46' : '#fff',
              opacity: pushLoading ? 0.7 : 1,
              minHeight: 36, flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >
            {pushLoading ? '...' : pushStatus === 'granted' ? 'إيقاف' : 'تفعيل'}
          </button>
        </div>
      )}

      {/* رسالة إذا رُفض الإذن */}
      {pushStatus === 'denied' && (
        <div style={{ padding: '12px 16px', background: '#FFF1F2', borderBottom: '1px solid #FECDD3', flexShrink: 0 }}>
          <p style={{ fontSize: '12px', color: '#9F1239', margin: 0, lineHeight: 1.6 }}>
            ⚠️ الإشعارات محظورة في إعدادات المتصفح. افتح الإعدادات للسماح بها.
          </p>
        </div>
      )}

      {/* قائمة الإشعارات */}
      <div style={{
        flex: 1, minHeight: 0,
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {notifs.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: '#94A3B8' }}>
            <Bell style={{ width: 40, height: 40, margin: '0 auto 10px', opacity: 0.3 }} />
            <p style={{ fontSize: '14px', margin: 0 }}>لا توجد إشعارات</p>
          </div>
        ) : notifs.map(n => {
          const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.default;
          const Icon = cfg.icon;
          return (
            <div key={n.notification_id}
              onClick={() => handleClick(n)}
              role={n.link ? 'button' : undefined}
              style={{
                display: 'flex', gap: '12px', padding: '14px 16px',
                borderBottom: '1px solid #F8FAFC',
                background: n.is_read ? '#fff' : '#F8F9FF',
                cursor: n.link ? 'pointer' : 'default',
                transition: 'background 0.15s',
                alignItems: 'flex-start',
                minHeight: 60,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon style={{ width: 20, height: 20, color: cfg.color }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', margin: 0, lineHeight: 1.4 }}>{n.title}</p>
                  <span style={{ fontSize: '11px', color: '#94A3B8', flexShrink: 0, marginTop: '2px' }}>{timeAgo(n.created_at)}</span>
                </div>
                <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 0', lineHeight: 1.5 }}>{n.message}</p>
              </div>

              {!n.is_read && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4338CA', flexShrink: 0, marginTop: '8px' }}></div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {notifs.length > 0 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F5F9', textAlign: 'center', flexShrink: 0 }}>
          <button onClick={() => { navigate('/my-orders'); close(); }}
            style={{ fontSize: '13px', color: '#4338CA', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Tajawal,sans-serif', fontWeight: 600, padding: '8px' }}>
            عرض طلباتي ←
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      {/* زر الجرس */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        animate={unread > 0 ? { rotate: [0, -15, 15, -10, 10, 0] } : {}}
        transition={unread > 0 ? { duration: 0.5 } : {}}
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative', padding: '8px',
          border: '1px solid #E2E8F0', borderRadius: '8px',
          background: open ? '#EEF2FF' : '#fff',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 44, minHeight: 44, transition: 'background 0.15s'
        }}
        aria-label="الإشعارات"
      >
        <Bell style={{ width: 20, height: 20, color: open ? '#4338CA' : '#475569' }} />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key={unread}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              style={{
                position: 'absolute', top: '4px', right: '4px',
                background: '#E11D48', color: '#fff',
                borderRadius: '50%', fontSize: '10px', fontWeight: 700,
                minWidth: '18px', height: '18px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px', lineHeight: 1,
                boxShadow: '0 0 0 2px #fff'
              }}
            >
              {unread > 99 ? '99+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* لوحة الإشعارات */}
      <AnimatePresence>
      {open && (isMobile ? (
        <>
          {/* خلفية معتمة */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(15,23,42,0.55)',
              zIndex: 1000,
            }}
          />
          {/* شريحة من الأسفل (Bottom Sheet) */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            style={{
              position: 'fixed', left: 0, right: 0, bottom: 0,
              zIndex: 1001,
              background: t.card,
              border: `1px solid ${t.border}`,
              borderBottom: 'none',
              borderRadius: '24px 24px 0 0',
              boxShadow: '0 -12px 48px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              direction: 'rtl',
              fontFamily: 'Tajawal,Cairo,sans-serif',
              maxHeight: 'min(84vh, 760px)',
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            {/* مقبض السحب */}
            <div style={{ paddingTop: '10px', paddingBottom: '4px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 44, height: 5, borderRadius: 3, background: '#CBD5E1' }} />
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {panelContent}
            </div>
          </motion.div>
        </>
      ) : (
        <motion.div
          key="dropdown"
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ type: 'spring', damping: 22, stiffness: 350 }}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: '50%', transform: 'translateX(-50%)',
            width: 'min(380px, calc(100vw - 32px))',
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: '16px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
            zIndex: 200,
            overflow: 'hidden',
            direction: 'rtl',
            fontFamily: 'Tajawal,Cairo,sans-serif',
            maxHeight: 'min(60vh, 560px)',
            display: 'flex',
            flexDirection: 'column',
          }}>
          {panelContent}
        </motion.div>
      ))}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;