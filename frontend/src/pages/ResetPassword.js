import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'sonner';

const PasswordStrength = ({ password }) => {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const levels = [
    { label: 'ضعيفة جداً', color: '#E11D48' },
    { label: 'ضعيفة', color: '#F97316' },
    { label: 'متوسطة', color: '#EAB308' },
    { label: 'قوية', color: '#10B981' },
  ];
  const lvl = levels[Math.min(score - 1, 3)] || levels[0];

  return password ? (
    <div style={{ marginTop: '6px' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '3px' }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i <= score ? lvl.color : '#E2E8F0', transition: 'background 0.3s' }} />
        ))}
      </div>
      <p style={{ fontSize: '11px', color: lvl.color, margin: 0 }}>كلمة المرور {lvl.label}</p>
    </div>
  ) : null;
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [form, setForm]     = useState({ password: '', confirm: '' });
  const [show, setShow]     = useState({ p: false, c: false });
  const [loading, setLoading] = useState(false);
  const [done, setDone]     = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error('رابط غير صالح');
      navigate('/login');
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
    if (form.password !== form.confirm) { toast.error('كلمتا المرور غير متطابقتين'); return; }

    setLoading(true);
    try {
      const r = await api.post('/auth/reset-password', { token, password: form.password });
      toast.success(r.data.message);
      setDone(true);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'فشل تغيير كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  const inp = (extra = {}) => ({
    width: '100%', padding: '12px 44px 12px 14px', border: '1.5px solid #E2E8F0',
    borderRadius: '10px', fontSize: '15px', background: '#F8FAFC',
    fontFamily: 'Tajawal,sans-serif', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s', ...extra,
  });

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
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            {done ? 'تم بنجاح! ✅' : 'تعيين كلمة مرور جديدة'}
          </h1>
          {!done && <p style={{ fontSize: '14px', color: '#475569', marginTop: '6px' }}>أدخل كلمة المرور الجديدة</p>}
        </div>

        <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0' }}>
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '52px', marginBottom: '12px' }}>🎉</div>
              <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.6, marginBottom: '20px' }}>
                تم تغيير كلمة المرور بنجاح.<br />يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.
              </p>
              <button onClick={() => navigate('/login')} style={{
                width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg,#4338CA,#7C3AED)', color: '#fff',
                fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Tajawal,sans-serif',
              }}>
                تسجيل الدخول
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* كلمة المرور الجديدة */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  كلمة المرور الجديدة
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={show.p ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="8 أحرف على الأقل"
                    required
                    dir="ltr"
                    style={inp({ borderColor: form.password.length >= 8 ? '#10B981' : form.password ? '#F97316' : '#E2E8F0' })}
                    onFocus={e => e.target.style.borderColor = '#4338CA'}
                    onBlur={e => e.target.style.borderColor = form.password.length >= 8 ? '#10B981' : form.password ? '#F97316' : '#E2E8F0'}
                  />
                  <button type="button" onClick={() => setShow(s => ({ ...s, p: !s.p }))}
                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                    {show.p ? '🙈' : '👁️'}
                  </button>
                </div>
                <PasswordStrength password={form.password} />
              </div>

              {/* تأكيد كلمة المرور */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  تأكيد كلمة المرور
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={show.c ? 'text' : 'password'}
                    value={form.confirm}
                    onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                    placeholder="أعد كتابة كلمة المرور"
                    required
                    dir="ltr"
                    style={inp({
                      borderColor: form.confirm
                        ? (form.password === form.confirm ? '#10B981' : '#E11D48')
                        : '#E2E8F0'
                    })}
                    onFocus={e => e.target.style.borderColor = '#4338CA'}
                    onBlur={e => e.target.style.borderColor = form.confirm ? (form.password === form.confirm ? '#10B981' : '#E11D48') : '#E2E8F0'}
                  />
                  <button type="button" onClick={() => setShow(s => ({ ...s, c: !s.c }))}
                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                    {show.c ? '🙈' : '👁️'}
                  </button>
                </div>
                {form.confirm && form.password !== form.confirm && (
                  <p style={{ fontSize: '11px', color: '#E11D48', margin: '4px 0 0' }}>كلمتا المرور غير متطابقتين</p>
                )}
              </div>

              <button type="submit" disabled={loading || form.password !== form.confirm || form.password.length < 8} style={{
                width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
                background: (loading || form.password !== form.confirm || form.password.length < 8)
                  ? '#CBD5E1' : 'linear-gradient(135deg,#4338CA,#7C3AED)',
                color: '#fff', fontSize: '15px', fontWeight: 700,
                cursor: (loading || form.password !== form.confirm || form.password.length < 8) ? 'not-allowed' : 'pointer',
                fontFamily: 'Tajawal,sans-serif',
                transition: 'background 0.2s',
              }}>
                {loading ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور الجديدة'}
              </button>
            </form>
          )}

          {!done && (
            <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <button onClick={() => navigate('/login')} style={{
                background: 'none', border: 'none', color: '#4338CA',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Tajawal,sans-serif',
              }}>
                ← العودة لتسجيل الدخول
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
