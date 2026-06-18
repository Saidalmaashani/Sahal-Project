import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, CheckCircle, Package, MapPin, Truck,
  LogIn, AlertCircle, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const PLACEHOLDER = 'https://images.pexels.com/photos/17938771/pexels-photo-17938771.jpeg';

const DeliveryConfirmPage = () => {
  const { token }  = useParams();
  const navigate   = useNavigate();
  const { user, login } = useAuth();

  const [info, setInfo]       = useState(null);
  const [status, setStatus]   = useState('loading'); // loading|ready|confirmed|expired|error
  const [submitting, setSubmitting] = useState(false);
  const [loginForm, setLoginForm]   = useState({ email: '', password: '' });
  const [loggingIn, setLoggingIn]   = useState(false);
  const [showLogin, setShowLogin]   = useState(false);

  useEffect(() => { loadInfo(); }, [token]);

  const loadInfo = async () => {
    setStatus('loading');
    try {
      const r = await api.get(`/deliveries/confirm/${token}`);
      if (r.data.status === 'confirmed') { setStatus('confirmed'); return; }
      setInfo(r.data);
      setStatus('ready');
    } catch (e) {
      if (e.response?.status === 410) setStatus('expired');
      else if (e.response?.status === 404) setStatus('error');
      else setStatus('error');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    try {
      await login(loginForm.email, loginForm.password);
      setShowLogin(false);
      toast.success('تم تسجيل الدخول!');
    } catch {
      toast.error('بيانات الدخول غير صحيحة');
    } finally { setLoggingIn(false); }
  };

  const confirmReceipt = async () => {
    if (!user) { setShowLogin(true); return; }
    setSubmitting(true);
    try {
      await api.post(`/deliveries/confirm/${token}`);
      setStatus('confirmed');
      toast.success('تم تأكيد الاستلام! شكراً لك 🎉');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'فشل التأكيد');
    } finally { setSubmitting(false); }
  };

  const totalItems = info?.items?.reduce((s, i) => s + i.quantity, 0) || 0;

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg,#EEF2FF 0%,#F0FDF4 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif',
    }}>
      <AnimatePresence mode="wait">

        {/* تحميل */}
        {status === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ textAlign: 'center' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
              style={{ width: 52, height: 52, borderRadius: '50%', border: '4px solid #E0E7FF', borderTopColor: '#4338CA', margin: '0 auto 16px' }} />
            <p style={{ color: '#475569', fontSize: 15 }}>جارٍ التحقق من الرمز...</p>
          </motion.div>
        )}

        {/* جاهز للتأكيد */}
        {status === 'ready' && info && (
          <motion.div key="ready" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.12)', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg,#4338CA,#7C3AED)', padding: '24px 20px', textAlign: 'center' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <ShieldCheck style={{ width: 30, height: 30, color: '#fff' }} />
              </div>
              <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 900, margin: '0 0 4px' }}>تأكيد استلام الطلب</h1>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: 0 }}>رقم الطلب: #{info.order_id?.slice(-8)}</p>
            </div>

            <div style={{ padding: '20px' }}>

              {/* معلومات المندوب */}
              {info.driver_name && (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>🚗</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#065F46', margin: 0 }}>{info.driver_name}</p>
                    <p style={{ fontSize: 12, color: '#059669', margin: 0 }}>المندوب · {info.driver_phone || 'لا يوجد هاتف'}</p>
                  </div>
                  <span style={{ marginRight: 'auto', fontSize: 11, color: '#10B981', fontWeight: 600, background: '#DCFCE7', padding: '3px 10px', borderRadius: 20 }}>● في موقعك</span>
                </div>
              )}

              {/* ملخص الطلب */}
              <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Package style={{ width: 15, height: 15, color: '#4338CA' }} />
                  محتويات الطلب ({totalItems} قطعة)
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {info.items?.slice(0, 4).map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                      <span style={{ color: '#475569' }}>• {item.name || `منتج ${i + 1}`} × {item.quantity}</span>
                      <span style={{ fontWeight: 600, color: '#0F172A' }}>{((item.price || 0) * item.quantity).toFixed(3)} ر.ع</span>
                    </div>
                  ))}
                  {info.items?.length > 4 && (
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>+ {info.items.length - 4} منتجات أخرى</p>
                  )}
                </div>
                <div style={{ borderTop: '1px solid #E2E8F0', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>الإجمالي</span>
                  <span style={{ fontWeight: 900, fontSize: 18, color: '#4338CA' }}>{info.total_amount?.toFixed(3)} ر.ع</span>
                </div>
              </div>

              {/* العنوان */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 20, fontSize: 13, color: '#475569' }}>
                <MapPin style={{ width: 15, height: 15, color: '#F97316', marginTop: 2, flexShrink: 0 }} />
                <span>{info.delivery_address}</span>
              </div>

              {/* تسجيل الدخول إذا لم يكن مسجلاً */}
              <AnimatePresence>
                {showLogin && !user && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginBottom: 16 }}>
                    <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: '14px 16px' }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 12 }}>
                        <LogIn style={{ width: 14, height: 14, display: 'inline', marginLeft: 4 }} />
                        سجّل دخولك لتأكيد الاستلام
                      </p>
                      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input type="email" required placeholder="البريد الإلكتروني"
                          value={loginForm.email} onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                          style={{ padding: '9px 12px', border: '1.5px solid #FED7AA', borderRadius: 10, fontSize: 14, fontFamily: 'Tajawal,sans-serif', outline: 'none' }} />
                        <input type="password" required placeholder="كلمة المرور"
                          value={loginForm.password} onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                          style={{ padding: '9px 12px', border: '1.5px solid #FED7AA', borderRadius: 10, fontSize: 14, fontFamily: 'Tajawal,sans-serif', outline: 'none' }} />
                        <button type="submit" disabled={loggingIn}
                          style={{ padding: '10px', borderRadius: 10, border: 'none', background: '#F97316', color: '#fff', fontFamily: 'Tajawal,sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                          {loggingIn ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
                        </button>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* زر التأكيد الرئيسي */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={confirmReceipt}
                disabled={submitting}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                  background: submitting ? '#94A3B8' : 'linear-gradient(135deg,#10B981,#059669)',
                  color: '#fff', fontFamily: 'Tajawal,sans-serif', fontSize: 16, fontWeight: 900,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: submitting ? 'none' : '0 8px 24px rgba(16,185,129,0.4)',
                  transition: 'all 0.2s',
                }}
              >
                {submitting ? (
                  <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
                    style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', display: 'inline-block' }} />
                ) : (
                  <><CheckCircle style={{ width: 20, height: 20 }} />أوافق على استلام الطلب</>
                )}
              </motion.button>

              {!user && (
                <p style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 10 }}>
                  يجب تسجيل الدخول بحسابك لتأكيد الاستلام
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* تم التأكيد */}
        {status === 'confirmed' && (
          <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.12)', padding: '48px 24px', textAlign: 'center' }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle style={{ width: 44, height: 44, color: '#10B981' }} />
              </div>
            </motion.div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', margin: '0 0 8px' }}>تم الاستلام! 🎉</h2>
            <p style={{ fontSize: 15, color: '#475569', margin: '0 0 24px' }}>شكراً لتأكيدك. نتمنى أن تكون راضياً عن طلبك</p>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/my-orders')}
              style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#4338CA,#7C3AED)', color: '#fff', fontFamily: 'Tajawal,sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              عرض طلباتي
            </motion.button>
          </motion.div>
        )}

        {/* منتهي الصلاحية */}
        {status === 'expired' && (
          <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 360, padding: '48px 24px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
            <Clock style={{ width: 56, height: 56, color: '#F59E0B', margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>انتهت صلاحية الرمز</h2>
            <p style={{ color: '#475569', fontSize: 14, margin: '0 0 20px' }}>اطلب من المندوب توليد رمز جديد</p>
          </motion.div>
        )}

        {/* خطأ */}
        {status === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 360, padding: '48px 24px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
            <AlertCircle style={{ width: 56, height: 56, color: '#E11D48', margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>رمز غير صالح</h2>
            <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>هذا الرمز غير موجود أو تم استخدامه مسبقاً</p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

export default DeliveryConfirmPage;
