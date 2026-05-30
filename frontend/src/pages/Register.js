import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

const ROLES = [
  { key: 'shopper',  label: 'متسوق',  icon: '🛍️', desc: 'تسوق وتتبع طلباتك' },
  { key: 'merchant', label: 'تاجر',   icon: '🏪', desc: 'أنشئ متجرك وبع منتجاتك' },
  { key: 'driver',   label: 'مندوب',  icon: '🚚', desc: 'وصّل الطلبات واربح' },
];

const Register = () => {
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();
  const { register }    = useAuth();

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '',
    role: 'shopper', referral_code: '', showPassword: false
  });
  const [agreed, setAgreed]   = useState(true);
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState(1); // 1=الدور, 2=البيانات

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setForm(f => ({ ...f, referral_code: ref.toUpperCase() }));
  }, [searchParams]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleGoogleLogin = () => {
    const clientId   = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent('openid email profile')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreed) { toast.error('يجب الموافقة على الشروط'); return; }
    if (!form.firstName.trim()) { toast.error('الاسم مطلوب'); return; }
    if (form.password.length < 8) { toast.error('كلمة المرور 8 أحرف على الأقل'); return; }
    setLoading(true);
    try {
      const payload = {
        email: form.email, password: form.password,
        name: `${form.firstName} ${form.lastName}`.trim(),
        role: form.role,
        referral_code: form.referral_code || undefined
      };
      await register(payload);
      toast.success('تم إنشاء الحساب!');
      navigate(form.role === 'merchant' ? '/merchant/dashboard'
             : form.role === 'driver'   ? '/driver/dashboard' : '/shop');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل التسجيل');
    } finally { setLoading(false); }
  };

  const inputStyle = {
    width: '100%', padding: '13px 14px',
    border: '1.5px solid #E2E8F0', borderRadius: '12px',
    fontSize: '16px', background: '#F8FAFC', color: '#0F172A',
    fontFamily: 'Tajawal,sans-serif', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.2s',
  };

  return (
    <div style={{
      minHeight: '100svh', background: '#F8F9FA',
      fontFamily: 'Tajawal,Cairo,sans-serif', direction: 'rtl',
      display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>

      {/* Header موبايل */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderBottom: '1px solid #F1F5F9' }}>
        <button onClick={() => navigate('/')}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#475569', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0' }}>
          ← رجوع
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 34, height: 34, borderRadius: '8px', background: 'linear-gradient(135deg,#4338CA,#F97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '18px' }}>س</div>
          <span style={{ fontWeight: 700, fontSize: '18px', color: '#4338CA' }}>سهل</span>
        </div>
        <button onClick={() => navigate('/login')}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#4338CA', fontSize: '14px', fontWeight: 600 }}>
          دخول
        </button>
      </div>

      {/* المحتوى */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '24px 20px' }}>
        <div style={{ width: '100%', maxWidth: '440px' }}>

          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginBottom: '4px', textAlign: 'center' }}>
            {step === 1 ? 'كيف ستستخدم سهل؟' : 'أنشئ حسابك'}
          </h1>
          <p style={{ fontSize: '14px', color: '#475569', textAlign: 'center', marginBottom: '28px' }}>
            {step === 1 ? 'اختر نوع حسابك لتبدأ' : 'أدخل بياناتك للتسجيل'}
          </p>

          {/* Step 1: اختيار الدور */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {ROLES.map(r => (
                <button key={r.key} onClick={() => { setForm(f => ({ ...f, role: r.key })); setStep(2); }}
                  style={{
                    padding: '18px 20px', borderRadius: '14px', cursor: 'pointer',
                    border: form.role === r.key ? '2px solid #4338CA' : '1.5px solid #E2E8F0',
                    background: form.role === r.key ? '#EEF2FF' : '#fff',
                    display: 'flex', alignItems: 'center', gap: '14px',
                    textAlign: 'right', transition: 'all 0.15s', width: '100%',
                  }}>
                  <span style={{ fontSize: '32px' }}>{r.icon}</span>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '16px', color: '#0F172A', margin: 0 }}>{r.label}</p>
                    <p style={{ fontSize: '13px', color: '#475569', margin: '2px 0 0' }}>{r.desc}</p>
                  </div>
                  <span style={{ marginRight: 'auto', color: form.role === r.key ? '#4338CA' : '#CBD5E1', fontSize: '20px' }}>←</span>
                </button>
              ))}

              {/* Google */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#E2E8F0' }}></div>
                <span style={{ fontSize: '13px', color: '#94A3B8' }}>أو</span>
                <div style={{ flex: 1, height: 1, background: '#E2E8F0' }}></div>
              </div>

              <button onClick={handleGoogleLogin}
                style={{ width: '100%', padding: '14px', border: '1.5px solid #E2E8F0', borderRadius: '12px', background: '#fff', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontFamily: 'Tajawal,sans-serif', fontWeight: 600, color: '#0F172A' }}>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                المتابعة بـ Google
              </button>

              <p style={{ textAlign: 'center', fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                لديك حساب؟{' '}
                <button onClick={() => navigate('/login')} style={{ border: 'none', background: 'none', color: '#4338CA', fontWeight: 600, cursor: 'pointer', fontSize: '13px', fontFamily: 'Tajawal,sans-serif' }}>
                  سجّل دخولك
                </button>
              </p>
            </div>
          )}

          {/* Step 2: إدخال البيانات */}
          {step === 2 && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* نوع الحساب المختار */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#EEF2FF', borderRadius: '10px', padding: '10px 14px' }}>
                <span style={{ fontSize: '20px' }}>{ROLES.find(r => r.key === form.role)?.icon}</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: '#4338CA' }}>{ROLES.find(r => r.key === form.role)?.label}</p>
                </div>
                <button type="button" onClick={() => setStep(1)}
                  style={{ marginRight: 'auto', border: 'none', background: 'none', color: '#4338CA', cursor: 'pointer', fontSize: '12px', fontFamily: 'Tajawal,sans-serif' }}>
                  تغيير
                </button>
              </div>

              {/* الاسم */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>الاسم الأول *</label>
                  <input style={inputStyle} value={form.firstName} onChange={set('firstName')}
                    placeholder="محمد" required autoComplete="given-name"
                    onFocus={e => e.target.style.borderColor = '#4338CA'}
                    onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>اسم العائلة</label>
                  <input style={inputStyle} value={form.lastName} onChange={set('lastName')}
                    placeholder="الأحمدي" autoComplete="family-name"
                    onFocus={e => e.target.style.borderColor = '#4338CA'}
                    onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                </div>
              </div>

              {/* البريد */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>البريد الإلكتروني *</label>
                <input style={inputStyle} type="email" value={form.email} onChange={set('email')}
                  placeholder="example@email.com" required dir="ltr" autoComplete="email"
                  inputMode="email"
                  onFocus={e => e.target.style.borderColor = '#4338CA'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>

              {/* كلمة المرور */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>كلمة المرور *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...inputStyle, paddingLeft: '44px' }}
                    type={form.showPassword ? 'text' : 'password'}
                    value={form.password} onChange={set('password')}
                    placeholder="8 أحرف على الأقل" required dir="ltr"
                    autoComplete="new-password"
                    onFocus={e => e.target.style.borderColor = '#4338CA'}
                    onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, showPassword: !f.showPassword }))}
                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px' }}>
                    {form.showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {form.password && form.password.length < 8 && (
                  <p style={{ fontSize: '12px', color: '#E11D48', marginTop: '4px' }}>كلمة المرور قصيرة جداً</p>
                )}
              </div>

              {/* رمز الإحالة */}
              {form.referral_code || searchParams.get('ref') ? (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>رمز الإحالة</label>
                  <input style={{ ...inputStyle, background: '#F0FDF4', borderColor: '#86EFAC' }}
                    value={form.referral_code} onChange={set('referral_code')}
                    placeholder="SAHALXXXXXX" dir="ltr" />
                </div>
              ) : null}

              {/* الموافقة */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '2px 0' }}>
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#4338CA', marginTop: '2px', flexShrink: 0, cursor: 'pointer' }} />
                <span style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                  أوافق على <span style={{ color: '#4338CA', fontWeight: 600 }}>الشروط والأحكام</span>
                  {' '}و<span style={{ color: '#4338CA', fontWeight: 600 }}>سياسة الخصوصية</span>
                </span>
              </label>

              {/* زر التسجيل */}
              <button type="submit" disabled={loading || !agreed}
                style={{
                  width: '100%', padding: '15px',
                  background: loading || !agreed ? '#9CA3AF' : '#4338CA',
                  color: '#fff', border: 'none', borderRadius: '12px',
                  fontSize: '16px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'Cairo,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  minHeight: '52px', transition: 'background 0.2s',
                }}>
                {loading ? (
                  <><div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div> جارٍ الإنشاء...</>
                ) : '🚀 إنشاء الحساب'}
              </button>

              {/* Google */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1, height: 1, background: '#E2E8F0' }}></div>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>أو سجّل بـ</span>
                <div style={{ flex: 1, height: 1, background: '#E2E8F0' }}></div>
              </div>

              <button type="button" onClick={handleGoogleLogin}
                style={{ width: '100%', padding: '13px', border: '1.5px solid #E2E8F0', borderRadius: '12px', background: '#fff', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontFamily: 'Tajawal,sans-serif', fontWeight: 600, color: '#0F172A', minHeight: '52px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                المتابعة بـ Google
              </button>

              <p style={{ textAlign: 'center', fontSize: '13px', color: '#475569' }}>
                لديك حساب؟{' '}
                <button type="button" onClick={() => navigate('/login')}
                  style={{ border: 'none', background: 'none', color: '#4338CA', fontWeight: 600, cursor: 'pointer', fontSize: '13px', fontFamily: 'Tajawal,sans-serif' }}>
                  سجّل دخولك
                </button>
              </p>
            </form>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Register;
