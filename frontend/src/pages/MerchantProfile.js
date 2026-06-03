import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { MapPin, Save } from 'lucide-react';

const MerchantProfile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [location, setLocation] = useState({ lat: '', lng: '' });
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!user || user.role !== 'merchant') { navigate('/shop'); return; }
    // جلب الموقع الحالي من الباكند
    api.get('/merchants/profile').then(r => {
      if (r.data.lat) setLocation({ lat: r.data.lat, lng: r.data.lng });
    }).catch(() => {});
  }, [user, navigate]);

  const initMap = () => {
    if (!mapRef.current || leafletMap.current || !window.L) return;
    const L = window.L;
    const initLat = location.lat || 23.5880;
    const initLng = location.lng || 58.3829;
    leafletMap.current = L.map(mapRef.current, { tap: false, dragging: true, touchZoom: true, scrollWheelZoom: false }).setView([initLat, initLng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(leafletMap.current);
    markerRef.current = L.marker([initLat, initLng], { draggable: true }).addTo(leafletMap.current);
    markerRef.current.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      setLocation({ lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) });
    });
    leafletMap.current.on('click', (e) => {
      const { lat, lng } = e.latlng;
      markerRef.current.setLatLng([lat, lng]);
      setLocation({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
    });
  };

  useEffect(() => {
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (window.L) {
      initMap();
    } else if (!document.querySelector('script[src*="leaflet"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setTimeout(initMap, 100);
      document.head.appendChild(script);
    }
  }, [mapRef.current]);

  const detectLocation = () => {
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setLocation({ lat, lng });
        if (leafletMap.current && markerRef.current) {
          leafletMap.current.setView([lat, lng], 14);
          markerRef.current.setLatLng([lat, lng]);
        }
        setDetecting(false);
        toast.success('تم تحديد موقعك!');
      },
      () => { toast.error('فشل تحديد الموقع'); setDetecting(false); }
    );
  };

  const saveLocation = async () => {
    if (!location.lat || !location.lng) { toast.error('حدد موقعك على الخريطة'); return; }
    setLoading(true);
    try {
      await api.patch('/merchants/profile', { lat: parseFloat(location.lat), lng: parseFloat(location.lng) });
      toast.success('تم حفظ موقع المتجر!');
    } catch { toast.error('فشل الحفظ'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-white border-b border-[#E2E8F0] py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">موقع المتجر</h1>
          <Button variant="outline" onClick={() => navigate('/merchant/dashboard')}>
            العودة للوحة التحكم
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#F97316]" />
              حدد موقع متجرك
            </CardTitle>
            <p className="text-sm text-[#475569]">
              يستخدم المندوبون هذا الموقع لحساب المسافة وتنظيم التوصيلات
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" onClick={detectLocation} disabled={detecting} className="w-full">
              <MapPin className="h-4 w-4 ml-2" />
              {detecting ? 'جارٍ التحديد...' : 'تحديد موقعي الحالي تلقائياً'}
            </Button>

            <div ref={mapRef} style={{ height: '400px', borderRadius: '10px', border: '1px solid #E2E8F0' }}></div>
            <p className="text-xs text-[#475569] text-center">اضغط على الخريطة أو اسحب العلامة لتحديد الموقع بدقة</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>خط العرض (Latitude)</Label>
                <Input value={location.lat} onChange={e => setLocation({...location, lat: e.target.value})} dir="ltr" placeholder="23.5880" />
              </div>
              <div>
                <Label>خط الطول (Longitude)</Label>
                <Input value={location.lng} onChange={e => setLocation({...location, lng: e.target.value})} dir="ltr" placeholder="58.3829" />
              </div>
            </div>

            <Button className="w-full bg-[#4338CA] hover:bg-[#3730A3]" onClick={saveLocation} disabled={loading}>
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