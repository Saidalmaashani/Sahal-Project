import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  ShoppingCart, LogOut, User, Sparkles, Gift, Package,
  Menu, X as XIcon, LayoutDashboard, Store, ArrowLeft, Heart,
} from 'lucide-react';
import SupportChat from '../components/SupportChat';
import SearchAutocomplete from '../components/SearchAutocomplete';
import FilterPanel from '../components/FilterPanel';
import WishlistButton from '../components/WishlistButton';
import ThemeToggle from '../components/ThemeToggle';
import { StarDisplay } from '../components/StarRating';
import { useT } from '../contexts/ThemeContext';

const ProductSkeleton = () => (
  <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
    <div style={{ height: '200px', background: 'linear-gradient(90deg, #F1F5F9 25%, #E8EDF5 50%, #F1F5F9 75%)', backgroundSize: '200% 100%', animation: 'shimmerSlide 1.5s ease-in-out infinite' }} />
    <div style={{ padding: '14px' }}>
      <div style={{ height: '16px', background: '#F1F5F9', borderRadius: '6px', marginBottom: '8px', width: '80%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
      <div style={{ height: '12px', background: '#F1F5F9', borderRadius: '6px', marginBottom: '12px', width: '60%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
      <div style={{ height: '20px', background: '#EEF2FF', borderRadius: '6px', width: '40%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
    </div>
    <style>{`
      @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:.4} }
      @keyframes shimmerSlide { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    `}</style>
  </div>
);
import NotificationBell from '../components/NotificationBell';

const PLACEHOLDER_IMAGE = 'https://images.pexels.com/photos/17938771/pexels-photo-17938771.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';
const handleImageError = (e) => { e.target.src = PLACEHOLDER_IMAGE; };

const CATEGORIES = [
  { value: 'all', label: 'كل الفئات' },
  { value: 'إلكترونيات', label: 'إلكترونيات' },
  { value: 'أزياء وملابس', label: 'أزياء' },
  { value: 'منزل وحديقة', label: 'منزل وحديقة' },
  { value: 'رياضة ولياقة', label: 'رياضة' },
  { value: 'كتب وتعليم', label: 'كتب' },
  { value: 'جمال وعناية', label: 'جمال' },
  { value: 'طعام وشراب', label: 'طعام' },
];

// بطاقة منتج مصغرة
const ProductCard = ({ product, onAddToCart, onClick }) => (
  <Card className="overflow-hidden border border-[#E2E8F0] hover:shadow-md transition-shadow duration-200 cursor-pointer" onClick={onClick}
    style={{ position: 'relative' }}>
    <div className="aspect-square overflow-hidden bg-[#F8F9FA] relative">
      <img
        src={product.images?.[0] || PLACEHOLDER_IMAGE}
        alt={product.name}
        className="w-full h-full object-cover"
        onError={handleImageError}
      />
      <div style={{ position: 'absolute', top: 6, left: 6 }}>
        <WishlistButton productId={product.product_id} size={14} />
      </div>
    </div>
    <CardContent className="p-3">
      <h3 className="font-medium text-sm mb-1 line-clamp-1">{product.name}</h3>
      {product.average_rating > 0 && (
        <div style={{ marginBottom: 4 }}>
          <StarDisplay value={product.average_rating} count={product.review_count} size={11} />
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-base font-bold text-[#4338CA]">ر.ع {product.price.toFixed(2)}</span>
        <Button
          size="sm"
          className="bg-[#F97316] hover:bg-[#EA580C] text-xs h-7 px-2"
          onClick={(e) => { e.stopPropagation(); onAddToCart(product.product_id); }}
          disabled={product.stock === 0}
        >
          {product.stock === 0 ? 'نفذ' : 'إضافة'}
        </Button>
      </div>
    </CardContent>
  </Card>
);

// بطاقة منتج كبيرة
const BigProductCard = ({ product, onAddToCart, onClick }) => (
  <Card className="product-card overflow-hidden border border-[#E2E8F0] hover:shadow-md transition-shadow duration-200">
    <div className="cursor-pointer" onClick={onClick}>
      <div className="aspect-square overflow-hidden bg-[#F8F9FA] relative">
        <img
          src={product.images?.[0] || PLACEHOLDER_IMAGE}
          alt={product.name}
          className="w-full h-full object-cover"
          onError={handleImageError}
        />
        <div style={{ position: 'absolute', top: 8, left: 8 }}>
          <WishlistButton productId={product.product_id} size={16} />
        </div>
      </div>
      <CardContent className="p-4">
        <h3 className="font-medium text-lg mb-1 line-clamp-1">{product.name}</h3>
        {product.average_rating > 0 && (
          <div style={{ marginBottom: 6 }}>
            <StarDisplay value={product.average_rating} count={product.review_count} size={13} />
          </div>
        )}
        <p className="text-sm text-[#475569] mb-2 line-clamp-2">{product.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-[#4338CA]">ر.ع {product.price.toFixed(2)}</span>
          <span className="text-sm text-[#475569]">{product.stock} متوفر</span>
        </div>
      </CardContent>
    </div>
    <div className="px-4 pb-4">
      <Button
        className="w-full bg-[#F97316] hover:bg-[#EA580C]"
        onClick={() => onAddToCart(product.product_id)}
        disabled={product.stock === 0}
      >
        {product.stock === 0 ? 'نفذ من المخزون' : 'أضف إلى السلة'}
      </Button>
    </div>
  </Card>
);

// بطاقة متجر
const StoreCard = ({ store, products, onAddToCart, navigate }) => {
  const storeProducts = products.filter(p => p.store_id === store.store_id).slice(0, 4);

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E2E8F0',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '8px',
    }}>
      {/* رأس المتجر */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {store.logo ? (
            <img src={store.logo} alt={store.name}
              style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover', border: '1px solid #E2E8F0', flexShrink: 0 }}
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }} />
          ) : (
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: 'linear-gradient(135deg,#4338CA,#7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Store style={{ width: '24px', height: '24px', color: '#fff' }} />
            </div>
          )}
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>{store.name}</h3>
            {store.description && (
              <p style={{ fontSize: '13px', color: '#475569' }}>{store.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate(`/store/${store.store_id}`)}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '13px', color: '#4338CA', fontWeight: 600,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px 10px', borderRadius: '8px',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#EEF2FF'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          عرض الكل <ArrowLeft style={{ width: '14px', height: '14px' }} />
        </button>
      </div>

      {/* منتجات المتجر */}
      {storeProducts.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
          {storeProducts.map(product => (
            <ProductCard
              key={product.product_id}
              product={product}
              onAddToCart={onAddToCart}
              onClick={() => navigate(`/product/${product.product_id}`)}
            />
          ))}
        </div>
      ) : (
        <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '14px', padding: '20px 0' }}>
          لا توجد منتجات في هذا المتجر بعد
        </p>
      )}
    </div>
  );
};

const INITIAL_FILTERS = { minPrice: '', maxPrice: '', minRating: 0, sortBy: 'newest' };

const Shop = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [products, setProducts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [activeView, setActiveView] = useState('stores');

  const activeFilterCount = [
    filters.minPrice, filters.maxPrice,
    filters.minRating > 0 ? 1 : null,
    filters.sortBy !== 'newest' ? 1 : null,
  ].filter(Boolean).length;

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (category && category !== 'all') params.category = category;
      if (search) params.search = search;
      if (filters.minPrice) params.min_price = filters.minPrice;
      if (filters.maxPrice) params.max_price = filters.maxPrice;
      if (filters.minRating) params.min_rating = filters.minRating;
      if (filters.sortBy)    params.sort_by = filters.sortBy;
      const response = await api.get('/products', { params });
      setProducts(response.data);
    } catch {
      toast.error('فشل تحميل المنتجات');
    } finally { setLoading(false); }
  }, [category, search, filters]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    fetchStores();
    if (user) fetchRecommendations();
  }, [user]);

  const fetchStores = async () => {
    try { setStores((await api.get('/stores')).data); } catch {}
  };

  const fetchRecommendations = async () => {
    try { setRecommendations((await api.get('/products/recommendations/me')).data.slice(0, 6)); } catch {}
  };

  const handleSearch = () => { setActiveView('all'); fetchProducts(); };

  const addToCart = async (productId) => {
    if (!user) {
      toast.error('يرجى تسجيل الدخول لإضافة منتجات إلى السلة');
      navigate('/login');
      return;
    }
    try {
      await api.post('/cart', null, { params: { product_id: productId, quantity: 1 } });
      toast.success('تمت إضافته إلى السلة!');
    } catch {
      toast.error('فشلت الإضافة');
    }
  };

  const handleLogout = async () => { await logout(); navigate('/'); };

  const t = useT();

  const getDashboardPath = () => {
    if (user?.role === 'admin') return '/admin/dashboard';
    if (user?.role === 'merchant') return '/merchant/dashboard';
    if (user?.role === 'driver') return '/driver/dashboard';
    return '/shop';
  };

  return (
    <div style={{ minHeight: '100vh', background: t.bg2, direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif' }}>

      {/* Header */}
      <header className="header-glass sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
              <div className="h-9 w-9 bg-gradient-to-br from-[#4338CA] to-[#F97316] rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">س</span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-xl font-bold text-[#4338CA]">سهل</span>
                <span className="text-[10px] text-[#475569] tracking-wider">SAHAL</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle size="sm" />
              {user && (
                <>
                  <NotificationBell />
                  <button
                    onClick={() => navigate('/cart')}
                    style={{ padding: '8px', border: `1px solid ${t.border}`, borderRadius: '8px', background: t.card, cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ShoppingCart style={{ width: 20, height: 20, color: '#4338CA' }} />
                  </button>
                </>
              )}

              {user && (
                <div className="hidden sm:flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate('/my-orders')}>
                    <Package className="h-4 w-4 ml-1" />طلباتي
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate('/profile')} className="border-[#4338CA] text-[#4338CA]">
                    <User className="h-4 w-4 ml-1" />حسابي
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate('/referrals')} className="border-[#F97316] text-[#F97316]">
                    <Gift className="h-4 w-4 ml-1" />الإحالات
                  </Button>
                  {user.role !== 'shopper' && (
                    <Button variant="outline" size="sm" onClick={() => navigate(getDashboardPath())}>
                      <LayoutDashboard className="h-4 w-4 ml-1" />لوحة التحكم
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* زر المفضلة في الهيدر */}
              {user && (
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  onClick={() => navigate('/wishlist')}
                  style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff', cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Heart style={{ width: 20, height: 20, color: '#E11D48' }} />
                </motion.button>
              )}

              {user && (
                <div className="relative sm:hidden" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff', cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {menuOpen ? <XIcon style={{ width: 20, height: 20 }} /> : <Menu style={{ width: 20, height: 20 }} />}
                  </button>
                  {menuOpen && (
                    <div style={{ position: 'absolute', top: '110%', left: 0, background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '200px', zIndex: 100, overflow: 'hidden' }}>
                      {[
                        { icon: Package, label: 'طلباتي',    path: '/my-orders' },
                        { icon: Heart,   label: 'مفضلتي',    path: '/wishlist' },
                        { icon: User,    label: 'حسابي',     path: '/profile' },
                        { icon: Gift,    label: 'الإحالات',  path: '/referrals' },
                        ...(user.role !== 'shopper' ? [{ icon: LayoutDashboard, label: 'لوحة التحكم', path: getDashboardPath() }] : []),
                      ].map(({ icon: Icon, label, path }) => (
                        <button key={path} onClick={() => { navigate(path); setMenuOpen(false); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '15px', fontFamily: 'Tajawal,sans-serif', borderBottom: '1px solid #F1F5F9', direction: 'rtl' }}>
                          <Icon style={{ width: 18, height: 18, color: '#4338CA' }} />
                          {label}
                        </button>
                      ))}
                      <button onClick={() => { handleLogout(); setMenuOpen(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '15px', fontFamily: 'Tajawal,sans-serif', color: '#E11D48', direction: 'rtl' }}>
                        <LogOut style={{ width: 18, height: 18 }} />تسجيل الخروج
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!user && (
                <Button className="bg-[#4338CA] hover:bg-[#3730A3]" size="sm" onClick={() => navigate('/login')}>
                  دخول
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* شريط البحث المتقدم */}
      <div style={{ background: t.card, borderBottom: `1px solid ${t.border}`, padding: '16px 0' }}>
        <div className="container mx-auto px-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <SearchAutocomplete
                value={search}
                onChange={setSearch}
                onSearch={handleSearch}
                placeholder="ابحث عن منتج، علامة تجارية..."
              />
            </div>
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); setActiveView('all'); }}
              style={{ padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', fontSize: '14px', fontFamily: 'Tajawal,sans-serif', color: '#475569', cursor: 'pointer', outline: 'none' }}
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <FilterPanel
            filters={filters}
            onChange={(f) => { setFilters(f); setActiveView('all'); }}
            activeCount={activeFilterCount}
          />
        </div>
      </div>

      {/* تبويبات العرض */}
      <div className="bg-white border-b border-[#E2E8F0]">
        <div className="container mx-auto px-4">
          <div className="flex gap-0">
            {[
              { key: 'stores', label: 'المتاجر', icon: Store },
              { key: 'all', label: 'كل المنتجات', icon: Package },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveView(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '14px 20px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: '14px', fontFamily: 'Tajawal,sans-serif', fontWeight: activeView === key ? 700 : 400,
                  color: activeView === key ? '#4338CA' : '#475569',
                  borderBottom: activeView === key ? '2px solid #4338CA' : '2px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <Icon style={{ width: 16, height: 16 }} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">

        {/* === عرض المتاجر === */}
        {activeView === 'stores' && (
          <>
            {/* توصيات الذكاء الاصطناعي */}
            {user && recommendations.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-[#F97316]" />
                  <h2 className="text-xl font-bold">موصى به لك</h2>
                  <span className="text-xs bg-[#FFF7ED] text-[#F97316] px-2 py-0.5 rounded-full border border-[#FED7AA] font-medium">AI</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {recommendations.map(product => (
                    <ProductCard
                      key={product.product_id}
                      product={product}
                      onAddToCart={addToCart}
                      onClick={() => navigate(`/product/${product.product_id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* قائمة المتاجر */}
            <div className="flex items-center gap-2 mb-4">
              <Store className="h-5 w-5 text-[#4338CA]" />
              <h2 className="text-xl font-bold">المتاجر</h2>
              <span className="text-sm text-[#475569]">({stores.length} متجر)</span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-4">
                {[1,2,3].map(i => <ProductSkeleton key={i} />)}
              </div>
            ) : stores.length === 0 ? (
              <div className="text-center py-16">
                <Store className="h-16 w-16 text-[#CBD5E1] mx-auto mb-4" />
                <p className="text-[#475569] text-lg">لا توجد متاجر معتمدة بعد</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stores.map(store => (
                  <StoreCard
                    key={store.store_id}
                    store={store}
                    products={products}
                    onAddToCart={addToCart}
                    navigate={navigate}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* === عرض كل المنتجات === */}
        {activeView === 'all' && (
          <>
            <div className="flex items-center gap-2 mb-6">
              <Package className="h-5 w-5 text-[#4338CA]" />
              <h2 className="text-2xl font-bold">
                {category !== 'all' ? CATEGORIES.find(c => c.value === category)?.label : 'جميع المنتجات'}
              </h2>
              {!loading && (
                <span className="text-sm text-[#475569]">({products.length} منتج)</span>
              )}
            </div>

            {loading ? (
              <div className="bento-grid">
                {[1,2,3,4,5,6].map(i => <ProductSkeleton key={i} />)}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#475569] text-lg">لم يتم العثور على منتجات</p>
              </div>
            ) : (
              <div className="bento-grid">
                {products.map(product => (
                  <BigProductCard
                    key={product.product_id}
                    product={product}
                    onAddToCart={addToCart}
                    onClick={() => navigate(`/product/${product.product_id}`)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <SupportChat />
    </div>
  );
};

export default Shop;
