import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWishlist } from '../contexts/WishlistContext';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ShoppingCart, ArrowRight, Package, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { StarDisplay } from '../components/StarRating';
import WishlistButton from '../components/WishlistButton';

const PLACEHOLDER = 'https://images.pexels.com/photos/17938771/pexels-photo-17938771.jpeg';

const WishlistPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { reload } = useWishlist();
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]  = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    fetchWishlist();
  }, [user, authLoading]);

  const fetchWishlist = async () => {
    try {
      const r = await api.get('/wishlist');
      setItems(r.data);
    } catch {} finally { setLoading(false); }
  };

  const addToCart = async (productId) => {
    setAdding(productId);
    try {
      await api.post('/cart', null, { params: { product_id: productId, quantity: 1 } });
      toast.success('أُضيف إلى السلة!');
    } catch { toast.error('فشلت الإضافة'); }
    finally { setAdding(null); }
  };

  const addAllToCart = async () => {
    const inStock = items.filter(p => p.stock > 0);
    if (!inStock.length) { toast.error('لا توجد منتجات متوفرة'); return; }
    await Promise.all(inStock.map(p => api.post('/cart', null, { params: { product_id: p.product_id, quantity: 1 } }).catch(() => {})));
    toast.success(`أُضيف ${inStock.length} منتج إلى السلة!`);
  };

  const removeItem = async (productId) => {
    await api.post(`/wishlist/toggle/${productId}`).catch(() => {});
    setItems(prev => prev.filter(p => p.product_id !== productId));
    reload();
  };

  if (loading) return (
    <div className="min-h-screen bg-[#F8F9FA]" style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '16px 24px' }}>
        <div style={{ width: 100, height: 24, background: '#F1F5F9', borderRadius: 8, animation: 'shimmer 1.5s ease-in-out infinite' }} />
      </div>
      <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
            <div style={{ height: 180, background: '#F1F5F9', animation: 'shimmer 1.5s ease-in-out infinite' }} />
            <div style={{ padding: 14 }}>
              <div style={{ height: 14, background: '#F1F5F9', borderRadius: 6, marginBottom: 8, width: '75%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
              <div style={{ height: 18, background: '#EEF2FF', borderRadius: 6, width: '40%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes shimmer{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA]" style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '16px 24px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/shop')}
              style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', fontFamily: 'Tajawal,sans-serif' }}>
              <ArrowRight style={{ width: 15, height: 15 }} />متجر
            </motion.button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Heart style={{ width: 20, height: 20, fill: '#E11D48', color: '#E11D48' }} />
                قائمة المفضلة
              </h1>
              <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>{items.length} منتج محفوظ</p>
            </div>
          </div>
          {items.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={addAllToCart}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg,#4338CA,#7C3AED)', color: '#fff',
                fontFamily: 'Tajawal,sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <ShoppingCart style={{ width: 15, height: 15 }} />
              أضف الكل للسلة
            </motion.button>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        {items.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', padding: '80px 24px' }}>
            <Heart style={{ width: 64, height: 64, color: '#FECDD3', margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>قائمتك فارغة</h2>
            <p style={{ color: '#64748B', marginBottom: 24 }}>تصفّح المنتجات وأضف ما يعجبك للمفضلة</p>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/shop')}
              style={{ padding: '12px 28px', background: 'linear-gradient(135deg,#4338CA,#7C3AED)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Tajawal,sans-serif' }}>
              تصفّح المتجر
            </motion.button>
          </motion.div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
            <AnimatePresence>
              {items.map((product, idx) => (
                <motion.div
                  key={product.product_id}
                  layout
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.88 }}
                  transition={{ delay: idx * 0.05 }}
                  style={{
                    background: '#fff', borderRadius: 16, overflow: 'hidden',
                    border: '1px solid #E2E8F0', position: 'relative',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/product/${product.product_id}`)}
                  whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
                >
                  {/* صورة */}
                  <div style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', background: '#F8FAFC' }}>
                    <img
                      src={product.images?.[0] || PLACEHOLDER}
                      alt={product.name}
                      onError={e => { e.target.src = PLACEHOLDER; }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {product.stock === 0 && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, background: 'rgba(0,0,0,0.5)', padding: '4px 12px', borderRadius: 20 }}>نفذ المخزون</span>
                      </div>
                    )}
                    {/* زر الحذف من المفضلة */}
                    <div style={{ position: 'absolute', top: 8, left: 8 }} onClick={e => { e.stopPropagation(); removeItem(product.product_id); }}>
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        style={{ background: 'rgba(255,255,255,0.9)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #FECDD3' }}>
                        <Trash2 style={{ width: 14, height: 14, color: '#E11D48' }} />
                      </motion.div>
                    </div>
                  </div>

                  {/* تفاصيل */}
                  <div style={{ padding: '12px 14px' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: '0 0 4px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {product.name}
                    </p>
                    {(product.average_rating > 0) && (
                      <div style={{ marginBottom: 6 }}>
                        <StarDisplay value={product.average_rating} count={product.review_count} size={12} />
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#4338CA' }}>
                        {product.price?.toFixed(3)} ر.ع
                      </span>
                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        disabled={product.stock === 0 || adding === product.product_id}
                        onClick={e => { e.stopPropagation(); addToCart(product.product_id); }}
                        style={{
                          padding: '6px 12px', borderRadius: 8, border: 'none',
                          background: product.stock > 0 ? '#4338CA' : '#E2E8F0',
                          color: product.stock > 0 ? '#fff' : '#94A3B8',
                          fontSize: 12, fontWeight: 700, cursor: product.stock > 0 ? 'pointer' : 'not-allowed',
                          fontFamily: 'Tajawal,sans-serif', display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <ShoppingCart style={{ width: 13, height: 13 }} />
                        {adding === product.product_id ? '...' : 'سلة'}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default WishlistPage;
