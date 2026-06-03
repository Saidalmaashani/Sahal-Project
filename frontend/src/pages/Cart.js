import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Trash2, ArrowRight, MapPin, Navigation } from 'lucide-react';
import SupportChat from '../components/SupportChat';

const PLACEHOLDER = 'https://images.pexels.com/photos/17938771/pexels-photo-17938771.jpeg';

const Cart = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markerRef = useRef(null);

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

  const initMap = () => {
    if (!mapRef.current || leafletMap.current || !window.L) return;
    const L = window.L;
    const initLat = deliveryLocation?.lat || 17.0151;
    const initLng = deliveryLocation?.lng || 54.0924;
    
    leafletMap.current = L.map(mapRef.current, {
      tap: false, dragging: true, touchZoom: true, scrollWheelZoom: false
    }).setView([initLat, initLng], 13);
    
    // تحديد موقع المستخدم تلقائياً عند فتح الخريطة
    if (navigator.geolocation && !deliveryLocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          leafletMap.current.setView([lat, lng], 15);
          markerRef.current.setLatLng([lat, lng]);
          await updateLocationInfo(lat, lng);
        },
        () => {}
      );
    }
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(leafletMap.current);

    // علامة قابلة للسحب
    markerRef.current = L.marker([initLat, initLng], {
      draggable: true,
      icon: L.divIcon({
        html: `<div style="background:#4338CA;width:40px;height:40px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
          <div style="transform:rotate(45deg);color:white;font-size:18px">🏠</div>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        className: ''
      })
    }).addTo(leafletMap.current);

    markerRef.current.on('dragend', async (e) => {
      const { lat, lng } = e.target.getLatLng();
      await updateLocationInfo(lat, lng);
    });

    leafletMap.current.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      markerRef.current.setLatLng([lat, lng]);
      await updateLocationInfo(lat, lng);
    });
  };

  const updateLocationInfo = async (lat, lng) => {
    setDeliveryLocation({ lat, lng });
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar`);
      const data = await r.json();
      const address = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setDeliveryAddress(address);
    } catch {
      setDeliveryAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
  };

  const detectMyLocation = () => {
    if (!navigator.geolocation) { toast.error('المتصفح لا يدعم تحديد الموقع'); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (leafletMap.current && markerRef.current) {
          leafletMap.current.setView([lat, lng], 15);
          markerRef.current.setLatLng([lat, lng]);
        }
        await updateLocationInfo(lat, lng);
        toast.success('تم تحديد موقعك!');
      },
      () => toast.error('فشل تحديد الموقع')
    );
  };

  useEffect(() => {
    if (!showMap) return;
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const tryInit = () => {
      if (window.L) { setTimeout(initMap, 200); }
      else if (!document.querySelector('script[src*="leaflet"]')) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => setTimeout(initMap, 200);
        document.head.appendChild(script);
      }
    };
    setTimeout(tryInit, 100);
  }, [showMap]);

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
          price: i.product?.price
        })),
        deliveryAddress,
        deliveryLocation,
        total: calculateTotal()
      }
    });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA]"></div></div>;

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
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
          <Card><CardContent className="py-12 text-center">
            <p className="text-[#475569] mb-4">سلتك فارغة</p>
            <Button className="bg-[#4338CA]" onClick={() => navigate('/shop')}>ابدأ التسوق</Button>
          </CardContent></Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map(item => (
                <Card key={item.cart_item_id}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <img src={item.product?.images?.[0] || PLACEHOLDER} alt={item.product?.name}
                        className="w-24 h-24 object-cover rounded"
                        onError={e => { e.target.src = PLACEHOLDER; }} />
                      <div className="flex-1">
                        <h3 className="font-medium text-lg">{item.product?.name}</h3>
                        <p className="text-sm text-[#475569]">{item.product?.category}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-lg font-bold text-[#4338CA]">
                            {((item.product?.price || 0) * item.quantity).toFixed(3)} ر.ع
                          </span>
                          <Button variant="destructive" size="sm" onClick={() => removeItem(item.cart_item_id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* خريطة تحديد موقع التوصيل */}
              <Card className={`border-2 ${!deliveryLocation ? 'border-[#E11D48]' : 'border-[#10B981]'}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className={`h-5 w-5 ${!deliveryLocation ? 'text-[#E11D48]' : 'text-[#10B981]'}`} />
                    {deliveryLocation ? '✅ تم تحديد موقع التوصيل' : '⚠️ يجب تحديد موقع التوصيل'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!showMap ? (
                    <div className="text-center py-4">
                      <p className="text-[#475569] mb-4 text-sm">حدد موقع منزلك أو مكان التوصيل على الخريطة</p>
                      <div className="flex gap-3 justify-center">
                        <Button className="bg-[#4338CA]" onClick={() => setShowMap(true)}>
                          <MapPin className="h-4 w-4 ml-2" />فتح الخريطة
                        </Button>
                        <Button variant="outline" onClick={() => { setShowMap(true); setTimeout(detectMyLocation, 1000); }}>
                          <Navigation className="h-4 w-4 ml-2" />موقعي الحالي
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex gap-2 mb-3">
                        <Button variant="outline" size="sm" onClick={detectMyLocation}>
                          <Navigation className="h-4 w-4 ml-1" />موقعي
                        </Button>
                        <p className="text-xs text-[#475569] flex-1 flex items-center">اضغط على الخريطة أو اسحب العلامة 🏠</p>
                      </div>
                      <div ref={mapRef} style={{ height: '300px', borderRadius: '10px', border: '1px solid #E2E8F0' }}></div>
                      {deliveryAddress && (
                        <div className="mt-3 p-3 bg-[#F0FDF4] rounded-lg border border-[#10B981]">
                          <p className="text-xs text-[#475569] mb-1">العنوان المحدد:</p>
                          <p className="text-sm font-medium text-[#0F172A]">{deliveryAddress}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader><CardTitle>ملخص الطلب</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm text-[#475569]">
                      <span>المجموع الفرعي</span><span>{calculateTotal().toFixed(3)} ر.ع</span>
                    </div>
                    <div className="flex justify-between text-sm text-[#475569]">
                      <span>الشحن</span><span className="text-[#10B981]">مجاني</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold border-t pt-3">
                      <span>الإجمالي</span>
                      <span className="text-[#4338CA]">{calculateTotal().toFixed(3)} ر.ع</span>
                    </div>
                  </div>
                  {!deliveryLocation && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                      <p className="text-xs text-red-700">⚠️ يجب تحديد موقع التوصيل أولاً</p>
                    </div>
                  )}
                  <Button className="w-full bg-[#F97316] hover:bg-[#EA580C]"
                    onClick={handleCheckout} disabled={checkingOut || !deliveryLocation}>
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