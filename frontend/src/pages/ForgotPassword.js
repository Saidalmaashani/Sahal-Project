import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'sonner';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [devUrl, setDevUrl]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { toast.error('أدخل البريد الإلكتروني'); return; }
    setLoading(true);
    try {
      const r = await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
      if (r.data.reset_url) setDevUrl(r.data.reset_url); // وضع التطوير
    } catch (e) {
      toast.error(e.response?.data?.detail || 'حدث خطأ، حاول مجدداً');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100svh', background: '#F8F9FA',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: 'Tajawal,Cairo,sans-serif', direction: 'rtl',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '14px',
            background: 'linear-gradient(135deg,#4338CA,#7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', fontWeight: 700, color: '#fff',
            margin: '0 auto 12px', boxShadow: '0 8px 24px rgba(67,56,202,0.3)',
          }}>س</div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: 0 }}>نسيت كلمة المرور؟</h1>
          <p style={{ fontSize: '14px', color: '#475569', marginTop: '6px' }}>
            أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين
          </p>
        </div>

        <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0' }}>
          {!sent ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  required
                  dir="ltr"
                  style={{
                    width: '100%', padding: '12px 14px', border: '1.5px solid #E2E8F0',
                    borderRadius: '10px', fontSize: '15px', background: '#F8FAFC',
                    fontFamily: 'Tajawal,sans-serif', outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#4338CA'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                />
              </div>

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
                background: loading ? '#6366F1' : 'linear-gradient(135deg,#4338CA,#7C3AED)',
                color: '#fff', fontSize: '15px', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Tajawal,sans-serif',
                boxShadow: '0 4px 12px rgba(67,56,202,0.3)',
              }}>
                {loading ? 'جارٍ الإرسال...' : 'إرسال رابط إعادة التعيين'}
              </button>
            </form>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '52px', marginBottom: '12px' }}>📧</div>
              <h3 style={{ fontWeight: 700, fontSize: '18px', color: '#0F172A', marginBottom: '8px' }}>تم الإرسال!</h3>
              <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, marginBottom: '16px' }}>
                إذا كان البريد مسجلاً ستصلك رسالة خلال دقائق.<br />
                تحقق من مجلد الرسائل غير المرغوب فيها (Spam).
              </p>

              {/* وضع التطوير — يظهر الرابط مباشرة إذا SMTP غير مضبوط */}
              {devUrl && (
                <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '10px', padding: '12px', marginBottom: '16px', textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', color: '#92400E', fontWeight: 600, margin: '0 0 6px' }}>
                    🛠️ وضع التطوير (SMTP غير مضبوط):
                  </p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(devUrl); toast.success('تم النسخ!'); }}
                    style={{ fontSize: '11px', color: '#4338CA', background: 'none', border: 'none', cursor: 'pointer', wordBreak: 'break-all', textDecoration: 'underline', textAlign: 'right', padding: 0 }}>
                    {devUrl}
                  </button>
                  <br />
                  <button
                    onClick={() => navigate(`/reset-password?token=${new URL(devUrl).searchParams.get('token')}`)}
                    style={{ marginTop: '8px', padding: '6px 14px', background: '#4338CA', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontFamily: 'Tajawal,sans-serif' }}>
                    افتح صفحة إعادة التعيين
                  </button>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
            <button onClick={() => navigate('/login')} style={{
              background: 'none', border: 'none', color: '#4338CA',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Tajawal,sans-serif',
            }}>
              ← العودة لتسجيل الدخول
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
