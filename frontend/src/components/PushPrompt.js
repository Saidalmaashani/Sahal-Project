import React, { useState, useEffect } from 'react';
import { BellRing, X } from 'lucide-react';
import {
  isPushSupported, getPushPermission,
  getActiveSubscription, requestAndSubscribe,
} from '../utils/pushNotifications';

/**
 * شريط تفعيل الإشعارات — يظهر مرة واحدة للمستخدم الجديد
 */
const PushPrompt = () => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // لا تُظهر إذا المتصفح لا يدعم أو الإذن محدد مسبقاً
    if (!isPushSupported()) return;
    const perm = getPushPermission();
    if (perm === 'granted' || perm === 'denied') return;

    // لا تُظهر إذا المستخدم أغلقها من قبل
    if (localStorage.getItem('push_prompt_dismissed')) return;

    // انتظر 5 ثوانٍ قبل الظهور
    const t = setTimeout(() => setVisible(true), 5000);
    return () => clearTimeout(t);
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const result = await requestAndSubscribe();
      if (result === 'granted') {
        setVisible(false);
        localStorage.setItem('push_prompt_dismissed', '1');
      }
    } catch (e) {
      console.error('Push subscribe error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem('push_prompt_dismissed', '1');
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      left: '20px',
      maxWidth: '420px',
      margin: '0 auto',
      background: '#fff',
      border: '1px solid #E2E8F0',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      padding: '16px',
      zIndex: 9999,
      direction: 'rtl',
      fontFamily: 'Tajawal,Cairo,sans-serif',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
    }}>
      {/* أيقونة */}
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
        background: 'linear-gradient(135deg,#4338CA,#7C3AED)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <BellRing style={{ width: '22px', height: '22px', color: '#fff' }} />
      </div>

      {/* النص */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: '15px', color: '#0F172A', margin: '0 0 4px' }}>
          فعّل إشعارات سهل 🔔
        </p>
        <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 12px', lineHeight: 1.5 }}>
          احصل على إشعار فوري عند وصول طلبك أو طلب جديد
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleEnable}
            disabled={loading}
            style={{
              padding: '8px 20px', borderRadius: '10px', border: 'none',
              background: '#4338CA', color: '#fff', fontSize: '13px',
              fontWeight: 700, cursor: 'pointer', fontFamily: 'Tajawal,sans-serif',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '...' : 'تفعيل الإشعارات'}
          </button>
          <button
            onClick={handleDismiss}
            style={{
              padding: '8px 14px', borderRadius: '10px',
              border: '1px solid #E2E8F0', background: 'none',
              fontSize: '13px', color: '#475569', cursor: 'pointer',
              fontFamily: 'Tajawal,sans-serif',
            }}
          >
            لاحقاً
          </button>
        </div>
      </div>

      {/* زر الإغلاق */}
      <button onClick={handleDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#94A3B8', flexShrink: 0 }}>
        <X style={{ width: '16px', height: '16px' }} />
      </button>
    </div>
  );
};

export default PushPrompt;
