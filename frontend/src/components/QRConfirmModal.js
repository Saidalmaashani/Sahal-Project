import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { X, CheckCircle, Clock, RefreshCw, Smartphone, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';
import { useT } from '../contexts/ThemeContext';

const QRConfirmModal = ({ order, onClose, onConfirmed }) => {
  const t = useT();
  const [qrData, setQrData]     = useState(null);
  const [status, setStatus]     = useState('loading'); // loading | ready | confirmed | expired | error
  const [secondsLeft, setSecondsLeft] = useState(0);
  const pollRef  = useRef(null);
  const tickRef  = useRef(null);
  const mountRef = useRef(true);

  const generate = async () => {
    setStatus('loading');
    try {
      const r = await api.post(`/deliveries/${order.order_id}/generate-qr`);
      if (!mountRef.current) return;
      setQrData(r.data);
      setStatus('ready');
      const exp = new Date(r.data.expires_at);
      setSecondsLeft(Math.max(0, Math.round((exp - Date.now()) / 1000)));
    } catch (e) {
      setStatus('error');
      toast.error(e.response?.data?.detail || 'فشل توليد الرمز');
    }
  };

  // poll للتحقق من التأكيد
  useEffect(() => {
    if (status !== 'ready' || !qrData) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await api.get(`/deliveries/confirm/${qrData.token}`);
        if (!mountRef.current) return;
        if (r.data.status === 'confirmed') {
          clearInterval(pollRef.current);
          setStatus('confirmed');
          setTimeout(() => { onConfirmed?.(); onClose?.(); }, 2500);
        }
      } catch (e) {
        if (e.response?.status === 410) { setStatus('expired'); clearInterval(pollRef.current); }
      }
    }, 2500);
    return () => clearInterval(pollRef.current);
  }, [status, qrData]);

  // عداد تنازلي
  useEffect(() => {
    if (status !== 'ready') return;
    tickRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(tickRef.current); setStatus('expired'); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [status]);

  useEffect(() => {
    mountRef.current = true;
    generate();
    return () => { mountRef.current = false; clearInterval(pollRef.current); clearInterval(tickRef.current); };
  }, []);

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const pct  = qrData ? Math.round((secondsLeft / 1800) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif',
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 24 }}
        transition={{ type: 'spring', damping: 22, stiffness: 300 }}
        style={{
          background: t.card, borderRadius: 24, width: '100%', maxWidth: 400,
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)', overflow: 'hidden',
          border: `1px solid ${t.border}`,
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#4338CA,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck style={{ width: 20, height: 20, color: '#fff' }} />
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 15, color: t.text, margin: 0 }}>تأكيد التسليم</p>
              <p style={{ fontSize: 11, color: t.muted, margin: 0 }}>طلب #{order.order_id.slice(-8)}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X style={{ width: 20, height: 20, color: t.muted }} />
          </button>
        </div>

        {/* المحتوى */}
        <div style={{ padding: '24px 20px' }}>
          <AnimatePresence mode="wait">

            {/* تحميل */}
            {status === 'loading' && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ textAlign: 'center', padding: '40px 0' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                  style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid ${t.border}`, borderTopColor: '#4338CA', margin: '0 auto 16px' }} />
                <p style={{ color: t.text2, fontSize: 14 }}>جارٍ توليد رمز التحقق...</p>
              </motion.div>
            )}

            {/* رمز QR جاهز */}
            {status === 'ready' && qrData && (
              <motion.div key="qr" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                style={{ textAlign: 'center' }}>

                {/* التعليمات */}
                <div style={{ background: '#EEF2FF', borderRadius: 12, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Smartphone style={{ width: 16, height: 16, color: '#4338CA', flexShrink: 0 }} />
                  <p style={{ fontSize: 13, color: '#3730A3', margin: 0, fontWeight: 600 }}>
                    اطلب من الزبون مسح هذا الرمز لتأكيد استلامه
                  </p>
                </div>

                {/* رمز QR */}
                <div style={{ display: 'inline-block', background: '#fff', padding: 16, borderRadius: 16, border: '2px solid #E0E7FF', boxShadow: '0 4px 20px rgba(67,56,202,0.15)', marginBottom: 16 }}>
                  <QRCodeSVG
                    value={qrData.confirm_url}
                    size={200}
                    level="H"
                    includeMargin={false}
                    imageSettings={{
                      src: '',
                      excavate: false,
                    }}
                  />
                </div>

                {/* URL قصير */}
                <p style={{ fontSize: 10, color: t.muted, margin: '0 0 16px', wordBreak: 'break-all', padding: '0 8px' }}>
                  {qrData.confirm_url}
                </p>

                {/* مؤقت */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ height: 6, background: t.bg3, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                    <motion.div
                      initial={{ width: '100%' }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: 'linear' }}
                      style={{ height: '100%', borderRadius: 4, background: secondsLeft > 300 ? '#10B981' : secondsLeft > 60 ? '#F59E0B' : '#E11D48' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Clock style={{ width: 13, height: 13, color: t.muted }} />
                    <span style={{ fontSize: 13, color: t.text2, fontWeight: 600 }}>
                      ينتهي خلال {fmt(secondsLeft)}
                    </span>
                  </div>
                </div>

                {/* نبضة انتظار */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: t.text2, fontSize: 13 }}>
                  <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                    style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
                  بانتظار تأكيد الزبون...
                </div>
              </motion.div>
            )}

            {/* تم التأكيد */}
            {status === 'confirmed' && (
              <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                style={{ textAlign: 'center', padding: '32px 0' }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
                  <CheckCircle style={{ width: 72, height: 72, color: '#10B981', margin: '0 auto 16px' }} />
                </motion.div>
                <h3 style={{ fontSize: 22, fontWeight: 900, color: t.text, margin: '0 0 8px' }}>تم التأكيد! 🎉</h3>
                <p style={{ fontSize: 14, color: t.text2, margin: 0 }}>أكّد الزبون استلام الطلب بنجاح</p>
              </motion.div>
            )}

            {/* انتهت الصلاحية */}
            {(status === 'expired' || status === 'error') && (
              <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⏰</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, margin: '0 0 8px' }}>
                  {status === 'expired' ? 'انتهت صلاحية الرمز' : 'حدث خطأ'}
                </h3>
                <p style={{ fontSize: 13, color: t.muted, margin: '0 0 20px' }}>
                  {status === 'expired' ? 'الرمز صالح لمدة 30 دقيقة فقط' : 'حاول مجدداً'}
                </p>
                <motion.button whileTap={{ scale: 0.95 }} onClick={generate}
                  style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#4338CA,#7C3AED)', color: '#fff', fontFamily: 'Tajawal,sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <RefreshCw style={{ width: 15, height: 15 }} />توليد رمز جديد
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default QRConfirmModal;
