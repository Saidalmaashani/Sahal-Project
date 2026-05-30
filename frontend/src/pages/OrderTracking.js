import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { ArrowRight, Truck, MapPin, Phone, Package, CheckCircle, Clock, Navigation } from 'lucide-react';

const STATUS_STEPS = [
  { key: 'confirmed', label: 'تم التأكيد',     icon: CheckCircle },
  { key: 'shipped',   label: 'في الطريق إليك', icon: Truck },
  { key: 'delivered', label: 'تم التوصيل',     icon: CheckCircle },
];

const getStatusArabic = (s) => ({
  pending:   'قيد الانتظار',
  confirmed: 'مؤكد — يتم التجهيز',
  shipped:   'المندوب في الطريق إليك',
  delivered: 'تم التوصيل بنجاح',
  cancelled: 'ملغى',
}[s] || s);

const OrderTracking = () => {
  const { orderId }  = useParams();
  const navigate     = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading]   = useState(true);
  const pollRef  = useRef(null);
  const mapRef   = useRef(null);
  const leafletMapRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const destMarkerRef   = useRef(null);
  const mapReadyRef     = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    fetchTracking();
    pollRef.current = setInterval(fetchTracking, 6000);
    return () => clearInterval(pollRef.current);
  }, [orderId, user, authLoading]);

  const fetchTracking = async () => {
    try {
      const r = await api.get(`/orders/${orderId}/tracking`);
      setTracking(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'فشل تحميل بيانات التتبع');
    } finally { setLoading(false); }
  };

  // تهيئة الخريطة بعد تحميل البيانات
  useEffect(() => {
    if (!tracking || tracking.status === 'pending') return;
    loadLeaflet();
  }, [tracking?.status]);

  // تحديث مواضع الماركرات عند تغير الموقع
  useEffect(() => {
    if (!tracking || !leafletMapRef.current || !window.L) return;
    updateMapMarkers();
  }, [tracking?.driver_location]);

  const loadLeaflet = () => {
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (window.L) { setTimeout(initMap, 100); }
    else if (!document.querySelector('script[src*="leaflet"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setTimeout(initMap, 150);
      document.head.appendChild(script);
    } else {
      setTimeout(initMap, 500);
    }
  };

  const initMap = () => {
    if (!mapRef.current || leafletMapRef.current || !window.L) return;
    const L = window.L;

    // مركز الخريطة: موقع السائق أو موقع افتراضي لعُمان
    const dLoc = tracking?.driver_location;
    const center = dLoc ? [dLoc.lat, dLoc.lng] : [23.5880, 58.3829];

    leafletMapRef.current = L.map(mapRef.current, { zoomControl: true }).setView(center, dLoc ? 13 : 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 18
    }).addTo(leafletMapRef.current);

    mapReadyRef.current = true;
    updateMapMarkers();
  };

  const updateMapMarkers = () => {
    if (!leafletMapRef.current || !window.L || !mapReadyRef.current) return;
    const L    = window.L;
    const map  = leafletMapRef.current;
    const dLoc = tracking?.driver_location;

    // أيقونة السائق (نابضة)
    const driverIcon = L.divIcon({
      html: `<div style="
        width:44px;height:44px;border-radius:50%;
        background:linear-gradient(135deg,#4338CA,#7C3AED);
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 3px 12px rgba(67,56,202,0.5);
        animation:driverPulse 1.5s ease-in-out infinite;
        border:3px solid #fff;
      ">
        <svg width="22" height="22" fill="none" stroke="#fff" stroke-width="2" viewBox="0 0 24 24">
          <path d="M1 3h15l2.68 5M1 3v13h2M16 3v13H4m0 0a2 2 0 1 0 4 0m8 0a2 2 0 1 0 4 0"/>
        </svg>
      </div>
      <style>@keyframes driverPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}</style>`,
      className: '', iconAnchor: [22, 22], iconSize: [44, 44]
    });

    // أيقونة الوجهة
    const destIcon = L.divIcon({
      html: `<div style="
        width:40px;height:40px;border-radius:50%;
        background:linear-gradient(135deg,#F97316,#EA580C);
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 3px 10px rgba(249,115,22,0.4);
        border:3px solid #fff;
      ">
        <svg width="20" height="20" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>`,
      className: '', iconAnchor: [20, 20], iconSize: [40, 40]
    });

    // السائق
    if (dLoc) {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng([dLoc.lat, dLoc.lng]);
      } else {
        driverMarkerRef.current = L.marker([dLoc.lat, dLoc.lng], { icon: driverIcon })
          .addTo(map)
          .bindPopup(`<div style="direction:rtl;font-family:Tajawal,sans-serif;font-size:13px;min-width:120px">
            <b>🚚 ${tracking?.driver_info?.name || 'المندوب'}</b><br/>
            ${tracking?.driver_info?.vehicle_type || ''} - ${tracking?.driver_info?.vehicle_number || ''}
          </div>`);
      }
    }

    // الوجهة (ثابتة)
    if (!destMarkerRef.current) {
      const destLat = 23.5880, destLng = 58.3829; // fallback
      destMarkerRef.current = L.marker([destLat, destLng], { icon: destIcon })
        .addTo(map)
        .bindPopup(`<div style="direction:rtl;font-family:Tajawal,sans-serif;font-size:13px">
          <b>📍 عنوان التوصيل</b><br/>${tracking?.delivery_address || ''}
        </div>`);
    }

    // اضبط الـ zoom ليشمل كلا الماركرين
    if (dLoc && driverMarkerRef.current && destMarkerRef.current) {
      const group = L.featureGroup([driverMarkerRef.current, destMarkerRef.current]);
      map.fitBounds(group.getBounds().pad(0.3));
    } else if (dLoc) {
      map.setView([dLoc.lat, dLoc.lng], 14);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA]"></div>
    </div>
  );

  if (!tracking) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Package className="h-16 w-16 text-[#475569] mx-auto mb-4 opacity-30" />
        <p className="text-[#475569] text-lg">لم يتم العثور على الطلب</p>
        <Button className="mt-4" onClick={() => navigate('/shop')}>العودة للمتجر</Button>
      </div>
    </div>
  );

  const currentStepIdx = STATUS_STEPS.findIndex(s => s.key === tracking.status);
  const isShipped      = tracking.status === 'shipped';
  const isDelivered    = tracking.status === 'delivered';
  const hasDriver      = !!tracking.driver_info;
  const hasDriverLoc   = !!tracking.driver_location;

  return (
    <div className="min-h-screen bg-[#F8F9FA]" style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif' }}>

      {/* Header */}
      <header className="bg-white border-b border-[#E2E8F0] py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">تتبع الطلب</h1>
            <p className="text-sm text-[#475569] font-mono" dir="ltr">{orderId}</p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowRight className="h-4 w-4 ml-2" />رجوع
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">

        {/* شريط التقدم */}
        <Card className="mb-6">
          <CardContent className="py-6">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0', position: 'relative' }}>
              {STATUS_STEPS.map((step, idx) => {
                const done    = idx <= currentStepIdx;
                const current = idx === currentStepIdx;
                const Icon    = step.icon;
                return (
                  <React.Fragment key={step.key}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, minWidth: '90px' }}>
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '50%',
                        background: done ? (current && isShipped ? 'linear-gradient(135deg,#4338CA,#7C3AED)' : '#10B981') : '#E2E8F0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: current ? '0 0 0 6px rgba(67,56,202,0.15)' : 'none',
                        transition: 'all 0.4s', border: done ? 'none' : '2px solid #CBD5E1'
                      }}>
                        {current && isShipped ? (
                          <div style={{ animation: 'spin 1.5s linear infinite', display: 'flex' }}>
                            <Truck style={{ width: '22px', height: '22px', color: '#fff' }} />
                          </div>
                        ) : (
                          <Icon style={{ width: '22px', height: '22px', color: done ? '#fff' : '#94A3B8' }} />
                        )}
                      </div>
                      <p style={{ fontSize: '12px', marginTop: '8px', fontWeight: current ? 600 : 400, color: done ? '#0F172A' : '#94A3B8', textAlign: 'center' }}>
                        {step.label}
                      </p>
                    </div>
                    {idx < STATUS_STEPS.length - 1 && (
                      <div style={{ flex: 1, height: '3px', background: idx < currentStepIdx ? '#10B981' : '#E2E8F0', margin: '0 4px', marginBottom: '22px', transition: 'background 0.4s' }}></div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '15px', fontWeight: 600, color: '#4338CA' }}>
              {getStatusArabic(tracking.status)}
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* الخريطة */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#F97316]" />
                    {isShipped ? 'موقع المندوب الآن' : 'خريطة التوصيل'}
                  </span>
                  {isShipped && hasDriverLoc && (
                    <span style={{ fontSize: '11px', background: '#ECFDF5', color: '#15803D', padding: '2px 8px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulse 1.5s infinite' }}></span>
                      مباشر
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <div style={{ position: 'relative' }}>
                {(isShipped || isDelivered) ? (
                  <>
                    <div ref={mapRef} style={{ height: '420px', width: '100%' }}></div>
                    {isShipped && !hasDriverLoc && (
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(248,249,250,0.92)', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: '12px'
                      }}>
                        <Navigation style={{ width: '40px', height: '40px', color: '#94A3B8' }} />
                        <p style={{ color: '#475569', fontSize: '15px', fontWeight: 500 }}>بانتظار موقع المندوب...</p>
                        <p style={{ color: '#94A3B8', fontSize: '12px' }}>يتم التحديث كل 6 ثوانٍ</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ height: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', gap: '12px' }}>
                    <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Truck style={{ width: '32px', height: '32px', color: '#4338CA', opacity: 0.5 }} />
                    </div>
                    <p style={{ color: '#475569', fontSize: '15px', fontWeight: 500 }}>الخريطة تظهر عند بدء التوصيل</p>
                    <p style={{ color: '#94A3B8', fontSize: '12px' }}>
                      {tracking.status === 'confirmed' ? 'طلبك مؤكد ويتم التجهيز' : 'في انتظار تأكيد الطلب'}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* بطاقات المعلومات */}
          <div className="space-y-4">

            {/* تفاصيل الطلب */}
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-[#4338CA]" />تفاصيل الطلب
              </CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-[#475569] uppercase mb-1">المبلغ الإجمالي</p>
                  <p className="text-2xl font-bold text-[#4338CA]">ر.ع {tracking.total_amount.toFixed(3)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#475569] uppercase mb-1">عنوان التوصيل</p>
                  <p className="text-sm flex items-start gap-1">
                    <MapPin className="h-3 w-3 text-[#F97316] mt-0.5 flex-shrink-0" />
                    {tracking.delivery_address}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#475569] uppercase mb-1">تاريخ الطلب</p>
                  <p className="text-sm">{new Date(tracking.created_at).toLocaleDateString('ar-OM', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </CardContent>
            </Card>

            {/* بطاقة المندوب */}
            {hasDriver && (
              <Card style={{ border: '1px solid #C7D2FE' }}>
                <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4 text-[#4338CA]" />المندوب
                </CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div style={{ display: 'flex', items: 'center', gap: '10px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg,#4338CA,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>
                        {tracking.driver_info.name?.[0] || 'م'}
                      </span>
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '15px' }}>{tracking.driver_info.name}</p>
                      <p style={{ fontSize: '12px', color: '#475569' }}>
                        {tracking.driver_info.vehicle_type} — <span dir="ltr">{tracking.driver_info.vehicle_number}</span>
                      </p>
                    </div>
                  </div>

                  {tracking.driver_info.phone && (
                    <a href={`tel:${tracking.driver_info.phone}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#4338CA', color: '#fff', padding: '10px 14px', borderRadius: '10px', textDecoration: 'none', fontSize: '14px', fontWeight: 600, justifyContent: 'center' }}>
                      <Phone style={{ width: '16px', height: '16px' }} />
                      {tracking.driver_info.phone}
                    </a>
                  )}

                  {hasDriverLoc && (
                    <div style={{ background: '#EEF2FF', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#4338CA' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Navigation style={{ width: '12px', height: '12px' }} />
                        آخر تحديث: {new Date(tracking.driver_location.updated_at).toLocaleTimeString('ar-OM')}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* توصيل مُنجز */}
            {isDelivered && (
              <div style={{ background: '#ECFDF5', border: '1px solid #86EFAC', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                <CheckCircle style={{ width: '48px', height: '48px', color: '#10B981', margin: '0 auto 10px' }} />
                <p style={{ fontWeight: 700, fontSize: '17px', color: '#15803D' }}>تم التوصيل بنجاح!</p>
                <p style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>نأمل أن تكون راضياً عن طلبك</p>
                <Button className="mt-4 bg-[#4338CA] w-full" onClick={() => navigate('/shop')}>
                  تسوق مرة أخرى
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
      `}</style>
    </div>
  );
};

export default OrderTracking;
