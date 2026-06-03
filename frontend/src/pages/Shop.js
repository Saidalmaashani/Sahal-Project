import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { ShoppingCart, Search, LogOut, User, Sparkles, Gift, Package, Menu, X as XIcon, LayoutDashboard } from 'lucide-react';

import SupportChat from '../components/SupportChat';
import NotificationBell from '../components/NotificationBell';

const PLACEHOLDER_IMAGE = 'https://images.pexels.com/photos/17938771/pexels-photo-17938771.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';
const handleImageError = (e) => { e.target.src = PLACEHOLDER_IMAGE; };

const Shop = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [products, setProducts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    fetchProducts();
    fetchStores();
    if (user) fetchRecommendations();
  }, [category, user]);

  const fetchProducts = async () => {
    try {
      const params = {};
      if (category && category !== 'all') params.category = category;
      if (search) params.search = search;
      const response = await api.get('/products', { params });
      setProducts(response.data);
    } catch (error) {
      toast.error('فشل تحميل المنتجات');
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const response = await api.get("/stores");
      setStores(response.data.slice(0, 6));
    } catch {}
  };

  const fetchRecommendations = async () => {
    try {
      const response = await api.get('/products/recommendations/me');
      setRecommendations(response.data.slice(0, 4));
    } catch (error) {}
  };

  const handleSearch = (e) => { e.preventDefault(); fetchProducts(); };

  const addToCart = async (productId) => {
    if (!user) {
      toast.error('يرجى تسجيل الدخول لإضافة منتجات إلى السلة');
      navigate('/login');
      return;
    }
    try {
      await api.post('/cart', null, { params: { product_id: productId, quantity: 1 } });
      toast.success('تمت إضافته إلى السلة!');
    } catch (error) {
      toast.error('فشلت الإضافة');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const getDashboardPath = () => {
    if (user?.role === 'admin') return '/admin/dashboard';
    if (user?.role === 'merchant') return '/merchant/dashboard';
    if (user?.role === 'driver') return '/driver/dashboard';
    return '/shop';
  };

  const renderProductCard = (product) => (
    <Card key={product.product_id} className="product-card overflow-hidden border border-[#E2E8F0]">
      <div className="cursor-pointer" onClick={() => navigate(`/product/${product.product_id}`)}>
        <div className="aspect-square overflow-hidden bg-[#F8F9FA]">
          <img src={product.images?.[0] || PLACEHOLDER_IMAGE} alt={product.name}
            className="w-full h-full object-cover" onError={handleImageError} />
        </div>
        <CardContent className="p-4">
          <h3 className="font-medium text-lg mb-1 line-clamp-1">{product.name}</h3>
          <p className="text-sm text-[#475569] mb-2 line-clamp-2">{product.description}</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-[#4338CA]">ر.ع {product.price.toFixed(2)}</span>
            <span className="text-sm text-[#475569]">{product.stock} متوفر</span>
          </div>
        </CardContent>
      </div>
      <div className="px-4 pb-4">
        <Button className="w-full bg-[#F97316] hover:bg-[#EA580C]"
          onClick={() => addToCart(product.product_id)} disabled={product.stock === 0}>
          {product.stock === 0 ? 'نفذ من المخزون' : 'أضف إلى السلة'}
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="header-glass sticky top-0 z-50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            {/* Logo */}
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
              {/* أيقونات سريعة — تظهر دائماً */}
              {user && (
                <>
                  <NotificationBell />
                  <button onClick={() => navigate('/cart')}
                    style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff', cursor: 'pointer', position: 'relative', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShoppingCart style={{ width: 20, height: 20, color: '#4338CA' }} />
                  </button>
                </>
              )}

              {/* قائمة desktop */}
              {user && (
                <div className="hidden sm:flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate('/my-orders')}>
                    <Package className="h-4 w-4 ml-1" />طلباتي
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate('/profile')}
                    className="border-[#4338CA] text-[#4338CA]">
                    <User className="h-4 w-4 ml-1" />حسابي
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate('/referrals')}
                    className="border-[#F97316] text-[#F97316]">
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

              {/* زر القائمة للموبايل */}
              {user && (
                <div className="relative sm:hidden" ref={menuRef}>
                  <button onClick={() => setMenuOpen(!menuOpen)}
                    style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff', cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {menuOpen ? <XIcon style={{ width: 20, height: 20 }} /> : <Menu style={{ width: 20, height: 20 }} />}
                  </button>

                  {/* Dropdown Menu */}
                  {menuOpen && (
                    <div style={{ position: 'absolute', top: '110%', left: 0, background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '200px', zIndex: 100, overflow: 'hidden' }}>
                      {[
                        { icon: Package, label: 'طلباتي', path: '/my-orders' },
                        { icon: User, label: 'حسابي', path: '/profile' },
                        { icon: Gift, label: 'الإحالات', path: '/referrals' },
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
                        <LogOut style={{ width: 18, height: 18 }} />
                        تسجيل الخروج
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

      <div className="bg-white border-b border-[#E2E8F0] py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <Input placeholder="ابحث عن المنتجات..." value={search}
                onChange={(e) => setSearch(e.target.value)} className="flex-1" />
              <Button type="submit" className="bg-[#4338CA] hover:bg-[#3730A3]">
                <Search className="h-4 w-4 ml-2" />بحث
              </Button>
            </form>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full md:w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفئات</SelectItem>
                <SelectItem value="إلكترونيات">إلكترونيات</SelectItem>
                <SelectItem value="أزياء">أزياء</SelectItem>
                <SelectItem value="منزل">منزل وحديقة</SelectItem>
                <SelectItem value="رياضة">رياضة</SelectItem>
                <SelectItem value="كتب">كتب</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {user && recommendations.length > 0 && (
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-[#F97316]" />
            <h2 className="text-xl font-bold">موصى به لك بالذكاء الاصطناعي</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {recommendations.map(renderProductCard)}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6">جميع المنتجات</h2>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA] mx-auto"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#475569] text-lg">لم يتم العثور على منتجات</p>
          </div>
        ) : (
          <div className="bento-grid">{products.map(renderProductCard)}</div>
        )}
      </div>

      <SupportChat />
    </div>
  );
};

export default Shop;
