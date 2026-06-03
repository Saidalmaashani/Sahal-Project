import React, { useState, useEffect } from 'react';
import { BellRing, X, Send, CheckCircle, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import {
  isPushSupported, getPushPermission,
  requestAndSubscribe, getActiveSubscription,
} from '../utils/pushNotifications';
import api from '../utils/api';

// ====== دليل إعدادات iOS ======
const IOSGuide = ({ onClose }) => (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    zIndex: 99999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  }}>
    <div style={{
      background: '#fff', borderRadius: '20px 20px 0 0',
      padding: '24px 20px 40px', maxWidth: '480px', width: '100%',
      direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif',
      maxHeight: '85vh', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontWeight: 700, fontSize: '18px', margin: 0 }}>تفعيل الإشعارات على iPhone</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <X style={{ width: 22, height: 22, color: '#475569' }} />
        </button>
      </div>

      {[
        {
          num: '1', color: '#4338CA',
          title: 'أضف التطبيق لشاشتك الرئيسية',
          desc: 'افتح الموقع في Safari → اضغط زر المشاركة ↗️ → اختر "Add to Home Screen" → اضغط "Add"',
          important: true,
        },
        {
          num: '2', color: '#7C3AED',
          title: 'افتح التطبيق من الشاشة الرئيسية',
          desc: 'لازم تفتحه من أيقونة سهل على شاشتك، مش من Safari مباشرة',
          important: true,
        },
        {
          num: '3', color: '#0EA5E9',
          title: 'فعّل الإشعارات داخل التطبيق',
          desc: 'اضغط زر "تفعيل الإشعارات" واقبل الإذن عند الطلب',
          important: false,
        },
        {
          num: '4', color: '#F97316',
          title: 'تحقق من إعدادات iPhone',
          desc: 'اذهب لـ الإعدادات ⚙️ → الإشعارات 🔔 → سهل → فعّل "السماح بالإشعارات" + "شاشة القفل"',
          important: true,
        },
        {
          num: '5', color: '#10B981',
          title: 'اختبر الإشعار',
          desc: 'اضغط "اختبار الإشعار" ثم أقفل الشاشة — يجب أن يظهر الإشعار خلال ثوانٍ',
          important: false,
        },
      ].map(step => (
        <div key={step.num} style={{
          display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'flex-start',
          background: step.important ? '#FFF7ED' : '#F8FAFC',
          border: `1px solid ${step.important ? '#FED7AA' : '#E2E8F0'}`,
          borderRadius: '12px', padding: '12px',
        }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
            background: step.color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '14px',
          }}>{step.num}</div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '14px', margin: '0 0 4px', color: '#0F172A' }}>
              {step.important ? '⚠️ ' : ''}{step.title}
            </p>
            <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.6 }}>{step.desc}</p>
          </div>
        </div>
      ))}

      <div style={{ background: '#EEF2FF', borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
        <p style={{ fontSize: '12px', color: '#4338CA', margin: 0, lineHeight: 1.6 }}>
          📱 <strong>ملاحظة:</strong> الإشعارات تظهر على شاشة القفل فقط عندما يكون التطبيق مغلقاً أو في الخلفية.
          إذا كان التطبيق مفتوحاً، لن تظهر كـ banner.
        </p>
      </div>

      <button onClick={onClose} style={{
        width: '100%', padding: '14px', borderRadius: '12px',
        background: '#4338CA', color: '#fff', border: 'none',
        fontSize: '15px', fontWeight: 700, cursor: 'pointer',
        fontFamily: 'Tajawal,sans-serif',
      }}>
        فهمت ✓
      </button>
    </div>
  </div>
);

// ====== لوحة التشخيص ======
const DiagnosticPanel = ({ onClose }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    api.get('/push/status').then(r => setStatus(r.data)).catch(e => setStatus({ error: e.message })).finally(() => setLoading(false));
  }, []);

  const sendTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const r = await api.post('/push/test');
      setTestResult({ success: r.data.success, msg: r.data.hint, results: r.data.results });
    } catch (e) {
      setTestResult({ success: false, msg: e.response?.data?.detail || e.message });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 99998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '20px',
        maxWidth: '460px', width: '100%', direction: 'rtl',
        fontFamily: 'Tajawal,Cairo,sans-serif', maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontWeight: 700, fontSize: '17px', margin: 0 }}>تشخيص الإشعارات</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: 20, height: 20, color: '#94A3B8' }} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid #4338CA', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
          </div>
        ) : status?.error ? (
          <p style={{ color: '#E11D48', fontSize: '13px' }}>خطأ: {status.error}</p>
        ) : (
          <>
            {/* حالة الـ VAPID */}
            <div style={{ marginBottom: '12px', padding: '12px', background: status.vapid_ok ? '#F0FDF4' : '#FFF1F2', borderRadius: '10px', border: `1px solid ${status.vapid_ok ? '#BBF7D0' : '#FECDD3'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                {status.vapid_ok
                  ? <CheckCircle style={{ width: 16, height: 16, color: '#10B981' }} />
                  : <AlertCircle style={{ width: 16, height: 16, color: '#E11D48' }} />}
                <span style={{ fontWeight: 600, fontSize: '13px' }}>مفاتيح VAPID</span>
                <span style={{ fontSize: '11px', color: status.vapid_ok ? '#10B981' : '#E11D48', marginRight: 'auto' }}>
                  {status.vapid_ok ? '✓ مضبوطة' : '✗ غير مضبوطة في Render!'}
                </span>
              </div>
              {!status.vapid_ok && (
                <p style={{ fontSize: '11px', color: '#BE123C', margin: 0 }}>
                  اذهب لـ Render → sahal-backend → Environment Variables → أضف VAPID_PRIVATE_KEY و VAPID_PUBLIC_KEY
                </p>
              )}
            </div>

            {/* الاشتراكات */}
            <div style={{ marginBottom: '12px', padding: '12px', background: status.subscriptions_count > 0 ? '#F0FDF4' : '#FFFBEB', borderRadius: '10px', border: `1px solid ${status.subscriptions_count > 0 ? '#BBF7D0' : '#FDE68A'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                {status.subscriptions_count > 0
                  ? <CheckCircle style={{ width: 16, height: 16, color: '#10B981' }} />
                  : <AlertCircle style={{ width: 16, height: 16, color: '#F59E0B' }} />}
                <span style={{ fontWeight: 600, fontSize: '13px' }}>الاشتراكات المحفوظة</span>
                <span style={{ fontSize: '11px', marginRight: 'auto', color: '#475569' }}>{status.subscriptions_count} اشتراك</span>
              </div>
              {status.subscriptions.map((s, i) => (
                <div key={i} style={{ fontSize: '11px', color: '#475569', padding: '4px 0', borderTop: i > 0 ? '1px solid #E2E8F0' : 'none' }}>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>{s.platform}</span><br />
                  <span style={{ fontFamily: 'monospace', fontSize: '10px' }}>{s.endpoint_preview}</span>
                </div>
              ))}
              {status.subscriptions_count === 0 && (
                <p style={{ fontSize: '11px', color: '#92400E', margin: 0 }}>
                  لم يتم تفعيل الإشعارات بعد أو الاشتراك انتهت صلاحيته
                </p>
              )}
            </div>

            {/* إرسال اختبار */}
            <button onClick={sendTest} disabled={testLoading || !status.vapid_ok || status.subscriptions_count === 0}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px',
                background: status.vapid_ok && status.subscriptions_count > 0 ? '#4338CA' : '#CBD5E1',
                color: '#fff', border: 'none', fontSize: '14px', fontWeight: 700,
                cursor: status.vapid_ok && status.subscriptions_count > 0 ? 'pointer' : 'not-allowed',
                fontFamily: 'Tajawal,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}>
              <Send style={{ width: 15, height: 15 }} />
              {testLoading ? 'جارٍ الإرسال...' : 'أرسل إشعار اختبار'}
            </button>

            {testResult && (
              <div style={{ marginTop: '10px', padding: '12px', borderRadius: '10px', background: testResult.success ? '#F0FDF4' : '#FFF1F2', border: `1px solid ${testResult.success ? '#BBF7D0' : '#FECDD3'}` }}>
                <p style={{ fontWeight: 600, fontSize: '13px', margin: '0 0 4px', color: testResult.success ? '#065F46' : '#BE123C' }}>
                  {testResult.success ? '✅ تم الإرسال!' : '❌ فشل الإرسال'}
                </p>
                <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>{testResult.msg}</p>
                {testResult.success && (
                  <div style={{ marginTop: '8px', padding: '8px', background: '#FFF7ED', borderRadius: '8px' }}>
                    <p style={{ fontSize: '11px', color: '#92400E', margin: 0, fontWeight: 600 }}>
                      📱 الآن: اقفل شاشة جهازك ← يجب أن يظهر الإشعار خلال ثوانٍ
                    </p>
                    <p style={{ fontSize: '11px', color: '#92400E', margin: '4px 0 0' }}>
                      إذا لم يظهر: اذهب لـ الإعدادات → الإشعارات → سهل → فعّل "شاشة القفل"
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
};

// ====== المكوّن الرئيسي ======
const PushPrompt = () => {
  const [promptVisible, setPromptVisible] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showDiag, setShowDiag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState('default');
  const [testLoading, setTestLoading] = useState(false);
  const [testMsg, setTestMsg] = useState('');

  useEffect(() => {
    if (!isPushSupported()) { setPushStatus('unsupported'); return; }

    const perm = getPushPermission();
    if (perm === 'granted') {
      getActiveSubscription().then(sub => {
        setPushStatus(sub ? 'granted' : 'default');
      });
      return;
    }
    setPushStatus(perm);

    if (perm === 'denied' || perm === 'unsupported') return;
    if (localStorage.getItem('push_prompt_dismissed')) return;

    const t = setTimeout(() => setPromptVisible(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const result = await requestAndSubscribe();
      setPushStatus(result);
      if (result === 'granted') {
        setPromptVisible(false);
        localStorage.setItem('push_prompt_dismissed', '1');
        setShowGuide(true); // أظهر دليل iOS بعد التفعيل
      }
    } catch (e) {
      alert('خطأ في التفعيل: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickTest = async () => {
    setTestLoading(true);
    setTestMsg('');
    try {
      const r = await api.post('/push/test');
      setTestMsg(r.data.success
        ? '✅ أُرسل! اقفل الشاشة لترى الإشعار'
        : '❌ ' + r.data.hint);
    } catch (e) {
      setTestMsg('❌ ' + (e.response?.data?.detail || e.message));
    } finally {
      setTestLoading(false);
      setTimeout(() => setTestMsg(''), 5000);
    }
  };

  // إذا الإشعارات مفعّلة — أظهر أزرار صغيرة
  if (pushStatus === 'granted') {
    return (
      <>
        <div style={{
          position: 'fixed', bottom: '20px', left: '16px',
          zIndex: 9000, direction: 'rtl', fontFamily: 'Tajawal,sans-serif',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px',
        }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={handleQuickTest} disabled={testLoading} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '7px 12px', borderRadius: '20px',
              background: '#4338CA', color: '#fff', border: 'none',
              fontSize: '12px', fontFamily: 'Tajawal,sans-serif',
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(67,56,202,0.35)',
              opacity: testLoading ? 0.7 : 1,
            }}>
              <Send style={{ width: '12px', height: '12px' }} />
              {testLoading ? '...' : 'اختبار'}
            </button>
            <button onClick={() => setShowDiag(true)} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '7px 12px', borderRadius: '20px',
              background: '#fff', color: '#475569', border: '1px solid #E2E8F0',
              fontSize: '12px', fontFamily: 'Tajawal,sans-serif', cursor: 'pointer',
            }}>
              <Info style={{ width: '12px', height: '12px' }} />
              تشخيص
            </button>
          </div>
          {testMsg && (
            <div style={{
              background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px',
              padding: '8px 12px', fontSize: '12px', maxWidth: '240px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)', color: '#0F172A',
            }}>
              {testMsg}
            </div>
          )}
        </div>
        {showGuide && <IOSGuide onClose={() => setShowGuide(false)} />}
        {showDiag && <DiagnosticPanel onClose={() => setShowDiag(false)} />}
      </>
    );
  }

  if (!promptVisible) return null;

  return (
    <>
      <div style={{
        position: 'fixed', bottom: '16px', right: '16px', left: '16px',
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
            اعرف فوراً عند وصول طلبك أو طلب جديد، حتى الشاشة مطفية
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={handleEnable} disabled={loading} style={{
              padding: '8px 20px', borderRadius: '10px', border: 'none',
              background: '#4338CA', color: '#fff', fontSize: '13px',
              fontWeight: 700, cursor: 'pointer', fontFamily: 'Tajawal,sans-serif',
              opacity: loading ? 0.7 : 1,
            }}>
              {loading ? 'جارٍ التفعيل...' : 'تفعيل'}
            </button>
            <button onClick={() => setShowGuide(true)} style={{
              padding: '8px 12px', borderRadius: '10px',
              border: '1px solid #4338CA', background: 'none',
              fontSize: '13px', color: '#4338CA', cursor: 'pointer',
              fontFamily: 'Tajawal,sans-serif',
            }}>
              كيف؟
            </button>
            <button onClick={() => { setPromptVisible(false); localStorage.setItem('push_prompt_dismissed', '1'); }} style={{
              padding: '8px 12px', borderRadius: '10px',
              border: '1px solid #E2E8F0', background: 'none',
              fontSize: '13px', color: '#94A3B8', cursor: 'pointer',
              fontFamily: 'Tajawal,sans-serif',
            }}>
              لاحقاً
            </button>
          </div>
        </div>

        <button onClick={() => { setPromptVisible(false); localStorage.setItem('push_prompt_dismissed', '1'); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}>
          <X style={{ width: '16px', height: '16px', color: '#94A3B8' }} />
        </button>
      </div>

      {showGuide && <IOSGuide onClose={() => setShowGuide(false)} />}
    </>
  );
};

export default PushPrompt;
