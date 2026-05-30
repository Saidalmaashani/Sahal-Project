import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { ShoppingCart, Search, LogOut, User, Sparkles, Gift, Package } from 'lucide-react';

import SupportChat from '../components/SupportChat';

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

  useEffect(() => {
    fetchProducts();
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
      <header className="header-glass sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2 space-x-reverse cursor-pointer" onClick={() => navigate('/')}>
              <div className="h-10 w-10 bg-gradient-to-br from-[#4338CA] to-[#F97316] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">س</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold tracking-tighter text-[#4338CA] leading-none">سهل</span>
                <span className="text-xs text-[#475569] tracking-wider">SAHAL</span>
              </div>
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              {user && (
                <>
                  <Button variant="outline" size="sm" onClick={() => navigate('/cart')}>
                    <ShoppingCart className="h-4 w-4 ml-2" />السلة
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate('/my-orders')}>
                    <Package className="h-4 w-4 ml-2" />طلباتي
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate('/profile')}
                    className="border-[#4338CA] text-[#4338CA] hover:bg-[#4338CA] hover:text-white">
                    <User className="h-4 w-4 ml-2" />حسابي
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate('/referrals')}
                    className="border-[#F97316] text-[#F97316] hover:bg-[#F97316] hover:text-white">
                    <Gift className="h-4 w-4 ml-2" />الإحالات
                  </Button>
                  {user.role !== 'shopper' && (
                    <Button variant="outline" size="sm" onClick={() => {
                      if (user.role === 'admin') navigate('/admin/dashboard');
                      else if (user.role === 'merchant') navigate('/merchant/dashboard');
                      else if (user.role === 'driver') navigate('/driver/dashboard');
                    }}>
                      <User className="h-4 w-4 ml-2" />لوحة التحكم
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 ml-2" />خروج
                  </Button>
                </>
              )}
              {!user && (
                <Button className="bg-[#4338CA] hover:bg-[#3730A3]" size="sm" onClick={() => navigate('/login')}>
                  تسجيل الدخول
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
