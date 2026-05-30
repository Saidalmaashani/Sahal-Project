import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';
import {
  ArrowRight, ShoppingCart, Store, Package,
  Tag, Layers, Weight, CheckCircle, AlertCircle,
  Minus, Plus, Share2
} from 'lucide-react';
import SupportChat from '../components/SupportChat';

const PLACEHOLDER = 'https://images.pexels.com/photos/17938771/pexels-photo-17938771.jpeg';

const ProductDetail = () => {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const [product, setProduct]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [selectedImg, setSelectedImg] = useState(0);
  const [quantity, setQuantity]     = useState(1);
  const [adding, setAdding]         = useState(false);
  const [store, setStore]           = useState(null);

  useEffect(() => { fetchProduct(); }, [id]);

  const fetchProduct = async () => {
    try {
      const r = await api.get(`/products/${id}`);
      setProduct(r.data);
      // جلب بيانات المتجر
      if (r.data.store_id) {
        try {
          const stores = await api.get('/stores');
          const found = stores.data.find(s => s.store_id === r.data.store_id);
          if (found) setStore(found);
        } catch {}
      }
    } catch {
      toast.error('المنتج غير موجود');
      navigate('/shop');
    } finally { setLoading(false); }
  };

  const addToCart = async () => {
    if (!user) { toast.error('سجّل دخول أولاً'); navigate('/login'); return; }
    if (product.stock === 0) return;
    setAdding(true);
    try {
      await api.post('/cart', null, { params: { product_id: product.product_id, quantity } });
      toast.success(`تمت إضافة ${quantity} قطعة للسلة!`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'فشلت الإضافة');
    } finally { setAdding(false); }
  };

  const share = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('تم نسخ رابط المنتج!');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA]"></div>
    </div>
  );

  if (!product) return null;

  const images  = product.images?.length ? product.images : [PLACEHOLDER];
  const inStock = product.stock > 0;
  const merchantPrice = product.merchant_price ?? product.price;

  return (
    <div className="min-h-screen bg-[#F8F9FA]" style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif' }}>

      {/* Header */}
      <header className="bg-white border-b border-[#E2E8F0] py-3 sticky top-0 z-40">
        <div className="container mx-auto px-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/shop')}>
            <ArrowRight className="h-4 w-4 ml-1" />العودة للمتجر
          </Button>
          <span className="text-[#94A3B8]">/</span>
          <span className="text-sm text-[#475569] truncate max-w-[200px]">{product.category}</span>
          <span className="text-[#94A3B8]">/</span>
          <span className="text-sm font-medium truncate max-w-[250px]">{product.name}</span>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-10">

          {/* ===== قسم الصور ===== */}
          <div className="space-y-3">
            {/* الصورة الرئيسية */}
            <div style={{
              background: '#fff', borderRadius: '16px', overflow: 'hidden',
              border: '1px solid #E2E8F0', aspectRatio: '1',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <img
                src={images[selectedImg]}
                alt={product.name}
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '16px' }}
                onError={e => { e.target.src = PLACEHOLDER; }}
              />
            </div>

            {/* الصور المصغرة */}
            {images.length > 1 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {images.map((img, i) => (
                  <button key={i} onClick={() => setSelectedImg(i)}
                    style={{
                      width: '72px', height: '72px', borderRadius: '10px', overflow: 'hidden',
                      border: selectedImg === i ? '2px solid #4338CA' : '1px solid #E2E8F0',
                      cursor: 'pointer', background: '#fff', padding: '4px',
                      transition: 'border-color 0.2s'
                    }}>
                    <img src={img} alt={`صورة ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      onError={e => { e.target.src = PLACEHOLDER; }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ===== قسم التفاصيل ===== */}
          <div className="space-y-5">

            {/* الفئة والاسم */}
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#4338CA', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {product.category}
              </span>
              <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0F172A', marginTop: '6px', lineHeight: 1.3 }}>
                {product.name}
              </h1>
              {product.brand && (
                <p style={{ fontSize: '14px', color: '#475569', marginTop: '4px' }}>
                  العلامة التجارية: <strong>{product.brand}</strong>
                </p>
              )}
            </div>

            {/* السعر */}
            <div style={{ background: '#F0F4FF', borderRadius: '12px', padding: '16px' }}>
              <p style={{ fontSize: '32px', fontWeight: 800, color: '#4338CA' }}>
                ر.ع {product.price.toFixed(3)}
              </p>
              <p style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                شامل رسوم التوصيل والمنصة
              </p>
            </div>

            {/* حالة المخزون */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {inStock ? (
                <>
                  <CheckCircle style={{ width: '18px', height: '18px', color: '#10B981' }} />
                  <span style={{ color: '#10B981', fontWeight: 600, fontSize: '14px' }}>
                    متوفر — {product.stock} قطعة في المخزون
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle style={{ width: '18px', height: '18px', color: '#E11D48' }} />
                  <span style={{ color: '#E11D48', fontWeight: 600, fontSize: '14px' }}>نفذ من المخزون</span>
                </>
              )}
            </div>

            {/* الكمية وزر الإضافة */}
            {inStock && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {/* اختيار الكمية */}
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    style={{ padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: '18px' }}>
                    <Minus style={{ width: '16px', height: '16px' }} />
                  </button>
                  <span style={{ padding: '10px 18px', fontWeight: 700, fontSize: '16px', minWidth: '50px', textAlign: 'center' }}>
                    {quantity}
                  </span>
                  <button onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
                    style={{ padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: '18px' }}>
                    <Plus style={{ width: '16px', height: '16px' }} />
                  </button>
                </div>

                <Button
                  className="flex-1 bg-[#F97316] hover:bg-[#EA580C] text-white"
                  style={{ padding: '12px', fontSize: '15px', fontWeight: 700, borderRadius: '10px', height: '46px' }}
                  onClick={addToCart} disabled={adding}
                >
                  <ShoppingCart className="h-5 w-5 ml-2" />
                  {adding ? 'جارٍ الإضافة...' : 'أضف إلى السلة'}
                </Button>

                <button onClick={share} style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Share2 style={{ width: '18px', height: '18px', color: '#475569' }} />
                </button>
              </div>
            )}

            {/* الإجمالي */}
            {inStock && quantity > 1 && (
              <p style={{ fontSize: '14px', color: '#475569', textAlign: 'left' }}>
                الإجمالي: <strong style={{ color: '#4338CA', fontSize: '16px' }}>ر.ع {(product.price * quantity).toFixed(3)}</strong>
              </p>
            )}

            {/* معلومات المنتج */}
            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <h3 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '10px' }}>تفاصيل المنتج</h3>
              <p style={{ color: '#475569', fontSize: '14px', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                {product.description}
              </p>
            </div>

            {/* المواصفات */}
            {(product.sku || product.weight || product.brand) && (
              <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '16px' }}>
                <h3 style={{ fontWeight: 700, fontSize: '14px', marginBottom: '10px', color: '#0F172A' }}>المواصفات</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {product.brand && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Tag style={{ width: '12px', height: '12px' }} />العلامة التجارية
                      </span>
                      <span style={{ fontWeight: 600 }}>{product.brand}</span>
                    </div>
                  )}
                  {product.sku && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Layers style={{ width: '12px', height: '12px' }} />رمز المنتج (SKU)
                      </span>
                      <span style={{ fontWeight: 600, direction: 'ltr' }}>{product.sku}</span>
                    </div>
                  )}
                  {product.weight && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Weight style={{ width: '12px', height: '12px' }} />الوزن
                      </span>
                      <span style={{ fontWeight: 600 }}>{product.weight} كجم</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Package style={{ width: '12px', height: '12px' }} />الكمية المتاحة
                    </span>
                    <span style={{ fontWeight: 600 }}>{product.stock} قطعة</span>
                  </div>
                </div>
              </div>
            )}

            {/* بطاقة المتجر */}
            {store && (
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'linear-gradient(135deg,#4338CA,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Store style={{ width: '22px', height: '22px', color: '#fff' }} />
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '2px' }}>يُباع بواسطة</p>
                  <p style={{ fontWeight: 700, fontSize: '15px', color: '#0F172A' }}>{store.name}</p>
                  {store.description && <p style={{ fontSize: '12px', color: '#475569' }}>{store.description}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <SupportChat />
    </div>
  );
};

export default ProductDetail;
