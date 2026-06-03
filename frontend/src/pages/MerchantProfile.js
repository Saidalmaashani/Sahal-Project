import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { MapPin, Save, Navigation, AlertCircle } from 'lucide-react';
import MapPicker from '../components/MapPicker';

const MerchantProfile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'merchant') { navigate('/shop'); return; }
    api.get('/merchants/profile').then(r => {
      if (r.data.lat && r.data.lng) {
        setLocation({ lat: r.data.lat, lng: r.data.lng });
        reverseGeocode(r.data.lat, r.data.lng);
      }
    }).catch(() => {});
  }, [user, navigate]);

  const reverseGeocode = async (lat, lng) => {
    setGeocoding(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar`
      );
      const data = await r.json();
      setAddress(data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } catch {
      setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } finally {
      setGeocoding(false);
    }
  };

  const handleMapChange = async (lat, lng) => {
    setLocation({ lat, lng });
    await reverseGeocode(lat, lng);
  };

  const detectLocation = () => {
    if (!navigator.geolocation) { toast.error('المتصفح لا يدعم تحديد الموقع'); return; }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ lat, lng });
        await reverseGeocode(lat, lng);
        setDetecting(false);
        toast.success('تم تحديد موقعك!');
      },
      () => { toast.error('فشل تحديد الموقع'); setDetecting(false); }
    );
  };

  const saveLocation = async () => {
    if (!location) { toast.error('حدد موقع متجرك على الخريطة أولاً'); return; }
    setLoading(true);
    try {
      await api.patch('/merchants/profile', {
        lat: parseFloat(location.lat),
        lng: parseFloat(location.lng),
      });
      toast.success('تم حفظ موقع المتجر!');
      navigate('/merchant/dashboard');
    } catch { toast.error('فشل الحفظ'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]" style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif' }}>
      <header className="bg-white border-b border-[#E2E8F0] py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">موقع المتجر</h1>
            <p className="text-sm text-[#475569]">يستخدمه المندوبون لاستلام الطلبات منك</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/merchant/dashboard')}>
            العودة للوحة التحكم
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">

        {/* تنبيه الأهمية */}
        {!location && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 items-start">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 mb-1">موقع المتجر مطلوب</p>
              <p className="text-sm text-amber-700">
                يجب تحديد موقع متجرك لكي يتمكن المندوبون من استلام الطلبات وتوصيلها للعملاء.
                لا يمكنك إضافة منتجات بدون تحديد الموقع.
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#F97316]" />
              حدد موقع متجرك
            </CardTitle>
            <p className="text-sm text-[#475569]">
              اضغط على الخريطة أو اسحب العلامة 🏪 لتحديد الموقع بدقة
            </p>
          </CardHeader>
          <CardContent className="space-y-4">

            <Button
              variant="outline"
              onClick={detectLocation}
              disabled={detecting}
              className="w-full"
            >
              <Navigation className="h-4 w-4 ml-2" />
              {detecting ? 'جارٍ التحديد...' : 'تحديد موقعي الحالي تلقائياً'}
            </Button>

            <MapPicker
              position={location}
              onChange={handleMapChange}
              iconType="store"
              height="380px"
            />

            {/* العنوان */}
            {address && (
              <div className="p-3 bg-[#FFF7ED] rounded-lg border border-[#FED7AA]">
                <p className="text-xs text-[#92400E] mb-1">الموقع المحدد:</p>
                <p className="text-sm font-medium text-[#0F172A]">
                  {geocoding ? 'جارٍ تحديد العنوان...' : address}
                </p>
                {location && (
                  <p className="text-xs text-[#94A3B8] mt-1" dir="ltr">
                    {parseFloat(location.lat).toFixed(6)}, {parseFloat(location.lng).toFixed(6)}
                  </p>
                )}
              </div>
            )}

            <Button
              className="w-full bg-[#4338CA] hover:bg-[#3730A3]"
              onClick={saveLocation}
              disabled={loading || !location}
            >
              <Save className="h-4 w-4 ml-2" />
              {loading ? 'جارٍ الحفظ...' : 'حفظ موقع المتجر'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MerchantProfile;
