import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { toast } from "sonner";
import { ArrowRight, Truck, MapPin, Phone, Clock, Package, Navigation } from "lucide-react";

const getStatusArabic = (s) => ({
  pending: "قيد الانتظار",
  confirmed: "مؤكد - يتم التجهيز",
  shipped: "🚗 في الطريق إليك",
  delivered: "✅ تم التوصيل",
  cancelled: "ملغى"
}[s] || s);

const OrderTracking = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const driverMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const lineRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }
    fetchTracking();
    pollRef.current = setInterval(fetchTracking, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [orderId, user, authLoading]);

  const initMap = (trackingData) => {
    if (!mapRef.current || !window.L) return;

    const L = window.L;
    const driverLoc = trackingData.driver_location;
    const centerLat = driverLoc?.lat || 17.0151;
    const centerLng = driverLoc?.lng || 54.0924;

    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current, {
        tap: false, dragging: true, touchZoom: true, scrollWheelZoom: false
      }).setView([centerLat, centerLng], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
      }).addTo(leafletMap.current);
    }

    // علامة المندوب
    if (driverLoc?.lat) {
      const driverIcon = L.divIcon({
        html: `<div style="background:#4338CA;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:22px">🚗</div>`,
        iconSize: [44, 44], iconAnchor: [22, 22], className: ""
      });

      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng([driverLoc.lat, driverLoc.lng]);
      } else {
        driverMarkerRef.current = L.marker([driverLoc.lat, driverLoc.lng], { icon: driverIcon })
          .addTo(leafletMap.current)
          .bindPopup(`<div style="direction:rtl;font-family:Tajawal,sans-serif"><b>🚗 المندوب</b><br/>${trackingData.driver_info?.name || ""}</div>`);
      }
      leafletMap.current.setView([driverLoc.lat, driverLoc.lng], 14);
    }

    // علامة الوجهة
    if (trackingData.delivery_lat && trackingData.delivery_lng) {
      const destIcon = L.divIcon({
        html: `<div style="background:#F97316;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:22px">🏠</div>`,
        iconSize: [44, 44], iconAnchor: [22, 44], className: ""
      });

      if (!destMarkerRef.current) {
        destMarkerRef.current = L.marker([trackingData.delivery_lat, trackingData.delivery_lng], { icon: destIcon })
          .addTo(leafletMap.current)
          .bindPopup(`<div style="direction:rtl;font-family:Tajawal,sans-serif"><b>🏠 موقع التوصيل</b><br/>${trackingData.delivery_address}</div>`);
      }

      // خط بين المندوب والوجهة
      if (driverLoc?.lat) {
        if (lineRef.current) lineRef.current.remove();
        lineRef.current = L.polyline([
          [driverLoc.lat, driverLoc.lng],
          [trackingData.delivery_lat, trackingData.delivery_lng]
        ], { color: "#4338CA", weight: 3, dashArray: "8,8", opacity: 0.7 }).addTo(leafletMap.current);

        // ضبط الخريطة لتظهر كل النقاط
        leafletMap.current.fitBounds([
          [driverLoc.lat, driverLoc.lng],
          [trackingData.delivery_lat, trackingData.delivery_lng]
        ], { padding: [40, 40] });
      }
    }
  };

  const loadLeafletAndInit = (trackingData) => {
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    if (window.L) {
      setTimeout(() => initMap(trackingData), 200);
    } else if (!document.querySelector('script[src*="leaflet"]')) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => setTimeout(() => initMap(trackingData), 200);
      document.head.appendChild(script);
    } else {
      setTimeout(() => initMap(trackingData), 500);
    }
  };

  const fetchTracking = async () => {
    try {
      const r = await api.get(`/orders/${orderId}/tracking`);
      setTracking(r.data);
      if (mapRef.current) loadLeafletAndInit(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "فشل تحميل التتبع");
    } finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA]"></div>
    </div>
  );

  if (!tracking) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-[#475569]">لم يتم العثور على الطلب</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-white border-b border-[#E2E8F0] py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">تتبع الطلب</h1>
            <p className="text-sm text-[#475569] font-mono" dir="ltr">{orderId}</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/shop")}>
            <ArrowRight className="h-4 w-4 ml-2" />العودة
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">

          {/* الخريطة */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-[#4338CA]" />
                  تتبع مباشر
                </CardTitle>
                <p className="text-xs text-[#475569]">🚗 المندوب | 🏠 موقع التوصيل</p>
              </CardHeader>
              <CardContent className="p-0">
                <div ref={mapRef} style={{ height: "450px", width: "100%" }}></div>
              </CardContent>
            </Card>

            {!tracking.driver_location && (
              <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center text-sm text-yellow-800">
                {tracking.driver_info ? "⏳ بانتظار تحديث موقع المندوب..." : "📦 سيتم تخصيص مندوب قريباً"}
              </div>
            )}

            <div className="mt-3 text-center text-xs text-[#475569]">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                تحديث تلقائي كل ٨ ثوانٍ
              </span>
            </div>
          </div>

          {/* معلومات الطلب */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-[#4338CA]" />حالة الطلب
              </CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs uppercase text-[#475569] mb-1">الحالة</p>
                  <p className="text-lg font-bold text-[#4338CA]">{getStatusArabic(tracking.status)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-[#475569] mb-1">المبلغ</p>
                  <p className="text-lg font-medium">{tracking.total_amount?.toFixed(3)} ر.ع</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-[#475569] mb-1">عنوان التوصيل</p>
                  <p className="text-sm flex items-start gap-1">
                    <MapPin className="h-4 w-4 text-[#F97316] mt-0.5 flex-shrink-0" />
                    {tracking.delivery_address}
                  </p>
                </div>
              </CardContent>
            </Card>

            {tracking.driver_info && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-[#F97316]" />المندوب
                </CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-[#475569] mb-1">الاسم</p>
                    <p className="font-medium">{tracking.driver_info.name}</p>
                  </div>
                  {tracking.driver_info.phone && (
                    <a href={`tel:${tracking.driver_info.phone}`} className="flex items-center gap-2 text-[#4338CA]" dir="ltr">
                      <Phone className="h-4 w-4" />{tracking.driver_info.phone}
                    </a>
                  )}
                  <div>
                    <p className="text-xs text-[#475569] mb-1">المركبة</p>
                    <p className="text-sm">{tracking.driver_info.vehicle_type} - <span dir="ltr">{tracking.driver_info.vehicle_number}</span></p>
                  </div>
                  {tracking.driver_location?.updated_at && (
                    <p className="text-xs text-[#475569] border-t pt-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      آخر تحديث: {new Date(tracking.driver_location.updated_at).toLocaleTimeString("ar")}
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