import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Trash2, ArrowRight } from 'lucide-react';
import SupportChat from '../components/SupportChat';

const PLACEHOLDER_IMAGE = 'https://images.pexels.com/photos/17938771/pexels-photo-17938771.jpeg';

const Cart = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchCart();
  }, [user, navigate]);

  const fetchCart = async () => {
    try {
      const response = await api.get('/cart');
      setCartItems(response.data);
      if (user?.address) setDeliveryAddress(user.address);
    } catch { toast.error('فشل تحميل السلة'); }
    finally { setLoading(false); }
  };

  const removeItem = async (cartItemId) => {
    try {
      await api.delete(`/cart/${cartItemId}`);
      setCartItems(cartItems.filter(item => item.cart_item_id !== cartItemId));
      toast.success('تمت إزالته');
    } catch { toast.error('فشلت الإزالة'); }
  };

  const calculateTotal = () => cartItems.reduce((sum, item) =>
    sum + (item.product?.price || 0) * item.quantity, 0);

  const handleCheckout = async () => {
    if (!deliveryAddress.trim()) { toast.error('أدخل عنوان التوصيل'); return; }
    if (cartItems.length === 0) { toast.error('سلتك فارغة'); return; }
    setCheckingOut(true);
    try {
      const items = cartItems.map(item => ({ product_id: item.product_id, quantity: item.quantity }));
      const response = await api.post('/checkout', { items, delivery_address: deliveryAddress });
      window.location.href = response.data.checkout_url;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل الدفع');
      setCheckingOut(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA]"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-white border-b border-[#E2E8F0] py-4">
        <div className="container mx-auto px-4">
          <Button variant="ghost" onClick={() => navigate('/shop')}>
            <ArrowRight className="h-4 w-4 ml-2" />متابعة التسوق
          </Button>
        </div>
      </header>
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold tracking-tight mb-8">عربة التسوق</h1>
        {cartItems.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <p className="text-[#475569] text-lg mb-4">سلتك فارغة</p>
            <Button className="bg-[#4338CA] hover:bg-[#3730A3]" onClick={() => navigate('/shop')}>
              ابدأ التسوق
            </Button>
          </CardContent></Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <Card key={item.cart_item_id}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <img src={item.product?.images?.[0] || PLACEHOLDER_IMAGE} alt={item.product?.name}
                        className="w-24 h-24 object-cover rounded"
                        onError={(e) => { e.target.src = PLACEHOLDER_IMAGE; }} />
                      <div className="flex-1">
                        <h3 className="font-medium text-lg">{item.product?.name}</h3>
                        <p className="text-sm text-[#475569] mb-2">{item.product?.category}</p>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-lg font-bold text-[#4338CA]">
                              ${((item.product?.price || 0) * item.quantity).toFixed(2)}
                            </span>
                            <span className="text-sm text-[#475569] mr-2">
                              (${item.product?.price.toFixed(2)} × {item.quantity})
                            </span>
                          </div>
                          <Button variant="destructive" size="sm" onClick={() => removeItem(item.cart_item_id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader><CardTitle>ملخص الطلب</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="addr">عنوان التوصيل</Label>
                    <Input id="addr" placeholder="أدخل عنوان التوصيل" value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)} />
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-[#475569]">المجموع الفرعي</span>
                      <span className="font-medium">${calculateTotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mb-4">
                      <span className="text-[#475569]">الشحن</span>
                      <span className="font-medium">$0.00</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold border-t pt-4">
                      <span>المجموع الكلي</span>
                      <span className="text-[#4338CA]">${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                  <Button className="w-full bg-[#F97316] hover:bg-[#EA580C]"
                    onClick={handleCheckout} disabled={checkingOut || cartItems.length === 0}>
                    {checkingOut ? 'جارٍ المعالجة...' : 'إتمام الشراء'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
      <SupportChat />
    </div>
  );
};

export default Cart;
