import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Trash2, ThumbsUp, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import StarRating, { StarDisplay } from './StarRating';

const RatingBar = ({ count, total, star }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const colors = { 5: '#10B981', 4: '#4338CA', 3: '#F59E0B', 2: '#F97316', 1: '#E11D48' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '12px', color: '#475569', minWidth: '8px' }}>{star}</span>
      <Star style={{ width: 12, height: 12, fill: '#F59E0B', color: '#F59E0B' }} />
      <div style={{ flex: 1, height: '8px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ height: '100%', background: colors[star], borderRadius: '4px' }}
        />
      </div>
      <span style={{ fontSize: '11px', color: '#94A3B8', minWidth: '28px', textAlign: 'left' }}>{count}</span>
    </div>
  );
};

const ReviewCard = ({ review, onDelete, canDelete }) => {
  const initials = review.user_name?.slice(0, 1) || '?';
  const avatarColors = ['#4338CA', '#7C3AED', '#10B981', '#F97316', '#E11D48'];
  const color = avatarColors[review.user_name?.charCodeAt(0) % 5 || 0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{
        background: '#fff', borderRadius: '14px', padding: '16px',
        border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Avatar */}
          <div style={{
            width: '38px', height: '38px', borderRadius: '50%', background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: '16px', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A', margin: 0 }}>{review.user_name}</p>
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>
              {new Date(review.created_at).toLocaleDateString('ar-OM', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StarRating value={review.rating} size={16} readonly />
          {canDelete && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onDelete(review.review_id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px', color: '#94A3B8' }}
            >
              <Trash2 style={{ width: 14, height: 14 }} />
            </motion.button>
          )}
        </div>
      </div>
      <p style={{ fontSize: '14px', color: '#374151', lineHeight: 1.7, margin: 0 }}>
        {review.comment}
      </p>
    </motion.div>
  );
};

const ReviewList = ({ productId, refreshTrigger }) => {
  const { user } = useAuth();
  const [reviews, setReviews]   = useState([]);
  const [rating, setRating]     = useState({ average: 0, count: 0, distribution: {} });
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState(0);   // 0 = الكل, 1-5 = نجوم محددة

  const load = useCallback(async () => {
    try {
      const [rev, rat] = await Promise.all([
        api.get(`/products/${productId}/reviews`),
        api.get(`/products/${productId}/rating`),
      ]);
      setReviews(rev.data);
      setRating(rat.data);
    } catch {} finally { setLoading(false); }
  }, [productId, refreshTrigger]);

  useEffect(() => { load(); }, [load]);

  const deleteReview = async (reviewId) => {
    try {
      await api.delete(`/reviews/${reviewId}`);
      setReviews(prev => prev.filter(r => r.review_id !== reviewId));
      toast.success('تم حذف التقييم');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'فشل الحذف');
    }
  };

  const filtered = filter ? reviews.filter(r => r.rating === filter) : reviews;

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {[1,2].map(i => (
        <div key={i} style={{ height: '90px', background: '#F8FAFC', borderRadius: '14px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
      ))}
      <style>{`@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  );

  return (
    <div>
      {/* ملخص التقييم */}
      <div style={{
        background: 'linear-gradient(135deg, #F8F9FF 0%, #EEF2FF 100%)',
        borderRadius: '16px', padding: '20px', marginBottom: '20px',
        border: '1px solid #E0E7FF',
        display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '24px', alignItems: 'center',
      }}>
        {/* الرقم الكبير */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '52px', fontWeight: 900, color: '#4338CA', lineHeight: 1, margin: 0 }}>
            {rating.average > 0 ? rating.average.toFixed(1) : '—'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 4px' }}>
            <StarRating value={rating.average} size={18} readonly />
          </div>
          <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
            {rating.count} {rating.count === 1 ? 'تقييم' : 'تقييم'}
          </p>
        </div>
        {/* أشرطة التوزيع */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {[5, 4, 3, 2, 1].map(s => (
            <RatingBar
              key={s} star={s}
              count={rating.distribution?.[String(s)] || 0}
              total={rating.count}
            />
          ))}
        </div>
      </div>

      {/* فلتر النجوم */}
      {rating.count > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {[0, 5, 4, 3, 2, 1].map(s => (
            <motion.button
              key={s}
              whileTap={{ scale: 0.94 }}
              onClick={() => setFilter(s)}
              style={{
                padding: '5px 12px', borderRadius: '20px', border: '1.5px solid',
                borderColor: filter === s ? '#4338CA' : '#E2E8F0',
                background: filter === s ? '#4338CA' : '#fff',
                color: filter === s ? '#fff' : '#475569',
                fontSize: '13px', fontFamily: 'Tajawal,sans-serif', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                transition: 'all 0.15s',
              }}
            >
              {s === 0 ? `الكل (${rating.count})` : (
                <><Star style={{ width: 12, height: 12, fill: 'currentColor' }} />{s}</>
              )}
            </motion.button>
          ))}
        </div>
      )}

      {/* قائمة التقييمات */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
          <MessageSquare style={{ width: 40, height: 40, margin: '0 auto 10px', opacity: 0.3 }} />
          <p style={{ fontSize: '14px', margin: 0 }}>
            {filter ? `لا توجد تقييمات بـ ${filter} نجوم` : 'لا توجد تقييمات بعد — كن أول من يقيّم!'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <AnimatePresence>
            {filtered.map(review => (
              <ReviewCard
                key={review.review_id}
                review={review}
                onDelete={deleteReview}
                canDelete={user?.user_id === review.user_id || user?.role === 'admin'}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default ReviewList;
