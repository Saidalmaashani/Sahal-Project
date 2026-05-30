import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Truck, Package, ArrowRight, Navigation, MapPin } from 'lucide-react';
import SupportChat from '../components/SupportChat';

const getStatusArabic = (s) => ({
  pending: 'قيد الانتظار', confirmed: 'مؤكد', shipped: 'تم الشحن',
  delivered: 'تم التوصيل', cancelled: 'ملغى', paid: 'مدفوع'
}[s] || s);

const getDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
};

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, loading: authLoading } = useAuth();
  const [driverProfile, setDriverProfile] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [myLocation, setMyLocation] = useState(null);
  const [form, setForm] = useState({ vehicle_type: '', vehicle_number: '', license_number: '' });
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'driver') { navigate('/shop'); return; }
    fetchData();
  }, [user, navigate, authLoading]);

  // تحميل Leaflet ديناميكياً
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      const L = window.L;
      leafletMap.current = L.map(mapRef.current).setView([23.5, 57.5], 7);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(leafletMap.current);
    };
    document.head.appendChild(script);
  }, [driverProfile]);

  // تحديث الخريطة عند تغيير الطلبات أو الموقع
  useEffect(() => {
    if (!leafletMap.current || !window.L) return;
    const L = window.L;
    
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (myLocation) {
      const driverMarker = L.circleMarker([myLocation.lat, myLocation.lng], {
        radius: 10, color: '#4338CA', fillColor: '#4338CA', fillOpacity: 1
      }).addTo(leafletMap.current).bindPopup('موقعي الحالي');
      markersRef.current.push(driverMarker);
      leafletMap.current.setView([myLocation.lat, myLocation.lng], 11);
    }

    deliveries.forEach(d => {
      if (d.merchant_lat && d.merchant_lng) {
        const dist = myLocation ? getDistance(myLocation.lat, myLocation.lng, d.merchant_lat, d.merchant_lng) : '?';
        const marker = L.marker([d.merchant_lat, d.merchant_lng], {
          icon: L.divIcon({
            html: `<div style="background:#F97316;color:white;padding:4px 8px;border-radius:6px;font-size:12px;white-space:nowrap;font-family:Tajawal,sans-serif">${dist} كم</div>`,
            className: '', iconAnchor: [30, 10]
          })
        }).addTo(leafletMap.current).bindPopup(`
          <div style="direction:rtl;font-family:Tajawal,sans-serif">
            <b>موقع التاجر</b><br/>
            الطلب: ${d.order_id}<br/>
            المبلغ: ${d.total_amount.toFixed(3)} ر.ع<br/>
            المسافة: ${dist} كم
          </div>
        `);
        markersRef.current.push(marker);
      }
    });
  }, [myLocation, deliveries]);

  useEffect(() => {
    if (!sharingLocation) return;
    if (!navigator.geolocation) {
      toast.error('المتصفح لا يدعم الموقع'); setSharingLocation(false); return;
    }
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(loc);
        try { await api.post('/drivers/location', null, { params: { lat: loc.lat, lng: loc.lng } }); } catch {}
      },
      (err) => { toast.error('فشل الموقع'); setSharingLocation(false); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [sharingLocation]);

  const fetchData = async () => {
    try {
      try { const p = await api.get('/drivers/my'); setDriverProfile(p.data); }
      catch { setDriverProfile(null); }
      const d = await api.get('/deliveries');
      setDeliveries(d.data);
    } catch { toast.error('فشل التحميل'); }
    finally { setLoading(false); }
  };

  const registerDriver = async () => {
    try {
      await api.post('/drivers', form);
      toast.success('تم التسجيل!');
      setShowRegisterDialog(false);
      setForm({ vehicle_type: '', vehicle_number: '', license_number: '' });
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'فشل'); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA]"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-white border-b border-[#E2E8F0] py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">لوحة المندوب</h1>
            <p className="text-sm text-[#475569]">أدر توصيلاتك</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/shop')}>
              <ArrowRight className="h-4 w-4 ml-2" />العودة
            </Button>
            <Button variant="outline" onClick={async () => { await logout(); navigate('/'); }}>خروج</Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {!driverProfile ? (
          <Card className="mb-8">
            <CardContent className="py-12 text-center">
              <Truck className="h-16 w-16 text-[#4338CA] mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">أكمل ملفك كمندوب</h3>
              <p className="text-[#475569] mb-6">سجل لتبدأ قبول الطلبات</p>
              <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-[#4338CA] hover:bg-[#3730A3]">التسجيل كمندوب</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>تسجيل المندوب</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>نوع المركبة</Label>
                      <Input placeholder="دراجة نارية، سيارة..." value={form.vehicle_type}
                        onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} /></div>
                    <div><Label>رقم المركبة</Label>
                      <Input value={form.vehicle_number}
                        onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} dir="ltr" /></div>
                    <div><Label>رخصة القيادة</Label>
                      <Input value={form.license_number}
                        onChange={(e) => setForm({ ...form, license_number: e.target.value })} dir="ltr" /></div>
                    <Button className="w-full bg-[#4338CA] hover:bg-[#3730A3]" onClick={registerDriver}>إكمال</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader><CardTitle>معلومات المندوب</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-4 gap-4">
                  <div><p className="text-xs uppercase text-[#475569] font-semibold mb-1">المركبة</p>
                    <p className="font-medium">{driverProfile.vehicle_type}</p></div>
                  <div><p className="text-xs uppercase text-[#475569] font-semibold mb-1">الرقم</p>
                    <p className="font-medium" dir="ltr">{driverProfile.vehicle_number}</p></div>
                  <div><p className="text-xs uppercase text-[#475569] font-semibold mb-1">الحالة</p>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${driverProfile.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {driverProfile.is_available ? 'متاح' : 'غير متاح'}
                    </span></div>
                  <div>
                    <p className="text-xs uppercase text-[#475569] font-semibold mb-1">الموقع المباشر</p>
                    <Button size="sm"
                      variant={sharingLocation ? 'destructive' : 'outline'}
                      onClick={() => {
                        if (!sharingLocation) toast.success('بدء مشاركة الموقع');
                        else toast.info('إيقاف مشاركة الموقع');
                        setSharingLocation(!sharingLocation);
                      }}>
                      <Navigation className="h-4 w-4 ml-1" />
                      {sharingLocation ? 'إيقاف' : 'تشغيل'}
                    </Button>
                    {myLocation && (
                      <p className="text-xs text-green-600 mt-1">
                        ● موقعك: {myLocation.lat.toFixed(4)}, {myLocation.lng.toFixed(4)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* الخريطة */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-[#F97316]" />
                  خريطة الطلبات والمسافات
                </CardTitle>
                <p className="text-sm text-[#475569]">
                  {myLocation ? '🟣 موقعك | 🟠 مواقع التجار مع المسافة بالكيلومتر' : 'فعّل الموقع المباشر لرؤية المسافات'}
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div ref={mapRef} style={{ height: '400px', width: '100%', borderRadius: '0 0 8px 8px' }}></div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <Card className="stat-card"><CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase text-[#475569] font-semibold mb-2">الطلبات النشطة</p>
                    <p className="text-3xl font-bold">{deliveries.filter(d => d.status === 'shipped').length}</p>
                  </div>
                  <Package className="h-12 w-12 text-[#4338CA] opacity-20" />
                </div>
              </CardContent></Card>
              <Card className="stat-card"><CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase text-[#475569] font-semibold mb-2">إجمالي التوصيلات</p>
                    <p className="text-3xl font-bold">{deliveries.length}</p>
                  </div>
                  <Truck className="h-12 w-12 text-[#4338CA] opacity-20" />
                </div>
              </CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle>قائمة الطلبات</CardTitle></CardHeader>
              <CardContent>{deliveries.length === 0 ? (
                <p className="text-center text-[#475569] py-8">لا توجد طلبات.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>رقم الطلب</TableHead>
                    <TableHead>العنوان</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>المسافة</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{deliveries.map((d) => (
                    <TableRow key={d.order_id}>
                      <TableCell className="font-mono text-sm" dir="ltr">{d.order_id}</TableCell>
                      <TableCell className="max-w-xs truncate">{d.delivery_address}</TableCell>
                      <TableCell className="font-medium">{d.total_amount.toFixed(3)} ر.ع</TableCell>
                      <TableCell>
                        {myLocation && d.merchant_lat && d.merchant_lng ? (
                          <span className="text-[#F97316] font-medium">
                            {getDistance(myLocation.lat, myLocation.lng, d.merchant_lat, d.merchant_lng)} كم
                          </span>
                        ) : (
                          <span className="text-[#475569] text-xs">فعّل الموقع</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {getStatusArabic(d.status)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}</CardContent>
            </Card>
          </>
        )}
      </div>
      <SupportChat />
    </div>
  );
};

export default DriverDashboard;