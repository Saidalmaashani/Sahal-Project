import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Trash2, ArrowRight, MapPin, Navigation, Home, Briefcase, Building2 } from 'lucide-react';
import SupportChat from '../components/SupportChat';
import MapPicker from '../components/MapPicker';

const PLACEHOLDER = 'https://images.pexels.com/photos/17938771/pexels-photo-17938771.jpeg';

const LOCATION_TYPES = [
  { id: 'home', icon: Home, label: 'المنزل' },
  { id: 'work', icon: Briefcase, label: 'العمل' },
  { id: 'other', icon: Building2, label: 'مكان آخر' },
];

const Cart = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationType, setLocationType] = useState('home');
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchCart();
  }, [user]);

  const fetchCart = async () => {
    try {
      const r = await api.get('/cart');
      setCartItems(r.data);
    } catch { toast.error('فشل تحميل السلة'); }
    finally { setLoading(false); }
  };

  const reverseGeocode = async (lat, lng) => {
    setGeocoding(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar`,
        { headers: { 'Accept-Language': 'ar' } }
      );
      const data = await r.json();
      setDeliveryAddress(data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } catch {
      setDeliveryAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } finally {
      setGeocoding(false);
    }
  };

  const handleMapChange = async (lat, lng) => {
    setDeliveryLocation({ lat, lng });
    await reverseGeocode(lat, lng);
  };

  const detectMyLocation = () => {
    if (!navigator.geolocation) { toast.error('المتصفح لا يدعم تحديد الموقع'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setShowMap(true);
        setDeliveryLocation({ lat, lng });
        await reverseGeocode(lat, lng);
        setLocating(false);
        toast.success('تم تحديد موقعك!');
      },
      () => { toast.error('فشل تحديد الموقع'); setLocating(false); }
    );
  };

  const removeItem = async (id) => {
    try {
      await api.delete(`/cart/${id}`);
      setCartItems(cartItems.filter(i => i.cart_item_id !== id));
      toast.success('تمت الإزالة');
    } catch { toast.error('فشلت الإزالة'); }
  };

  const calculateTotal = () => cartItems.reduce((s, i) => s + (i.product?.price || 0) * i.quantity, 0);

  const handleCheckout = async () => {
    if (!deliveryLocation) {
      toast.error('يجب تحديد موقع التوصيل على الخريطة أولاً');
      setShowMap(true);
      return;
    }
    if (cartItems.length === 0) { toast.error('سلتك فارغة'); return; }
    setCheckingOut(true);
    navigate('/payment', {
      state: {
        items: cartItems.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          name: i.product?.name,
          price: i.product?.price,
        })),
        deliveryAddress,
        deliveryLocation,
        total: calculateTotal(),
      }
    });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA]"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA]" style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif' }}>
      <header className="bg-white border-b border-[#E2E8F0] py-4">
        <div className="container mx-auto px-4">
          <Button variant="ghost" onClick={() => navigate('/shop')}>
            <ArrowRight className="h-4 w-4 ml-2" />متابعة التسوق
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">عربة التسوق</h1>

        {cartItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-[#475569] mb-4">سلتك فارغة</p>
              <Button className="bg-[#4338CA]" onClick={() => navigate('/shop')}>ابدأ التسوق</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">

              {/* قائمة المنتجات */}
              {cartItems.map(item => (
                <Card key={item.cart_item_id}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <img
                        src={item.product?.images?.[0] || PLACEHOLDER}
                        alt={item.product?.name}
                        className="w-24 h-24 object-cover rounded-lg"
                        onError={e => { e.target.src = PLACEHOLDER; }}
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{item.product?.name}</h3>
                        <p className="text-sm text-[#475569]">{item.product?.category}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-lg font-bold text-[#4338CA]">
                            {((item.product?.price || 0) * item.quantity).toFixed(3)} ر.ع
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-[#475569]">× {item.quantity}</span>
                            <Button variant="destructive" size="sm" onClick={() => removeItem(item.cart_item_id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* قسم تحديد موقع التوصيل */}
              <Card className={`border-2 ${!deliveryLocation ? 'border-[#E11D48]' : 'border-[#10B981]'}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className={`h-5 w-5 ${!deliveryLocation ? 'text-[#E11D48]' : 'text-[#10B981]'}`} />
                    {deliveryLocation ? '✅ تم تحديد موقع التوصيل' : '⚠️ حدّد موقع التوصيل (مطلوب)'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">

                  {/* نوع الموقع */}
                  <div className="flex gap-2">
                    {LOCATION_TYPES.map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        onClick={() => setLocationType(id)}
                        style={{
                          flex: 1,
                          padding: '10px 6px',
                          border: `2px solid ${locationType === id ? '#4338CA' : '#E2E8F0'}`,
                          borderRadius: '10px',
                          background: locationType === id ? '#EEF2FF' : '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.2s',
                        }}
                      >
                        <Icon style={{ width: 20, height: 20, color: locationType === id ? '#4338CA' : '#94A3B8' }} />
                        <span style={{ fontSize: '12px', fontWeight: locationType === id ? 600 : 400, color: locationType === id ? '#4338CA' : '#475569' }}>
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* أزرار التحديد */}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-[#4338CA] hover:bg-[#3730A3]"
                      onClick={() => setShowMap(true)}
                    >
                      <MapPin className="h-4 w-4 ml-2" />
                      {showMap ? 'الخريطة مفتوحة' : 'فتح الخريطة'}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={detectMyLocation}
                      disabled={locating}
                    >
                      <Navigation className="h-4 w-4 ml-2" />
                      {locating ? 'جارٍ التحديد...' : 'موقعي الحالي'}
                    </Button>
                  </div>

                  {/* الخريطة */}
                  {showMap && (
                    <div>
                      <p className="text-xs text-[#475569] mb-2 text-center">
                        اضغط على الخريطة أو اسحب العلامة 🏠 لتحديد موقع التوصيل بدقة
                      </p>
                      <MapPicker
                        position={deliveryLocation}
                        onChange={handleMapChange}
                        iconType="home"
                        height="280px"
                      />
                    </div>
                  )}

                  {/* العنوان المحدد */}
                  {deliveryAddress && (
                    <div className="p-3 bg-[#F0FDF4] rounded-lg border border-[#86EFAC]">
                      <p className="text-xs text-[#475569] mb-1">
                        {LOCATION_TYPES.find(t => t.id === locationType)?.label || 'الموقع المحدد'}:
                      </p>
                      <p className="text-sm font-medium text-[#0F172A]">
                        {geocoding ? 'جارٍ تحديد العنوان...' : deliveryAddress}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ملخص الطلب */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader><CardTitle>ملخص الطلب</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-[#475569]">
                      <span>المجموع الفرعي</span>
                      <span>{calculateTotal().toFixed(3)} ر.ع</span>
                    </div>
                    <div className="flex justify-between text-sm text-[#475569]">
                      <span>الشحن</span>
                      <span className="text-[#10B981]">مجاني</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold border-t pt-3">
                      <span>الإجمالي</span>
                      <span className="text-[#4338CA]">{calculateTotal().toFixed(3)} ر.ع</span>
                    </div>
                  </div>

                  {!deliveryLocation && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                      <p className="text-xs text-red-700">⚠️ يجب تحديد موقع التوصيل على الخريطة أولاً</p>
                    </div>
                  )}

                  <Button
                    className="w-full bg-[#F97316] hover:bg-[#EA580C]"
                    onClick={handleCheckout}
                    disabled={checkingOut || !deliveryLocation}
                  >
                    {!deliveryLocation ? 'حدد موقع التوصيل أولاً' : checkingOut ? 'جارٍ المعالجة...' : 'إتمام الشراء'}
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
