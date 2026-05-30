import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { toast } from "sonner";
import { Truck, Package, ArrowRight, Navigation, MapPin, CheckCircle, Clock } from "lucide-react";
import SupportChat from "../components/SupportChat";

const getStatusArabic = (s) => ({ pending: "قيد الانتظار", confirmed: "مؤكد", shipped: "جارٍ التوصيل", delivered: "تم التوصيل", cancelled: "ملغى" }[s] || s);
const getStatusColor = (s) => ({ confirmed: "bg-blue-100 text-blue-800", shipped: "bg-yellow-100 text-yellow-800", delivered: "bg-green-100 text-green-800", cancelled: "bg-red-100 text-red-800" }[s] || "bg-gray-100 text-gray-800");

const getDistance = (lat1, lng1, lat2, lng2) => {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
};

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, loading: authLoading } = useAuth();
  const [driverProfile, setDriverProfile] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("available");
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [myLocation, setMyLocation] = useState(null);
  const [form, setForm] = useState({ vehicle_type: "", vehicle_number: "", license_number: "" });
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== "driver") { navigate("/shop"); return; }
    fetchData();
  }, [user, navigate, authLoading]);

  const initMap = () => {
    if (!mapRef.current || leafletMap.current || !window.L) return;
    const L = window.L;
    leafletMap.current = L.map(mapRef.current).setView([23.5880, 58.3829], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(leafletMap.current);
  };

  useEffect(() => {
    if (!driverProfile) return;

    // تحميل CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // تحميل JS
    if (window.L) {
      initMap();
    } else if (!document.querySelector('script[src*="leaflet"]')) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => setTimeout(initMap, 100);
      document.head.appendChild(script);
    }
  }, [driverProfile, mapRef.current]);

  useEffect(() => {
    if (!leafletMap.current || !window.L) return;
    const L = window.L;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (myLocation) {
      const m = L.circleMarker([myLocation.lat, myLocation.lng], { radius: 12, color: "#4338CA", fillColor: "#4338CA", fillOpacity: 1 })
        .addTo(leafletMap.current).bindPopup("موقعي");
      markersRef.current.push(m);
      leafletMap.current.setView([myLocation.lat, myLocation.lng], 11);
    }
    deliveries.forEach(d => {
      if (d.merchant_lat && d.merchant_lng) {
        const dist = myLocation ? getDistance(myLocation.lat, myLocation.lng, d.merchant_lat, d.merchant_lng) : "?";
        const color = d.driver_id ? "#10B981" : "#F97316";
        const m = L.marker([d.merchant_lat, d.merchant_lng], {
          icon: L.divIcon({
            html: `<div style="background:${color};color:white;padding:4px 8px;border-radius:6px;font-size:12px;white-space:nowrap;font-family:Tajawal,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${dist ? dist + " كم" : "طلب"}</div>`,
            className: "", iconAnchor: [30, 10]
          })
        }).addTo(leafletMap.current).bindPopup(`<div style="direction:rtl;font-family:Tajawal,sans-serif"><b>${d.driver_id ? "طلبي" : "متاح"}</b><br/>المبلغ: ${d.total_amount.toFixed(3)} ر.ع<br/>المسافة: ${dist || "؟"} كم</div>`);
        markersRef.current.push(m);
      }
    });
  }, [myLocation, deliveries]);

  useEffect(() => {
    if (!sharingLocation) return;
    if (!navigator.geolocation) { toast.error("المتصفح لا يدعم الموقع"); setSharingLocation(false); return; }
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(loc);
        try { await api.post("/drivers/location", null, { params: { lat: loc.lat, lng: loc.lng } }); } catch {}
      },
      () => { toast.error("فشل الموقع"); setSharingLocation(false); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [sharingLocation]);

  const fetchData = async () => {
    try {
      try { const p = await api.get("/drivers/my"); setDriverProfile(p.data); } catch { setDriverProfile(null); }
      const d = await api.get("/deliveries");
      setDeliveries(d.data);
    } catch { toast.error("فشل التحميل"); }
    finally { setLoading(false); }
  };

  const acceptDelivery = async (orderId) => {
    try {
      await api.post(`/deliveries/${orderId}/accept`);
      toast.success("تم قبول الطلب!");
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || "فشل القبول"); }
  };

  const registerDriver = async () => {
    try {
      await api.post("/drivers", form);
      toast.success("تم التسجيل!");
      setShowRegisterDialog(false);
      setForm({ vehicle_type: "", vehicle_number: "", license_number: "" });
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || "فشل"); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA]"></div></div>;

  // تصنيف الطلبات
  const myDeliveries = deliveries.filter(d => d.driver_id);
  const availableDeliveries = deliveries.filter(d => !d.driver_id);
  const activeDeliveries = myDeliveries.filter(d => d.status === "shipped");
  const completedDeliveries = myDeliveries.filter(d => d.status === "delivered");

  // ترتيب المتاح حسب المسافة
  const sortedAvailable = myLocation
    ? [...availableDeliveries].sort((a, b) => {
        const da = a.merchant_lat ? parseFloat(getDistance(myLocation.lat, myLocation.lng, a.merchant_lat, a.merchant_lng)) : 999;
        const db2 = b.merchant_lat ? parseFloat(getDistance(myLocation.lat, myLocation.lng, b.merchant_lat, b.merchant_lng)) : 999;
        return da - db2;
      })
    : availableDeliveries;

  const OrderCard = ({ order, showAccept }) => {
    const distToMerchant = myLocation && order.merchant_lat ? getDistance(myLocation.lat, myLocation.lng, order.merchant_lat, order.merchant_lng) : null;
    return (
      <div style={{ background: "#fff", border: "0.5px solid #E2E8F0", borderRadius: "12px", padding: "16px", marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
          <div>
            <p style={{ fontFamily: "Cairo,sans-serif", fontWeight: 600, fontSize: "14px", color: "#0F172A" }}>طلب #{order.order_id.slice(-8)}</p>
            <p style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>{new Date(order.created_at).toLocaleDateString("ar-OM", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>{getStatusArabic(order.status)}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
          <div style={{ background: "#F8F9FA", borderRadius: "8px", padding: "8px" }}>
            <p style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "2px" }}>المبلغ</p>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#4338CA" }}>{order.total_amount.toFixed(3)} ر.ع</p>
          </div>
          <div style={{ background: "#F8F9FA", borderRadius: "8px", padding: "8px" }}>
            <p style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "2px" }}>المسافة للتاجر</p>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#F97316" }}>{distToMerchant ? `${distToMerchant} كم` : "فعّل الموقع"}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "8px", fontSize: "13px", color: "#475569" }}>
          <MapPin style={{ width: "14px", height: "14px", color: "#F97316", marginTop: "2px", flexShrink: 0 }} />
          <span>{order.delivery_address}</span>
        </div>
        {order.merchant_name && (
          <div style={{ fontSize: "12px", color: "#475569", marginBottom: "8px" }}>
            🏪 التاجر: <span style={{ fontWeight: 600 }}>{order.merchant_name}</span>
          </div>
        )}
        {order.buyer_name && (
          <div style={{ fontSize: "12px", color: "#475569", marginBottom: "12px" }}>
            👤 الزبون: <span style={{ fontWeight: 600 }}>{order.buyer_name}</span>
          </div>
        )}
        {showAccept && (
          <Button className="w-full bg-[#10B981] hover:bg-[#059669]" onClick={() => acceptDelivery(order.order_id)}>
            <CheckCircle className="h-4 w-4 ml-2" />
            قبول الطلب
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-white border-b border-[#E2E8F0] py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div><h1 className="text-2xl font-bold tracking-tight">لوحة المندوب</h1><p className="text-sm text-[#475569]">أدر توصيلاتك</p></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/shop")}><ArrowRight className="h-4 w-4 ml-2" />العودة</Button>
            <Button variant="outline" onClick={async () => { await logout(); navigate("/"); }}>خروج</Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {!driverProfile ? (
          <Card className="mb-8">
            <CardContent className="py-12 text-center">
              <Truck className="h-16 w-16 text-[#4338CA] mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">أكمل ملفك كمندوب</h3>
              <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
                <DialogTrigger asChild><Button className="bg-[#4338CA] hover:bg-[#3730A3]">التسجيل كمندوب</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>تسجيل المندوب</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>نوع المركبة</Label><Input value={form.vehicle_type} onChange={e => setForm({...form, vehicle_type: e.target.value})} placeholder="سيارة، دراجة..." /></div>
                    <div><Label>رقم المركبة</Label><Input value={form.vehicle_number} onChange={e => setForm({...form, vehicle_number: e.target.value})} dir="ltr" /></div>
                    <div><Label>رخصة القيادة</Label><Input value={form.license_number} onChange={e => setForm({...form, license_number: e.target.value})} dir="ltr" /></div>
                    <Button className="w-full bg-[#4338CA]" onClick={registerDriver}>إكمال التسجيل</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* بطاقة المعلومات */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="grid md:grid-cols-4 gap-4 items-center">
                  <div><p className="text-xs text-[#475569] mb-1">المركبة</p><p className="font-semibold">{driverProfile.vehicle_type}</p></div>
                  <div><p className="text-xs text-[#475569] mb-1">الرقم</p><p className="font-semibold" dir="ltr">{driverProfile.vehicle_number}</p></div>
                  <div><p className="text-xs text-[#475569] mb-1">الحالة</p>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${driverProfile.is_available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {driverProfile.is_available ? "متاح" : "غير متاح"}
                    </span>
                  </div>
                  <div>
                    <Button size="sm" variant={sharingLocation ? "destructive" : "outline"} onClick={() => { setSharingLocation(!sharingLocation); toast[sharingLocation ? "info" : "success"](sharingLocation ? "إيقاف الموقع" : "بدء مشاركة الموقع"); }}>
                      <Navigation className="h-4 w-4 ml-1" />{sharingLocation ? "إيقاف الموقع" : "تشغيل الموقع"}
                    </Button>
                    {myLocation && <p className="text-xs text-green-600 mt-1">● موقعك محدد</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* إحصائيات */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: "متاحة", value: availableDeliveries.length, color: "#F97316", icon: Package },
                { label: "نشطة", value: activeDeliveries.length, color: "#4338CA", icon: Truck },
                { label: "مكتملة", value: completedDeliveries.length, color: "#10B981", icon: CheckCircle }
              ].map((s, i) => (
                <Card key={i} className="stat-card"><CardContent className="p-4 text-center">
                  <s.icon className="h-8 w-8 mx-auto mb-2 opacity-60" style={{color: s.color}} />
                  <p className="text-2xl font-bold" style={{color: s.color}}>{s.value}</p>
                  <p className="text-xs text-[#475569]">{s.label}</p>
                </CardContent></Card>
              ))}
            </div>

            {/* الخريطة */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-[#F97316]" />خريطة الطلبات</CardTitle>
                <p className="text-sm text-[#475569]">🟣 موقعك | 🟠 طلبات متاحة | 🟢 طلباتي</p>
              </CardHeader>
              <CardContent className="p-0">
                <div ref={mapRef} style={{height: "350px", width: "100%", borderRadius: "0 0 8px 8px"}}></div>
              </CardContent>
            </Card>

            {/* تبويبات */}
            <div style={{display: "flex", gap: "8px", marginBottom: "16px", background: "#F1F5F9", padding: "4px", borderRadius: "10px"}}>
              {[["available", "الطلبات المتاحة", availableDeliveries.length], ["active", "نشطة", activeDeliveries.length], ["completed", "مكتملة", completedDeliveries.length]].map(([key, label, count]) => (
                <button key={key} onClick={() => setActiveTab(key)} style={{ flex: 1, padding: "8px", border: "none", borderRadius: "8px", fontSize: "13px", cursor: "pointer", fontFamily: "Tajawal,sans-serif", background: activeTab === key ? "#fff" : "transparent", color: activeTab === key ? "#4338CA" : "#475569", fontWeight: activeTab === key ? 600 : 400, boxShadow: activeTab === key ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                  {label} ({count})
                </button>
              ))}
            </div>

            {/* قائمة الطلبات */}
            {activeTab === "available" && (
              <div>
                {!myLocation && <div style={{background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:"10px", padding:"12px", marginBottom:"16px", fontSize:"13px", color:"#92400E", textAlign:"center"}}>⚡ فعّل موقعك لترتيب الطلبات حسب الأقرب إليك</div>}
                {sortedAvailable.length === 0 ? <p className="text-center text-[#475569] py-8">لا توجد طلبات متاحة حالياً</p>
                : sortedAvailable.map(d => <OrderCard key={d.order_id} order={d} showAccept={true} />)}
              </div>
            )}

            {activeTab === "active" && (
              <div>
                {activeDeliveries.length === 0 ? <p className="text-center text-[#475569] py-8">لا توجد طلبات نشطة</p>
                : activeDeliveries.map(d => <OrderCard key={d.order_id} order={d} showAccept={false} />)}
              </div>
            )}

            {activeTab === "completed" && (
              <div>
                {completedDeliveries.length === 0 ? <p className="text-center text-[#475569] py-8">لا توجد طلبات مكتملة بعد</p>
                : completedDeliveries.map(d => <OrderCard key={d.order_id} order={d} showAccept={false} />)}
              </div>
            )}
          </>
        )}
      </div>
      <SupportChat />
    </div>
  );
};

export default DriverDashboard;