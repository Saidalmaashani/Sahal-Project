import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Send, X, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';
import StarRating from './StarRating';

const LABELS = ['', 'سيء جداً', 'سيء', 'مقبول', 'جيد', 'ممتاز'];

const ReviewForm = ({ productId, productName, onClose, onSubmitted }) => {
  const [rating, setRating]   = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]       = useState(false);

  const submit = async () => {
    if (!rating) { toast.error('اختر عدد النجوم أولاً'); return; }
    if (comment.trim().length < 5) { toast.error('اكتب تعليقاً (5 أحرف على الأقل)'); return; }
    setSubmitting(true);
    try {
      await api.post(`/products/${productId}/reviews`, { rating, comment: comment.trim() });
      setDone(true);
      setTimeout(() => { onSubmitted?.(); onClose?.(); }, 1800);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'فشل إرسال التقييم');
    } finally { setSubmitting(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 24, opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 300 }}
        style={{
          background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '460px',
          direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif',
          boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontWeight: 800, fontSize: '18px', margin: 0, color: '#0F172A' }}>قيّم المنتج</h3>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>{productName}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '8px' }}>
            <X style={{ width: 20, height: 20, color: '#94A3B8' }} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ padding: '48px 24px', textAlign: 'center' }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                <CheckCircle style={{ width: 56, height: 56, color: '#10B981', margin: '0 auto 16px' }} />
              </motion.div>
              <p style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>شكراً على تقييمك!</p>
              <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>رأيك يساعد المتسوقين الآخرين</p>
            </motion.div>
          ) : (
            <motion.div key="form" style={{ padding: '24px' }}>
              {/* النجوم */}
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                  <StarRating value={rating} onChange={setRating} size={36} />
                </div>
                <AnimatePresence mode="wait">
                  {rating > 0 && (
                    <motion.p
                      key={rating}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      style={{
                        fontSize: '15px', fontWeight: 700,
                        color: ['', '#E11D48', '#F97316', '#EAB308', '#10B981', '#4338CA'][rating],
                      }}
                    >
                      {LABELS[rating]}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* التعليق */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '8px' }}>
                  تعليقك <span style={{ color: '#94A3B8', fontWeight: 400 }}>(اشرح تجربتك)</span>
                </label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="كيف كان المنتج؟ هل يطابق الوصف؟ هل توصي به؟..."
                  rows={4}
                  style={{
                    width: '100%', padding: '12px', border: '1.5px solid #E2E8F0',
                    borderRadius: '12px', fontSize: '14px', fontFamily: 'Tajawal,sans-serif',
                    resize: 'vertical', outline: 'none', lineHeight: 1.6,
                    transition: 'border-color 0.2s', boxSizing: 'border-box',
                    color: '#0F172A',
                  }}
                  onFocus={e => e.target.style.borderColor = '#4338CA'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                />
                <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', textAlign: 'left' }}>
                  {comment.length}/500
                </p>
              </div>

              {/* الأزرار */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid #E2E8F0',
                    background: '#fff', color: '#475569', fontFamily: 'Tajawal,sans-serif',
                    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  إلغاء
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={submit}
                  disabled={submitting || !rating}
                  style={{
                    flex: 2, padding: '12px', borderRadius: '12px', border: 'none',
                    background: rating ? 'linear-gradient(135deg, #4338CA, #7C3AED)' : '#E2E8F0',
                    color: rating ? '#fff' : '#94A3B8',
                    fontFamily: 'Tajawal,sans-serif', fontSize: '14px', fontWeight: 700,
                    cursor: rating ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    transition: 'all 0.2s',
                  }}
                >
                  {submitting ? (
                    <span style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  ) : (
                    <><Send style={{ width: 16, height: 16 }} />نشر التقييم</>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </motion.div>
    </motion.div>
  );
};

export default ReviewForm;
