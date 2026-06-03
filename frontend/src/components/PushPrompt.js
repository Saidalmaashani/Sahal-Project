import React, { useState, useEffect } from 'react';
import { BellRing, X, Send } from 'lucide-react';
import {
  isPushSupported, getPushPermission,
  requestAndSubscribe, unsubscribeFromPush, getActiveSubscription,
} from '../utils/pushNotifications';
import api from '../utils/api';

const PushPrompt = () => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('default'); // default | granted | denied | unsupported
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    if (!isPushSupported()) { setStatus('unsupported'); return; }
    const perm = getPushPermission();
    setStatus(perm);

    if (perm === 'granted') {
      getActiveSubscription().then(sub => {
        if (sub) {
          setStatus('granted');
          setVisible(false);
          return;
        }
        setStatus('default');
      });
    }

    if (perm === 'denied' || perm === 'unsupported') return;

    if (localStorage.getItem('push_prompt_dismissed')) return;

    const t = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    setTestResult('');
    try {
      const result = await requestAndSubscribe();
      setStatus(result);
      if (result === 'granted') {
        setVisible(false);
        localStorage.setItem('push_prompt_dismissed', '1');
      }
    } catch (e) {
      setTestResult('خطأ: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTestLoading(true);
    setTestResult('');
    try {
      await api.post('/push/test');
      setTestResult('✅ تم الإرسال! تحقق من إشعارات جهازك');
    } catch (e) {
      setTestResult('❌ ' + (e.response?.data?.detail || e.message));
    } finally {
      setTestLoading(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem('push_prompt_dismissed', '1');
  };

  // إذا الإشعارات مفعّلة — أظهر زر الاختبار فقط (صغير في الزاوية)
  if (status === 'granted') {
    return (
      <div style={{
        position: 'fixed', bottom: '20px', left: '20px',
        zIndex: 9000, direction: 'rtl', fontFamily: 'Tajawal,sans-serif',
        display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start',
      }}>
        <button
          onClick={handleTest}
          disabled={testLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '20px',
            background: '#4338CA', color: '#fff', border: 'none',
            fontSize: '12px', fontFamily: 'Tajawal,sans-serif',
            cursor: 'pointer', boxShadow: '0 2px 10px rgba(67,56,202,0.3)',
            opacity: testLoading ? 0.7 : 1,
          }}
        >
          <Send style={{ width: '13px', height: '13px' }} />
          {testLoading ? '...' : 'اختبار الإشعار'}
        </button>
        {testResult && (
          <div style={{
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px',
            padding: '8px 12px', fontSize: '12px', color: '#0F172A',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)', maxWidth: '260px',
          }}>
            {testResult}
          </div>
        )}
      </div>
    );
  }

  // شريط طلب الإذن
  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '16px', right: '16px', left: '16px',
      maxWidth: '420px', margin: '0 auto',
      background: '#fff', border: '1px solid #E2E8F0',
      borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      padding: '16px', zIndex: 9999,
      direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif',
      display: 'flex', alignItems: 'flex-start', gap: '12px',
    }}>
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
        background: 'linear-gradient(135deg,#4338CA,#7C3AED)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <BellRing style={{ width: '22px', height: '22px', color: '#fff' }} />
      </div>

      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, fontSize: '15px', color: '#0F172A', margin: '0 0 4px' }}>
          فعّل إشعارات سهل 🔔
        </p>
        <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 12px', lineHeight: 1.5 }}>
          احصل على إشعار فوري عند وصول طلبك، أو عند وصول طلب جديد لمتجرك
        </p>

        {status === 'denied' ? (
          <p style={{ fontSize: '12px', color: '#E11D48', margin: 0 }}>
            ⚠️ الإشعارات محظورة. افتح إعدادات Safari ← الإشعارات وابحث عن الموقع واسمح
          </p>
        ) : (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={handleEnable} disabled={loading} style={{
              padding: '8px 20px', borderRadius: '10px', border: 'none',
              background: '#4338CA', color: '#fff', fontSize: '13px',
              fontWeight: 700, cursor: 'pointer', fontFamily: 'Tajawal,sans-serif',
              opacity: loading ? 0.7 : 1,
            }}>
              {loading ? 'جارٍ التفعيل...' : 'تفعيل الإشعارات'}
            </button>
            <button onClick={handleDismiss} style={{
              padding: '8px 14px', borderRadius: '10px',
              border: '1px solid #E2E8F0', background: 'none',
              fontSize: '13px', color: '#475569', cursor: 'pointer',
              fontFamily: 'Tajawal,sans-serif',
            }}>
              لاحقاً
            </button>
          </div>
        )}

        {testResult && (
          <p style={{ fontSize: '12px', marginTop: '8px', color: testResult.startsWith('✅') ? '#10B981' : '#E11D48' }}>
            {testResult}
          </p>
        )}
      </div>

      <button onClick={handleDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#94A3B8', flexShrink: 0 }}>
        <X style={{ width: '16px', height: '16px' }} />
      </button>
    </div>
  );
};

export default PushPrompt;
