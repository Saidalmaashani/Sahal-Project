import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Truck, MapPin, Phone, Clock,
  Package, Navigation, Crosshair, AlertCircle,
  CheckCircle2, Timer, Gauge,
} from "lucide-react";
import MapTrack from "../components/MapTrack";
import { useWebSocket } from "../hooks/useWebSocket";

const POLL_INTERVAL_ACTIVE = 15000;   // fallback polling فقط — WebSocket يتولى التحديث الفوري
const POLL_INTERVAL_WAITING = 20000;

const STATUS_STEPS = [
  { key: "pending",   label: "جارٍ التجهيز",    icon: Package },
  { key: "confirmed", label: "تم التأكيد",       icon: CheckCircle2 },
  { key: "shipped",   label: "في الطريق إليك",   icon: Truck },
  { key: "delivered", label: "تم التوصيل ✅",    icon: CheckCircle2 },
];

const STATUS_ORDER = ["pending", "confirmed", "shipped", "delivered"];

// حساب المسافة بين نقطتين (كم)
const calcDistance = (lat1, lng1, lat2, lng2) => {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// تحويل الدقائق إلى نص عربي
const formatETA = (minutes) => {
  if (minutes < 1) return "أقل من دقيقة";
  if (minutes < 60) return `${Math.round(minutes)} دقيقة`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h} ساعة و${m} دقيقة` : `${h} ساعة`;
};

const OrderTracking = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followDriver, setFollowDriver] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  const pollRef = useRef(null);
  const tickRef = useRef(null);
  const prevDriverKey = useRef('');
  const token = localStorage.getItem('token');

  // جلب بيانات التتبع
  const fetchTracking = useCallback(async () => {
    try {
      const r = await api.get(`/orders/${orderId}/tracking`);
      const data = r.data;

      // اكتشاف إذا تغير موقع المندوب
      const driverKey = data.driver_location?.lat
        ? `${data.driver_location.lat.toFixed(5)},${data.driver_location.lng.toFixed(5)}`
        : '';
      if (driverKey && driverKey !== prevDriverKey.current) {
        prevDriverKey.current = driverKey;
        setLastUpdated(new Date());
        setSecondsAgo(0);
      }

      setTracking(data);

      // إيقاف الـ polling إذا وصل الطلب
      if (data.status === 'delivered' || data.status === 'cancelled') {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        return;
      }
    } catch (e) {
      // لا نُظهر toast في كل فشل لأن الـ polling متكرر
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // بدء الـ polling
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }

    fetchTracking();

    const interval = tracking?.status === 'shipped'
      ? POLL_INTERVAL_ACTIVE
      : POLL_INTERVAL_WAITING;

    pollRef.current = setInterval(fetchTracking, interval);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orderId, user, authLoading]);

  // إعادة ضبط فترة الـ polling عندما تتغير حالة الطلب
  useEffect(() => {
    if (!tracking) return;
    if (pollRef.current) clearInterval(pollRef.current);
    if (tracking.status === 'delivered' || tracking.status === 'cancelled') return;

    const interval = tracking.status === 'shipped'
      ? POLL_INTERVAL_ACTIVE
      : POLL_INTERVAL_WAITING;

    pollRef.current = setInterval(fetchTracking, interval);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [tracking?.status, fetchTracking]);

  // WebSocket — تحديث موقع السائق فوراً
  useWebSocket({
    path: `/ws/tracking/${orderId}`,
    token,
    enabled: !!tracking && tracking.status === 'shipped',
    onMessage: useCallback((data) => {
      if (data.type === 'tracking_update') {
        setTracking(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            driver_location: { lat: data.lat, lng: data.lng, updated_at: data.updated_at },
          };
        });
        setLastUpdated(new Date());
        setSecondsAgo(0);
      }
    }, []),
  });

  // عداد "منذ X ثانية"
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setSecondsAgo(s => s + 1);
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA]"></div>
    </div>
  );

  if (!tracking) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-3">
      <AlertCircle className="h-12 w-12 text-[#E11D48]" />
      <p className="text-[#475569]">لم يتم العثور على الطلب</p>
      <Button variant="outline" onClick={() => navigate("/my-orders")}>طلباتي</Button>
    </div>
  );

  const driverPos = tracking.driver_location?.lat
    ? { lat: tracking.driver_location.lat, lng: tracking.driver_location.lng }
    : null;

  const destPos = tracking.delivery_lat && tracking.delivery_lng
    ? { lat: tracking.delivery_lat, lng: tracking.delivery_lng }
    : null;

  const isLive = tracking.status === 'shipped';
  const isDelivered = tracking.status === 'delivered';

  // حساب المسافة المتبقية
  const distanceKm = driverPos && destPos
    ? calcDistance(driverPos.lat, driverPos.lng, destPos.lat, destPos.lng)
    : null;

  // تقدير وقت الوصول (بافتراض 30 كم/ساعة)
  const etaMinutes = distanceKm ? (distanceKm / 30) * 60 : null;

  const currentStepIdx = STATUS_ORDER.indexOf(tracking.status);

  return (
    <div className="min-h-screen bg-[#F8F9FA]" style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif' }}>

      {/* Header */}
      <header className="bg-white border-b border-[#E2E8F0] py-4 sticky top-0 z-40">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              {isLive && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></span>
                  مباشر
                </span>
              )}
              تتبع الطلب
            </h1>
            <p className="text-xs text-[#475569] font-mono mt-0.5" dir="ltr">#{orderId.slice(-10)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/my-orders")}>
            <ArrowRight className="h-4 w-4 ml-1" />طلباتي
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">

          {/* === الخريطة === */}
          <div className="lg:col-span-2 space-y-3">

            {/* بطاقة الخريطة */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-0 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-[#4338CA]" />
                    {isDelivered ? "تم التوصيل بنجاح" : isLive ? "المندوب في الطريق" : "انتظار المندوب"}
                  </CardTitle>

                  {/* زر تتبع/ثابت */}
                  {driverPos && !isDelivered && (
                    <button
                      onClick={() => setFollowDriver(f => !f)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '5px 12px', borderRadius: '20px', border: 'none',
                        cursor: 'pointer', fontSize: '12px', fontFamily: 'Tajawal,sans-serif',
                        fontWeight: 600, transition: 'all 0.2s',
                        background: followDriver ? '#4338CA' : '#F1F5F9',
                        color: followDriver ? '#fff' : '#475569',
                      }}
                    >
                      <Crosshair style={{ width: '13px', height: '13px' }} />
                      {followDriver ? 'يتابع المندوب' : 'ثابت'}
                    </button>
                  )}
                </div>

                {/* وسيلة إيضاح */}
                <div className="flex items-center gap-4 mt-2 pb-2 text-xs text-[#475569]">
                  {driverPos && <span className="flex items-center gap-1"><span style={{ fontSize: '14px' }}>🚗</span> المندوب</span>}
                  {destPos && <span className="flex items-center gap-1"><span style={{ fontSize: '14px' }}>🏠</span> موقع التوصيل</span>}
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <MapTrack
                  driverPos={driverPos}
                  destPos={destPos}
                  followDriver={followDriver}
                  liveMode={isLive}
                  height="380px"
                />
              </CardContent>
            </Card>

            {/* شريط المعلومات المباشرة */}
            {isLive && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: distanceKm ? '1fr 1fr 1fr' : '1fr 1fr',
                gap: '10px',
              }}>
                {/* المسافة */}
                {distanceKm != null && (
                  <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                    <MapPin style={{ width: '18px', height: '18px', color: '#4338CA', margin: '0 auto 4px' }} />
                    <p style={{ fontSize: '20px', fontWeight: 800, color: '#4338CA', lineHeight: 1 }}>
                      {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} م` : `${distanceKm.toFixed(1)} كم`}
                    </p>
                    <p style={{ fontSize: '11px', color: '#6366F1', marginTop: '2px' }}>المسافة المتبقية</p>
                  </div>
                )}

                {/* الوقت المتوقع */}
                {etaMinutes != null && (
                  <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                    <Timer style={{ width: '18px', height: '18px', color: '#F97316', margin: '0 auto 4px' }} />
                    <p style={{ fontSize: '16px', fontWeight: 800, color: '#F97316', lineHeight: 1.2 }}>
                      {formatETA(etaMinutes)}
                    </p>
                    <p style={{ fontSize: '11px', color: '#92400E', marginTop: '2px' }}>وقت الوصول التقريبي</p>
                  </div>
                )}

                {/* آخر تحديث */}
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                  <Gauge style={{ width: '18px', height: '18px', color: '#10B981', margin: '0 auto 4px' }} />
                  <p style={{ fontSize: '16px', fontWeight: 800, color: '#10B981', lineHeight: 1.2 }}>
                    {secondsAgo < 60 ? `${secondsAgo} ث` : `${Math.floor(secondsAgo / 60)} د`}
                  </p>
                  <p style={{ fontSize: '11px', color: '#065F46', marginTop: '2px' }}>منذ آخر تحديث</p>
                </div>
              </div>
            )}

            {/* رسالة انتظار المندوب */}
            {!driverPos && !isDelivered && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800 text-sm">
                    {tracking.driver_info ? "بانتظار تحديث موقع المندوب..." : "جارٍ تخصيص مندوب لطلبك..."}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    تحديث تلقائي كل {tracking.status === 'shipped' ? '4' : '10'} ثوانٍ
                  </p>
                </div>
              </div>
            )}

            {/* رسالة تم التوصيل */}
            {isDelivered && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-bold text-green-800">وصل طلبك بنجاح! 🎉</p>
                  <p className="text-xs text-green-700 mt-0.5">نأمل أن تكون راضياً عن خدمة سهل</p>
                </div>
              </div>
            )}

            {/* مؤشر التحديث المباشر */}
            {!isDelivered && (
              <p className="text-center text-xs text-[#94A3B8] flex items-center justify-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-amber-400'}`}></span>
                {isLive
                  ? `تتبع مباشر — يتجدد كل ${POLL_INTERVAL_ACTIVE / 1000} ثوانٍ`
                  : `تحديث كل ${POLL_INTERVAL_WAITING / 1000} ثوانٍ`}
              </p>
            )}
          </div>

          {/* === الجانب الأيسر === */}
          <div className="space-y-4">

            {/* مراحل الطلب */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4 text-[#4338CA]" />مراحل الطلب
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="relative">
                  {/* خط رأسي */}
                  <div style={{
                    position: 'absolute', right: '11px', top: '14px',
                    bottom: '14px', width: '2px', background: '#E2E8F0', zIndex: 0,
                  }} />
                  {STATUS_STEPS.map((step, i) => {
                    const done = i <= currentStepIdx;
                    const active = i === currentStepIdx;
                    const Icon = step.icon;
                    return (
                      <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: i < STATUS_STEPS.length - 1 ? '18px' : 0, position: 'relative', zIndex: 1 }}>
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: done ? '#4338CA' : '#F1F5F9',
                          border: active ? '3px solid #C7D2FE' : '2px solid ' + (done ? '#4338CA' : '#E2E8F0'),
                          boxShadow: active ? '0 0 0 4px rgba(67,56,202,0.12)' : 'none',
                          transition: 'all 0.3s',
                        }}>
                          <Icon style={{ width: '12px', height: '12px', color: done ? '#fff' : '#94A3B8' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: active ? 700 : done ? 500 : 400, color: active ? '#4338CA' : done ? '#0F172A' : '#94A3B8' }}>
                            {step.label}
                          </p>
                          {active && tracking.updated_at && (
                            <p style={{ fontSize: '11px', color: '#6366F1' }}>
                              {new Date(tracking.updated_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* تفاصيل الطلب */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4 text-[#4338CA]" />تفاصيل الطلب
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#475569]">المبلغ</span>
                  <span className="font-bold text-[#4338CA]">{tracking.total_amount?.toFixed(3)} ر.ع</span>
                </div>
                <div>
                  <p className="text-xs text-[#475569] mb-1">عنوان التوصيل</p>
                  <p className="text-xs text-[#0F172A] flex items-start gap-1 leading-relaxed">
                    <MapPin className="h-3.5 w-3.5 text-[#F97316] mt-0.5 flex-shrink-0" />
                    {tracking.delivery_address}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* معلومات المندوب */}
            {tracking.driver_info && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Truck className="h-4 w-4 text-[#F97316]" />المندوب
                    {isLive && (
                      <span className="mr-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">● متصل</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg,#4338CA,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                      🚗
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{tracking.driver_info.name}</p>
                      <p className="text-xs text-[#475569]">{tracking.driver_info.vehicle_type}</p>
                    </div>
                  </div>

                  {tracking.driver_info.phone && (
                    <a
                      href={`tel:${tracking.driver_info.phone}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 12px', background: '#F0FDF4', borderRadius: '10px',
                        border: '1px solid #BBF7D0', textDecoration: 'none',
                        color: '#10B981', fontSize: '14px', fontWeight: 600,
                      }}
                      dir="ltr"
                    >
                      <Phone style={{ width: '16px', height: '16px' }} />
                      {tracking.driver_info.phone}
                    </a>
                  )}

                  <div className="flex justify-between text-xs text-[#475569]">
                    <span>رقم المركبة</span>
                    <span dir="ltr" className="font-medium">{tracking.driver_info.vehicle_number}</span>
                  </div>

                  {tracking.driver_location?.updated_at && (
                    <p className="text-xs text-[#94A3B8] border-t pt-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      آخر موقع: {new Date(tracking.driver_location.updated_at).toLocaleTimeString("ar", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderTracking;
