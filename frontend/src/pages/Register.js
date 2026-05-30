import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useAuth();
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'shopper', referral_code: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = () => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
    const scope = encodeURIComponent('openid email profile');
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  };

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setFormData(prev => ({ ...prev, referral_code: ref.toUpperCase() }));
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreed) { toast.error('يجب الموافقة على الشروط'); return; }
    setLoading(true);
    try {
      const payload = { email: formData.email, password: formData.password, name: (formData.firstName + ' ' + formData.lastName).trim(), role: formData.role, referral_code: formData.referral_code || undefined };
      await register(payload);
      toast.success('تم إنشاء الحساب!');
      navigate(formData.role === 'merchant' ? '/merchant/dashboard' : formData.role === 'driver' ? '/driver/dashboard' : '/shop');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل التسجيل');
    } finally { setLoading(false); }
  };

  const inp = { width: '100%', padding: '10px 14px', border: '0.5px solid #CBD5E1', borderRadius: '10px', fontSize: '14px', background: '#F8F9FA', color: '#0F172A', fontFamily: "Tajawal,sans-serif", outline: 'none' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F9FA', padding: '1rem', fontFamily: "Tajawal,Cairo,sans-serif", direction: 'rtl' }}>
      <div style={{ display: 'flex', width: '100%', maxWidth: '900px', minHeight: '600px', borderRadius: '20px', overflow: 'hidden', border: '0.5px solid #E2E8F0', boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>

        <div style={{ flex: 1, background: 'linear-gradient(160deg,#1a1235 0%,#2d1f5e 50%,#3d2a7a 100%)', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '2rem', overflow: 'hidden', minWidth: '260px' }}>
          <a href="/" style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', background: 'rgba(255,255,255,0.12)', border: '0.5px solid rgba(255,255,255,0.2)', color: '#fff', padding: '7px 14px', borderRadius: '50px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', zIndex: 2 }}>
            → العودة
          </a>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', zIndex: 2 }}>
            <div style={{ width: '72px', height: '72px', background: 'linear-gradient(135deg,#4338CA,#F97316)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '38px', color: '#fff' }}>س</div>
            <span style={{ fontFamily: "Cairo,sans-serif", fontWeight: 700, fontSize: '32px', color: '#fff' }}>سهل</span>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', letterSpacing: '4px' }}>SAHAL</span>
          </div>
          <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', opacity: 0.85 }}>
            <path d="M0,180 Q50,120 120,140 Q180,160 240,110 Q300,60 360,100 Q390,115 400,105 L400,220 L0,220Z" fill="rgba(67,56,202,0.35)"/>
            <path d="M0,200 Q60,150 130,165 Q200,180 260,140 Q320,100 380,130 L400,135 L400,220 L0,220Z" fill="rgba(49,42,153,0.5)"/>
            <path d="M0,210 Q80,175 160,185 Q230,195 290,165 Q340,145 400,160 L400,220 L0,220Z" fill="rgba(35,28,100,0.7)"/>
          </svg>
          <div style={{ position: 'relative', zIndex: 2, color: '#fff' }}>
            <h2 style={{ fontFamily: "Cairo,sans-serif", fontSize: '20px', fontWeight: 700, marginBottom: '6px', lineHeight: 1.4 }}>تسوّق، بِع، وصّل<br/>كل شيء في مكان واحد</h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>منصة التجارة الإلكترونية المتكاملة</p>
            <div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
              <div style={{ width: '32px', height: '3px', borderRadius: '2px', background: '#fff' }}></div>
              <div style={{ width: '24px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.3)' }}></div>
              <div style={{ width: '24px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.3)' }}></div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#fff', overflowY: 'auto' }}>
          <h1 style={{ fontFamily: "Cairo,sans-serif", fontSize: '26px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>أنشئ حسابك</h1>
          <p style={{ fontSize: '14px', color: '#475569', marginBottom: '1.8rem' }}>لديك حساب؟ <span onClick={() => navigate('/login')} style={{ color: '#4338CA', cursor: 'pointer', fontWeight: 500 }}>تسجيل الدخول</span></p>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', background: '#F8F9FA', padding: '4px', borderRadius: '10px' }}>
            {[['shopper','متسوق'],['merchant','تاجر'],['driver','مندوب']].map(([k,l]) => (
              <button key={k} onClick={() => setFormData({...formData, role: k})} style={{ flex: 1, padding: '7px', border: 'none', borderRadius: '7px', fontSize: '13px', cursor: 'pointer', fontFamily: "Tajawal,sans-serif", background: formData.role===k ? '#fff' : 'transparent', color: formData.role===k ? '#4338CA' : '#475569', fontWeight: formData.role===k ? 600 : 400, boxShadow: formData.role===k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{l}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div><label style={{ display: 'block', fontSize: '13px', color: '#475569', marginBottom: '5px' }}>الاسم الأول</label><input style={inp} placeholder="محمد" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} required /></div>
              <div><label style={{ display: 'block', fontSize: '13px', color: '#475569', marginBottom: '5px' }}>اسم العائلة</label><input style={inp} placeholder="الأحمدي" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} /></div>
            </div>
            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '13px', color: '#475569', marginBottom: '5px' }}>البريد الإلكتروني</label><input style={inp} type="email" placeholder="example@email.com" dir="ltr" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required /></div>
            <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', fontSize: '13px', color: '#475569', marginBottom: '5px' }}>كلمة المرور</label>
              <div style={{ position: 'relative' }}>
                <input style={{...inp, paddingLeft:'40px'}} type={showPassword?'text':'password'} placeholder="••••••••" dir="ltr" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px' }}>{showPassword ? '🙈' : '👁️'}</button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0 18px', fontSize: '13px', color: '#475569' }}>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#4338CA' }} />
              <span>أوافق على <span style={{ color: '#4338CA' }}>الشروط والأحكام</span></span>
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: loading ? '#9CA3AF' : '#4338CA', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "Cairo,sans-serif", marginBottom: '16px' }}>
              {loading ? 'جارٍ الإنشاء...' : 'إنشاء حساب'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', fontSize: '13px', color: '#475569' }}>
            <div style={{ flex: 1, height: '0.5px', background: '#E2E8F0' }}></div>أو سجّل عبر<div style={{ flex: 1, height: '0.5px', background: '#E2E8F0' }}></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button onClick={handleGoogleLogin} style={{ padding: '10px', border: '0.5px solid #CBD5E1', borderRadius: '10px', background: '#fff', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google
            </button>
            <button style={{ padding: '10px', border: '0.5px solid #CBD5E1', borderRadius: '10px', background: '#fff', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>🍎 Apple</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;