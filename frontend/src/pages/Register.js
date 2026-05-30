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
  const [step, setStep]       = useState(1);
  const [progress, setProgress] = useState(0);
  const [focusedField, setFocusedField] = useState('');

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setForm(f => ({ ...f, referral_code: ref.toUpperCase() }));
  }, [searchParams]);

  // احسب نسبة إكمال النموذج
  useEffect(() => {
    if (step === 1) { setProgress(10); return; }
    const fields = [form.firstName, form.email, form.password.length >= 8 ? form.password : ''];
    const filled = fields.filter(Boolean).length;
    setProgress(10 + Math.round((filled / fields.length) * 85) + (agreed ? 5 : 0));
  }, [form, step, agreed]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleGoogleLogin = () => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent('openid email profile')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreed) { toast.error('يجب الموافقة على الشروط'); return; }
    if (!form.firstName.trim()) { toast.error('الاسم الأول مطلوب'); return; }
    if (form.password.length < 8) { toast.error('كلمة المرور 8 أحرف على الأقل'); return; }
    setLoading(true);
    try {
      await register({
        email: form.email, password: form.password,
        name: `${form.firstName} ${form.lastName}`.trim(),
        role: form.role,
        referral_code: form.referral_code || undefined
      });
      toast.success('تم إنشاء الحساب!');
      navigate(form.role === 'merchant' ? '/merchant/dashboard'
             : form.role === 'driver'   ? '/driver/dashboard' : '/shop');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'فشل التسجيل');
    } finally { setLoading(false); }
  };

  // رسالة اللوحة اليسرى حسب التقدم
  const panelMsg = () => {
    if (step === 1) return { emoji: '👋', text: 'أهلاً بك في سهل!', sub: 'اختر نوع حسابك للبدء' };
    if (progress < 40) return { emoji: '✏️', text: 'ابدأ بإدخال بياناتك', sub: 'كل خطوة تقربك من هدفك' };
    if (progress < 70) return { emoji: '💪', text: 'رائع! استمر', sub: 'أنت في منتصف الطريق' };
    if (progress < 95) return { emoji: '🎯', text: 'لقليل وتنتهي!', sub: 'أضف آخر التفاصيل' };
    return { emoji: '🎉', text: 'كل شيء جاهز!', sub: 'اضغط "إنشاء الحساب" الآن' };
  };

  const msg = panelMsg();

  const inp = (extra = {}) => ({
    width: '100%', padding: '13px 14px',
    border: '1.5px solid #E2E8F0', borderRadius: '12px',
    fontSize: '16px', background: '#F8FAFC', color: '#0F172A',
    fontFamily: 'Tajawal,sans-serif', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s',
    ...extra,
  });

  return (
    <div style={{
      minHeight: '100svh', background: '#F8F9FA',
      fontFamily: 'Tajawal,Cairo,sans-serif', direction: 'rtl',
      display: 'flex', alignItems: 'stretch',
      paddingTop: 'env(safe-area-inset-top)',
    }}>

      {/* ===== اللوحة اليسرى (مخفية على الشاشات الصغيرة جداً) ===== */}
      <div style={{
        width: '42%', minWidth: '280px',
        background: 'linear-gradient(160deg,#1a1235 0%,#2d1f5e 50%,#3d2a7a 100%)',
        position: 'relative', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', overflow: 'hidden',
        flexShrink: 0,
      }} className="register-left-panel">

        {/* زر العودة */}
        <a href="/" style={{
          position: 'absolute', top: '20px', right: '20px',
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff', padding: '7px 16px', borderRadius: '50px', fontSize: '13px',
          display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', zIndex: 2,
          transition: 'background 0.2s',
        }}>← رجوع</a>

        {/* شريط التقدم الدائري */}
        <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 2 }}>
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4"/>
            <circle cx="26" cy="26" r="22" fill="none" stroke="#F97316" strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 22}`}
              strokeDashoffset={`${2 * Math.PI * 22 * (1 - progress / 100)}`}
              strokeLinecap="round"
              transform="rotate(-90 26 26)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
            <text x="26" y="31" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700"
              fontFamily="Cairo,sans-serif">{progress}%</text>
          </svg>
        </div>

        {/* الشعار */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2, padding: '20px' }}>
          <div style={{
            width: '80px', height: '80px',
            background: 'linear-gradient(135deg,#4338CA,#F97316)',
            borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '40px', fontWeight: 700, color: '#fff',
            boxShadow: '0 8px 32px rgba(67,56,202,0.4)',
            transition: 'transform 0.3s ease',
            transform: loading ? 'scale(1.1) rotate(5deg)' : 'scale(1) rotate(0deg)',
          }}>س</div>
          <span style={{ fontFamily: 'Cairo,sans-serif', fontWeight: 700, fontSize: '34px', color: '#fff', marginTop: '12px' }}>سهل</span>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', letterSpacing: '4px' }}>SAHAL</span>

          {/* الرسالة المتحركة */}
          <div style={{
            marginTop: '32px', textAlign: 'center',
            background: 'rgba(255,255,255,0.08)', borderRadius: '16px',
            padding: '18px 24px', backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.1)',
            transition: 'all 0.5s ease',
          }}>
            <div style={{ fontSize: '36px', marginBottom: '8px', transition: 'transform 0.3s',
              transform: focusedField ? 'scale(1.2)' : 'scale(1)' }}>
              {msg.emoji}
            </div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '17px', margin: '0 0 4px', transition: 'all 0.4s' }}>
              {msg.text}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: 0 }}>
              {msg.sub}
            </p>
          </div>
        </div>

        {/* الأمواج SVG في الأسفل */}
        <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice"
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%', opacity: 0.85 }}>
          <path d="M0,180 Q50,120 120,140 Q180,160 240,110 Q300,60 360,100 Q390,115 400,105 L400,220 L0,220Z"
            fill="rgba(67,56,202,0.35)">
            <animateTransform attributeName="transform" type="translate"
              values="0,0; -20,5; 0,0" dur={`${4 - progress / 50}s`} repeatCount="indefinite"/>
          </path>
          <path d="M0,200 Q60,150 130,165 Q200,180 260,140 Q320,100 380,130 L400,135 L400,220 L0,220Z"
            fill="rgba(49,42,153,0.5)">
            <animateTransform attributeName="transform" type="translate"
              values="0,0; 15,-4; 0,0" dur={`${3 - progress / 60}s`} repeatCount="indefinite"/>
          </path>
          <path d="M0,210 Q80,175 160,185 Q230,195 290,165 Q340,145 400,160 L400,220 L0,220Z"
            fill="rgba(35,28,100,0.7)">
            <animateTransform attributeName="transform" type="translate"
              values="0,0; -10,3; 0,0" dur={`${2.5 - progress / 70}s`} repeatCount="indefinite"/>
          </path>
        </svg>

        {/* النقاط المضيئة */}
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: `${6 + i * 2}px`, height: `${6 + i * 2}px`,
            borderRadius: '50%', background: `rgba(249,115,22,${0.3 + i * 0.1})`,
            top: `${15 + i * 14}%`, left: `${10 + i * 16}%`,
            animation: `float${i} ${3 + i}s ease-in-out infinite`,
            zIndex: 1,
          }}/>
        ))}

        {/* نص أسفل اليسار */}
        <div style={{ position: 'relative', zIndex: 2, padding: '0 24px 24px' }}>
          <h2 style={{ fontFamily: 'Cairo,sans-serif', fontSize: '19px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
            تسوّق، بِع، وصّل
          </h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', margin: 0 }}>
            منصة التجارة الإلكترونية المتكاملة
          </p>
        </div>
      </div>

      {/* ===== النموذج الأيمن ===== */}
      <div style={{
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '32px 24px',
        background: '#fff',
      }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>

          {/* Header الموبايل فقط */}
          <div className="register-mobile-header" style={{ display: 'none', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <button onClick={() => navigate('/')}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#475569', fontSize: '14px', padding: 0 }}>
              ← رجوع
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'linear-gradient(135deg,#4338CA,#F97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '16px' }}>س</div>
              <span style={{ fontWeight: 700, color: '#4338CA' }}>سهل</span>
            </div>
            <button onClick={() => navigate('/login')} style={{ border: 'none', background: 'none', color: '#4338CA', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>دخول</button>
          </div>

          {/* شريط التقدم الخطي — موبايل */}
          <div className="register-mobile-progress" style={{ display: 'none', marginBottom: '20px' }}>
            <div style={{ height: '4px', background: '#F1F5F9', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg,#4338CA,#F97316)', borderRadius: '2px', width: `${progress}%`, transition: 'width 0.5s ease' }}></div>
            </div>
            <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px', textAlign: 'left' }}>{progress}% مكتمل</p>
          </div>

          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
            {step === 1 ? 'انضم إلى سهل' : 'أنشئ حسابك'}
          </h1>
          <p style={{ fontSize: '14px', color: '#475569', marginBottom: '28px' }}>
            {step === 1 ? 'اختر نوع حسابك لتبدأ رحلتك' : 'أدخل بياناتك لإنشاء الحساب'}
          </p>

          {/* ===== Step 1: اختيار الدور ===== */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fadeIn 0.3s ease' }}>
              {ROLES.map(r => (
                <button key={r.key}
                  onClick={() => { setForm(f => ({ ...f, role: r.key })); setStep(2); }}
                  style={{
                    padding: '18px 20px', borderRadius: '14px', cursor: 'pointer',
                    border: form.role === r.key ? '2px solid #4338CA' : '1.5px solid #E2E8F0',
                    background: form.role === r.key ? '#EEF2FF' : '#fff',
                    display: 'flex', alignItems: 'center', gap: '14px', textAlign: 'right',
                    transition: 'all 0.2s', width: '100%', minHeight: '72px',
                    boxShadow: form.role === r.key ? '0 0 0 4px rgba(67,56,202,0.1)' : 'none',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#4338CA'; e.currentTarget.style.background = '#F8F9FF'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = form.role === r.key ? '#4338CA' : '#E2E8F0'; e.currentTarget.style.background = form.role === r.key ? '#EEF2FF' : '#fff'; }}>
                  <span style={{ fontSize: '32px' }}>{r.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: '16px', color: '#0F172A', margin: 0 }}>{r.label}</p>
                    <p style={{ fontSize: '13px', color: '#475569', margin: '2px 0 0' }}>{r.desc}</p>
                  </div>
                  <span style={{ color: '#CBD5E1', fontSize: '20px' }}>←</span>
                </button>
              ))}

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#E2E8F0' }}></div>
                <span style={{ fontSize: '13px', color: '#94A3B8' }}>أو</span>
                <div style={{ flex: 1, height: 1, background: '#E2E8F0' }}></div>
              </div>

              <button onClick={handleGoogleLogin} style={{
                width: '100%', padding: '14px', border: '1.5px solid #E2E8F0', borderRadius: '12px',
                background: '#fff', fontSize: '15px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                fontFamily: 'Tajawal,sans-serif', fontWeight: 600, color: '#0F172A', minHeight: '52px',
                transition: 'background 0.2s',
              }}>
                <GoogleIcon />
                المتابعة بـ Google
              </button>

              <p style={{ textAlign: 'center', fontSize: '14px', color: '#475569', marginTop: '4px' }}>
                لديك حساب؟{' '}
                <button onClick={() => navigate('/login')} style={{ border: 'none', background: 'none', color: '#4338CA', fontWeight: 600, cursor: 'pointer', fontSize: '14px', fontFamily: 'Tajawal,sans-serif' }}>
                  سجّل دخولك
                </button>
              </p>
            </div>
          )}

          {/* ===== Step 2: النموذج ===== */}
          {step === 2 && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'slideUp 0.35s ease' }}>

              {/* نوع الحساب المختار */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#EEF2FF', borderRadius: '12px', padding: '10px 14px', cursor: 'pointer' }}
                onClick={() => setStep(1)}>
                <span style={{ fontSize: '22px' }}>{ROLES.find(r => r.key === form.role)?.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: '#4338CA' }}>
                    {ROLES.find(r => r.key === form.role)?.label}
                  </p>
                </div>
                <span style={{ fontSize: '12px', color: '#4338CA', fontFamily: 'Tajawal,sans-serif' }}>تغيير ←</span>
              </div>

              {/* الاسم */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Field label="الاسم الأول *" required>
                  <input style={inp({ borderColor: focusedField === 'firstName' ? '#4338CA' : (form.firstName ? '#10B981' : '#E2E8F0'), boxShadow: focusedField === 'firstName' ? '0 0 0 3px rgba(67,56,202,0.1)' : 'none' })}
                    value={form.firstName} onChange={set('firstName')}
                    placeholder="محمد" required autoComplete="given-name"
                    onFocus={() => setFocusedField('firstName')}
                    onBlur={() => setFocusedField('')} />
                </Field>
                <Field label="اسم العائلة">
                  <input style={inp({ borderColor: focusedField === 'lastName' ? '#4338CA' : (form.lastName ? '#10B981' : '#E2E8F0'), boxShadow: focusedField === 'lastName' ? '0 0 0 3px rgba(67,56,202,0.1)' : 'none' })}
                    value={form.lastName} onChange={set('lastName')}
                    placeholder="الأحمدي" autoComplete="family-name"
                    onFocus={() => setFocusedField('lastName')}
                    onBlur={() => setFocusedField('')} />
                </Field>
              </div>

              {/* البريد */}
              <Field label="البريد الإلكتروني *">
                <input style={inp({ borderColor: focusedField === 'email' ? '#4338CA' : (form.email ? '#10B981' : '#E2E8F0'), boxShadow: focusedField === 'email' ? '0 0 0 3px rgba(67,56,202,0.1)' : 'none' })}
                  type="email" value={form.email} onChange={set('email')}
                  placeholder="example@email.com" required dir="ltr"
                  autoComplete="email" inputMode="email"
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField('')} />
              </Field>

              {/* كلمة المرور */}
              <Field label="كلمة المرور *">
                <div style={{ position: 'relative' }}>
                  <input style={inp({
                    paddingLeft: '44px',
                    borderColor: focusedField === 'password' ? '#4338CA' : form.password.length >= 8 ? '#10B981' : form.password ? '#F97316' : '#E2E8F0',
                    boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(67,56,202,0.1)' : 'none',
                  })}
                    type={form.showPassword ? 'text' : 'password'}
                    value={form.password} onChange={set('password')}
                    placeholder="8 أحرف على الأقل" required dir="ltr" autoComplete="new-password"
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField('')} />
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, showPassword: !f.showPassword }))}
                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>
                    {form.showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {/* مؤشر قوة كلمة المرور */}
                {form.password && (
                  <PasswordStrength password={form.password} />
                )}
              </Field>

              {/* رمز الإحالة */}
              {(form.referral_code || searchParams.get('ref')) && (
                <Field label="رمز الإحالة">
                  <input style={inp({ background: '#F0FDF4', borderColor: '#86EFAC' })}
                    value={form.referral_code} onChange={set('referral_code')}
                    placeholder="SAHALXXXXXX" dir="ltr" />
                </Field>
              )}

              {/* الموافقة */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#4338CA', marginTop: '2px', flexShrink: 0, cursor: 'pointer' }} />
                <span style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                  أوافق على <span style={{ color: '#4338CA', fontWeight: 600 }}>الشروط والأحكام</span> وسياسة الخصوصية
                </span>
              </label>

              {/* زر الإرسال */}
              <button type="submit" disabled={loading || !agreed}
                style={{
                  width: '100%', padding: '15px',
                  background: loading ? '#6366F1' : (!agreed ? '#9CA3AF' : 'linear-gradient(135deg,#4338CA,#7C3AED)'),
                  color: '#fff', border: 'none', borderRadius: '12px',
                  fontSize: '16px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'Cairo,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  minHeight: '52px', transition: 'all 0.3s',
                  boxShadow: !loading && agreed ? '0 4px 15px rgba(67,56,202,0.35)' : 'none',
                  transform: loading ? 'scale(0.98)' : 'scale(1)',
                }}>
                {loading ? (
                  <><Spinner /> جارٍ الإنشاء...</>
                ) : (
                  <>🚀 إنشاء الحساب</>
                )}
              </button>

              {/* Google */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1, height: 1, background: '#E2E8F0' }}></div>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>أو سجّل بـ</span>
                <div style={{ flex: 1, height: 1, background: '#E2E8F0' }}></div>
              </div>

              <button type="button" onClick={handleGoogleLogin} style={{
                width: '100%', padding: '13px', border: '1.5px solid #E2E8F0', borderRadius: '12px',
                background: '#fff', fontSize: '15px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                fontFamily: 'Tajawal,sans-serif', fontWeight: 600, color: '#0F172A', minHeight: '52px',
                transition: 'background 0.2s',
              }}>
                <GoogleIcon /> المتابعة بـ Google
              </button>

              <p style={{ textAlign: 'center', fontSize: '14px', color: '#475569' }}>
                لديك حساب؟{' '}
                <button type="button" onClick={() => navigate('/login')} style={{ border: 'none', background: 'none', color: '#4338CA', fontWeight: 600, cursor: 'pointer', fontSize: '14px', fontFamily: 'Tajawal,sans-serif' }}>
                  سجّل دخولك
                </button>
              </p>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float0 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes float1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        @keyframes float2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes float3 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes float4 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        /* موبايل: إخفاء اللوحة اليسرى وإظهار عناصر الموبايل */
        @media (max-width: 600px) {
          .register-left-panel { display: none !important; }
          .register-mobile-header { display: flex !important; }
          .register-mobile-progress { display: block !important; }
        }
        @media (max-width: 900px) and (min-width: 601px) {
          .register-left-panel { width: 35% !important; min-width: 200px !important; }
        }
      `}</style>
    </div>
  );
};

// ===== مكوّنات مساعدة =====

const Field = ({ label, children }) => (
  <div>
    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
      {label}
    </label>
    {children}
  </div>
);

const PasswordStrength = ({ password }) => {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const levels = [
    { label: 'ضعيفة', color: '#E11D48' },
    { label: 'مقبولة', color: '#F97316' },
    { label: 'جيدة', color: '#EAB308' },
    { label: 'قوية', color: '#10B981' },
  ];
  const lvl = levels[score - 1] || levels[0];

  return (
    <div style={{ marginTop: '6px' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '3px' }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            flex: 1, height: '4px', borderRadius: '2px',
            background: i <= score ? lvl.color : '#E2E8F0',
            transition: 'background 0.3s',
          }}/>
        ))}
      </div>
      <p style={{ fontSize: '11px', color: lvl.color, margin: 0 }}>كلمة المرور {lvl.label}</p>
    </div>
  );
};

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const Spinner = () => (
  <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
);

export default Register;
