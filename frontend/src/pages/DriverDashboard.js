import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../contexts/ThemeContext";
import api from "../utils/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Truck, Package, ArrowRight, Navigation, MapPin, CheckCircle,
  Phone, MessageCircle, DollarSign, Calendar, ChevronDown, ChevronUp,
  ExternalLink, Zap, Star, Clock, TrendingUp, Map,
} from "lucide-react";
import SupportChat from "../components/SupportChat";
import MapTrack from "../components/MapTrack";
import OrderChat from "../components/OrderChat";
import ThemeToggle from "../components/ThemeToggle";

/* ─── helpers ─── */
const haversine = (lat1, lng1, lat2, lng2) => {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371, dL = (lat2 - lat1) * Math.PI / 180, dG = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dL / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dG / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
};

const openGoogleMaps = (lat, lng, label = "") => {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  window.open(url, "_blank", "noopener");
};

const STATUS_AR = { pending: "قيد الانتظار", confirmed: "مؤكد", shipped: "جارٍ التوصيل", delivered: "تم التوصيل", cancelled: "ملغى" };
const STATUS_COLOR = { confirmed: ["#1D4ED8", "#DBEAFE"], shipped: ["#D97706", "#FEF3C7"], delivered: ["#059669", "#D1FAE5"], cancelled: ["#DC2626", "#FEE2E2"] };

/* ─── بطاقة الطلب ─── */
const OrderCard = ({ order, showAccept, myLocation, onAccept, onComplete, onChat, t }) => {
  const [expanded, setExpanded] = useState(false);
  const distMerchant = haversine(myLocation?.lat, myLocation?.lng, order.merchant_lat, order.merchant_lng);
  const distCustomer = haversine(myLocation?.lat, myLocation?.lng, order.delivery_lat, order.delivery_lng);
  const earn         = (order.total_amount * 0.05).toFixed(3);
  const [statusColor, statusBg] = STATUS_COLOR[order.status] || ["#475569", "#F1F5F9"];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, marginBottom: 12, overflow: "hidden" }}
    >
      {/* الجزء الرئيسي */}
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: t.text }}>طلب #{order.order_id.slice(-8)}</p>
            <p style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>
              {new Date(order.created_at).toLocaleDateString("ar-OM", { day: "numeric", month: "short" })}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: statusColor, background: statusBg }}>
              {STATUS_AR[order.status] || order.status}
            </span>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setExpanded(e => !e)}
              style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: 6, padding: "3px 6px", cursor: "pointer", display: "flex", color: t.text2 }}
            >
              {expanded ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
            </motion.button>
          </div>
        </div>

        {/* شبكة المعلومات */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          <div style={{ background: t.bg2, borderRadius: 8, padding: "8px 10px" }}>
            <p style={{ fontSize: 10, color: t.muted, marginBottom: 2 }}>💰 أرباحك</p>
            <p style={{ fontSize: 14, fontWeight: 800, color: "#10B981" }}>{earn} ر.ع</p>
          </div>
          <div style={{ background: t.bg2, borderRadius: 8, padding: "8px 10px" }}>
            <p style={{ fontSize: 10, color: t.muted, marginBottom: 2 }}>🏪 للمتجر</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#F97316" }}>
              {distMerchant ? `${distMerchant} كم` : myLocation ? "—" : "فعّل GPS"}
            </p>
          </div>
          <div style={{ background: t.bg2, borderRadius: 8, padding: "8px 10px" }}>
            <p style={{ fontSize: 10, color: t.muted, marginBottom: 2 }}>🏠 للزبون</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#4338CA" }}>
              {distCustomer ? `${distCustomer} كم` : myLocation ? "—" : "فعّل GPS"}
            </p>
          </div>
        </div>

        {/* العنوان */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 12, fontSize: 12, color: t.text2 }}>
          <MapPin style={{ width: 13, height: 13, color: "#F97316", marginTop: 2, flexShrink: 0 }} />
          <span>{order.delivery_address}</span>
        </div>

        {/* أزرار الإجراءات */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {showAccept && (
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => onAccept(order.order_id)}
              style={{ flex: 1, minWidth: 100, padding: "9px 14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#10B981,#059669)", color: "#fff", fontFamily: "Tajawal,sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <CheckCircle style={{ width: 15, height: 15 }} />قبول الطلب
            </motion.button>
          )}
          {!showAccept && order.status === "shipped" && (
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => onComplete(order.order_id)}
              style={{ flex: 1, minWidth: 100, padding: "9px 14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#4338CA,#7C3AED)", color: "#fff", fontFamily: "Tajawal,sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <CheckCircle style={{ width: 15, height: 15 }} />تم التوصيل ✓
            </motion.button>
          )}

          {/* زر Google Maps */}
          {order.status === "shipped" && order.delivery_lat && (
            <motion.button whileTap={{ scale: 0.96 }}
              onClick={() => openGoogleMaps(order.delivery_lat, order.delivery_lng, "موقع الزبون")}
              style={{ padding: "9px 12px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.bg2, color: t.text, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontFamily: "Tajawal,sans-serif", fontWeight: 600 }}>
              <Map style={{ width: 14, height: 14, color: "#10B981" }} />خرائط
            </motion.button>
          )}
          {showAccept && order.merchant_lat && (
            <motion.button whileTap={{ scale: 0.96 }}
              onClick={() => openGoogleMaps(order.merchant_lat, order.merchant_lng, "موقع المتجر")}
              style={{ padding: "9px 12px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.bg2, color: t.text, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontFamily: "Tajawal,sans-serif", fontWeight: 600 }}>
              <Map style={{ width: 14, height: 14, color: "#F97316" }} />المتجر
            </motion.button>
          )}

          <motion.button whileTap={{ scale: 0.96 }} onClick={() => onChat(order)}
            style={{ padding: "9px 12px", borderRadius: 10, border: `1.5px solid #7C3AED`, background: "transparent", color: "#7C3AED", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontFamily: "Tajawal,sans-serif", fontWeight: 600 }}>
            <MessageCircle style={{ width: 14, height: 14 }} />دردشة
          </motion.button>
        </div>
      </div>

      {/* التفاصيل القابلة للطي */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "12px 16px 16px", borderTop: `1px solid ${t.border}`, background: t.bg3 + "60" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 8 }}>المنتجات في الطلب:</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {order.items?.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: t.text2 }}>
                    <span>• {item.name || item.product_id} × {item.quantity}</span>
                    <span style={{ fontWeight: 600, color: t.text }}>{((item.price || 0) * item.quantity).toFixed(3)} ر.ع</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: t.text2 }}>إجمالي الطلب</span>
                <span style={{ fontWeight: 800, color: "#4338CA" }}>{order.total_amount?.toFixed(3)} ر.ع</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
                <span style={{ color: t.muted }}>حصتك (5%)</span>
                <span style={{ fontWeight: 700, color: "#10B981" }}>{earn} ر.ع</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ─── اللوحة الرئيسية ─── */
const DriverDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, setUser, loading: authLoading } = useAuth();
  const t = useT();

  const [driverProfile, setDriverProfile] = useState(null);
  const [stats, setStats]                 = useState(null);
  const [deliveries, setDeliveries]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState("available");
  const [sharingLocation, setSharingLocation] = useState(false);
  const [myLocation, setMyLocation]       = useState(null);
  const [locationUpdates, setLocationUpdates] = useState(0);
  const [accuracy, setAccuracy]           = useState(null);
  const [form, setForm]     = useState({ vehicle_type: "", vehicle_number: "", license_number: "" });
  const [showRegister, setShowRegister]   = useState(false);
  const [showPhone, setShowPhone]         = useState(false);
  const [phoneInput, setPhoneInput]       = useState("");
  const [savingPhone, setSavingPhone]     = useState(false);
  const [chatOrder, setChatOrder]         = useState(null);
  const watchRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== "driver") { navigate("/shop"); return; }
    fetchData();
  }, [user, navigate, authLoading]);

  // GPS watch
  useEffect(() => {
    if (!sharingLocation) {
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
      return;
    }
    if (!navigator.geolocation) { toast.error("المتصفح لا يدعم GPS"); setSharingLocation(false); return; }
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(loc);
        setAccuracy(Math.round(pos.coords.accuracy));
        setLocationUpdates(n => n + 1);
        try { await api.post("/drivers/location", null, { params: { lat: loc.lat, lng: loc.lng } }); } catch {}
      },
      () => { toast.error("فشل تحديد الموقع"); setSharingLocation(false); },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 10000 }
    );
    return () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current); };
  }, [sharingLocation]);

  const fetchData = async () => {
    try {
      const [profileRes, deliveriesRes] = await Promise.allSettled([
        api.get("/drivers/my"),
        api.get("/deliveries"),
      ]);
      if (profileRes.status === "fulfilled") {
        setDriverProfile(profileRes.value.data);
        // جلب الإحصائيات
        try { const s = await api.get("/drivers/stats"); setStats(s.data); } catch {}
      } else { setDriverProfile(null); }
      if (deliveriesRes.status === "fulfilled") setDeliveries(deliveriesRes.value.data);
    } catch { toast.error("فشل التحميل"); }
    finally { setLoading(false); }
  };

  const acceptDelivery = async (orderId) => {
    try { await api.post(`/deliveries/${orderId}/accept`); toast.success("تم قبول الطلب!"); fetchData(); }
    catch (e) { toast.error(e.response?.data?.detail || "فشل القبول"); }
  };

  const completeDelivery = async (orderId) => {
    try { await api.post(`/deliveries/${orderId}/complete`); toast.success("تم التوصيل! 🎉"); fetchData(); }
    catch (e) { toast.error(e.response?.data?.detail || "فشل"); }
  };

  const savePhone = async () => {
    if (!phoneInput.trim()) { toast.error("أدخل رقم الهاتف"); return; }
    setSavingPhone(true);
    try { const r = await api.patch("/users/profile", { phone: phoneInput.trim() }); setUser(r.data); toast.success("تم حفظ الرقم!"); setShowPhone(false); }
    catch { toast.error("فشل الحفظ"); }
    finally { setSavingPhone(false); }
  };

  const registerDriver = async () => {
    if (!form.vehicle_type || !form.vehicle_number || !form.license_number) { toast.error("يرجى تعبئة جميع الحقول"); return; }
    try { await api.post("/drivers", form); toast.success("تم التسجيل!"); setShowRegister(false); fetchData(); }
    catch (e) { toast.error(e.response?.data?.detail || "فشل"); }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: t.bg }}>
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
        style={{ width: 44, height: 44, borderRadius: "50%", border: `3px solid ${t.border}`, borderTopColor: "#4338CA" }} />
    </div>
  );

  const myDeliveries  = deliveries.filter(d => d.driver_id);
  const available     = deliveries.filter(d => !d.driver_id);
  const active        = myDeliveries.filter(d => d.status === "shipped");
  const completed     = myDeliveries.filter(d => d.status === "delivered");

  const sortedAvailable = myLocation
    ? [...available].sort((a, b) => {
        const da = parseFloat(haversine(myLocation.lat, myLocation.lng, a.merchant_lat, a.merchant_lng) || 999);
        const db2 = parseFloat(haversine(myLocation.lat, myLocation.lng, b.merchant_lat, b.merchant_lng) || 999);
        return da - db2;
      })
    : available;

  const mapOrders = activeTab === "available" ? sortedAvailable : active;

  return (
    <div style={{ minHeight: "100vh", background: t.bg2, direction: "rtl", fontFamily: "Tajawal,Cairo,sans-serif" }}>

      {/* Header */}
      <header style={{ background: t.card, borderBottom: `1px solid ${t.border}`, padding: "14px 0", position: "sticky", top: 0, zIndex: 40 }}>
        <div className="container mx-auto px-4" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#4338CA,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Truck style={{ width: 20, height: 20, color: "#fff" }} />
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: t.text, margin: 0 }}>لوحة المندوب</h1>
              <p style={{ fontSize: 11, color: t.muted, margin: 0 }}>مرحباً {user?.name?.split(" ")[0]}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ThemeToggle size="sm" />
            <Button variant="outline" size="sm" onClick={() => navigate("/shop")}>
              <ArrowRight className="h-4 w-4 ml-1" />العودة
            </Button>
            <Button variant="outline" size="sm" onClick={async () => { await logout(); navigate("/"); }}>خروج</Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">

        {/* تنبيه: لم يسجّل كمندوب */}
        {!driverProfile ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: t.card, borderRadius: 20, padding: "48px 24px", textAlign: "center", border: `1px solid ${t.border}` }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg,#4338CA,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Truck style={{ width: 36, height: 36, color: "#fff" }} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: t.text, marginBottom: 8 }}>أكمل ملفك كمندوب</h2>
            <p style={{ color: t.text2, marginBottom: 24, fontSize: 14 }}>سجّل بيانات مركبتك لتبدأ باستلام الطلبات وكسب الأرباح</p>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowRegister(true)}
              style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#4338CA,#7C3AED)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "Tajawal,sans-serif" }}>
              التسجيل كمندوب
            </motion.button>
          </motion.div>
        ) : (
          <>
            {/* تنبيه رقم الهاتف */}
            {!user?.phone && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <Phone style={{ width: 16, height: 16, color: "#F97316", flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: "#92400E", margin: 0, flex: 1 }}>رقم هاتفك غير مسجل — الزبائن لن يتمكنوا من التواصل معك.</p>
                <button onClick={() => { setPhoneInput(""); setShowPhone(true); }}
                  style={{ background: "#F97316", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Tajawal,sans-serif", whiteSpace: "nowrap" }}>
                  أضف رقمك
                </button>
              </motion.div>
            )}

            {/* إحصائيات */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
              {[
                { label: "متاحة", value: available.length,  icon: Package,  color: "#F97316", bg: "#FFF7ED" },
                { label: "نشطة",  value: active.length,     icon: Truck,    color: "#4338CA", bg: "#EEF2FF" },
                { label: "مكتملة",value: completed.length,  icon: CheckCircle, color: "#10B981", bg: "#ECFDF5" },
                { label: "أرباحي",value: `${stats?.total_earnings?.toFixed(3) || "0.000"} ر.ع`, icon: DollarSign, color: "#10B981", bg: "#ECFDF5" },
                { label: "أيام نشطة", value: stats?.active_days || 0, icon: Calendar, color: "#7C3AED", bg: "#F5F3FF" },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  style={{ background: t.card, borderRadius: 14, padding: "14px", border: `1px solid ${t.border}`, textAlign: "center" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>
                    <s.icon style={{ width: 18, height: 18, color: s.color }} />
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 900, color: s.color, margin: "0 0 2px" }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: t.muted, margin: 0 }}>{s.label}</p>
                </motion.div>
              ))}
            </div>

            {/* بطاقة الحالة + GPS */}
            <div style={{ background: t.card, borderRadius: 16, padding: "16px 20px", border: `1px solid ${t.border}`, marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: 11, color: t.muted, margin: "0 0 3px" }}>المركبة</p>
                  <p style={{ fontWeight: 700, color: t.text, margin: 0 }}>{driverProfile.vehicle_type}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: t.muted, margin: "0 0 3px" }}>الرقم</p>
                  <p style={{ fontWeight: 700, color: t.text, margin: 0 }} dir="ltr">{driverProfile.vehicle_number}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: t.muted, margin: "0 0 3px" }}>الحالة</p>
                  <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: driverProfile.is_available ? "#DCFCE7" : "#FEE2E2", color: driverProfile.is_available ? "#166534" : "#991B1B" }}>
                    {driverProfile.is_available ? "متاح" : "مشغول"}
                  </span>
                </div>
                {user?.phone && (
                  <div>
                    <p style={{ fontSize: 11, color: t.muted, margin: "0 0 3px" }}>هاتفك</p>
                    <p style={{ fontWeight: 700, color: t.text, margin: 0 }} dir="ltr">{user.phone}</p>
                  </div>
                )}
              </div>

              {/* زر GPS */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSharingLocation(s => !s);
                  toast[sharingLocation ? "info" : "success"](sharingLocation ? "تم إيقاف GPS" : "بدأ تحديد موقعك");
                }}
                style={{
                  padding: "10px 18px", borderRadius: 12, border: "none",
                  background: sharingLocation ? "linear-gradient(135deg,#10B981,#059669)" : "linear-gradient(135deg,#4338CA,#7C3AED)",
                  color: "#fff", fontFamily: "Tajawal,sans-serif", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                }}
              >
                {sharingLocation ? (
                  <>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: "ping 1.5s ease-in-out infinite" }} />
                    GPS مفعّل ({locationUpdates} تحديث)
                  </>
                ) : (
                  <><Navigation style={{ width: 15, height: 15 }} />تفعيل GPS</>
                )}
              </motion.button>
            </div>

            {/* الخريطة */}
            {(mapOrders.length > 0 || myLocation) && (
              <div style={{ background: t.card, borderRadius: 16, overflow: "hidden", border: `1px solid ${t.border}`, marginBottom: 20 }}>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <MapPin style={{ width: 18, height: 18, color: "#F97316" }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: t.text }}>خريطة الطلبات</span>
                  <span style={{ fontSize: 12, color: t.muted, marginRight: "auto" }}>🔵 موقعك · 🏪 المتجر · 🏠 الزبون</span>
                </div>
                <MapTrack myPos={myLocation} orders={mapOrders} height="280px" />
              </div>
            )}

            {/* تبويبات */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, background: t.bg3, padding: 4, borderRadius: 12 }}>
              {[["available","📦 المتاحة",available.length],["active","🚗 نشطة",active.length],["completed","✅ مكتملة",completed.length]].map(([k, lbl, cnt]) => (
                <motion.button key={k} whileTap={{ scale: 0.97 }} onClick={() => setActiveTab(k)}
                  style={{
                    flex: 1, padding: "9px 6px", border: "none", borderRadius: 9, fontSize: 12, cursor: "pointer",
                    fontFamily: "Tajawal,sans-serif", fontWeight: activeTab === k ? 700 : 500,
                    background: activeTab === k ? t.card : "transparent",
                    color: activeTab === k ? "#4338CA" : t.text2,
                    boxShadow: activeTab === k ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                    transition: "all 0.15s",
                  }}>
                  {lbl} ({cnt})
                </motion.button>
              ))}
            </div>

            {/* قوائم الطلبات */}
            <AnimatePresence mode="wait">
              {activeTab === "available" && (
                <motion.div key="avail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {!myLocation && (
                    <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13, color: "#92400E", textAlign: "center" }}>
                      ⚡ فعّل GPS لترتيب الطلبات حسب الأقرب إليك
                    </div>
                  )}
                  {sortedAvailable.length === 0
                    ? <p style={{ textAlign: "center", color: t.muted, padding: "32px 0" }}>لا توجد طلبات متاحة حالياً</p>
                    : sortedAvailable.map(d => <OrderCard key={d.order_id} order={d} showAccept t={t} myLocation={myLocation} onAccept={acceptDelivery} onComplete={completeDelivery} onChat={setChatOrder} />)}
                </motion.div>
              )}
              {activeTab === "active" && (
                <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {active.length === 0
                    ? <p style={{ textAlign: "center", color: t.muted, padding: "32px 0" }}>لا توجد طلبات نشطة</p>
                    : active.map(d => <OrderCard key={d.order_id} order={d} showAccept={false} t={t} myLocation={myLocation} onAccept={acceptDelivery} onComplete={completeDelivery} onChat={setChatOrder} />)}
                </motion.div>
              )}
              {activeTab === "completed" && (
                <motion.div key="comp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {completed.length === 0
                    ? <p style={{ textAlign: "center", color: t.muted, padding: "32px 0" }}>لا توجد توصيلات مكتملة بعد</p>
                    : completed.map(d => <OrderCard key={d.order_id} order={d} showAccept={false} t={t} myLocation={myLocation} onAccept={acceptDelivery} onComplete={completeDelivery} onChat={setChatOrder} />)}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* OrderChat modal */}
      <AnimatePresence>
        {chatOrder && (
          <OrderChat orderId={chatOrder.order_id} orderLabel={chatOrder.order_id.slice(-8)} onClose={() => setChatOrder(null)} />
        )}
      </AnimatePresence>

      {/* Dialog التسجيل */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent style={{ direction: "rtl", fontFamily: "Tajawal,Cairo,sans-serif" }}>
          <DialogHeader><DialogTitle>تسجيل بيانات المركبة</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>نوع المركبة</Label><Input value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })} placeholder="سيارة، دراجة نارية..." /></div>
            <div><Label>رقم المركبة</Label><Input value={form.vehicle_number} onChange={e => setForm({ ...form, vehicle_number: e.target.value })} dir="ltr" placeholder="أ ب ج 1234" /></div>
            <div><Label>رخصة القيادة</Label><Input value={form.license_number} onChange={e => setForm({ ...form, license_number: e.target.value })} dir="ltr" placeholder="رقم الرخصة" /></div>
            <Button className="w-full bg-[#4338CA]" onClick={registerDriver}>إكمال التسجيل</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog الهاتف */}
      <Dialog open={showPhone} onOpenChange={setShowPhone}>
        <DialogContent style={{ direction: "rtl", fontFamily: "Tajawal,Cairo,sans-serif", maxWidth: 400 }}>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Phone className="h-5 w-5 text-[#F97316]" />إضافة رقم التواصل</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[#475569]">رقمك يُظهَر للزبائن والتجار لتسهيل التواصل أثناء التوصيل.</p>
            <div>
              <Label>رقم الهاتف <span className="text-red-500">*</span></Label>
              <Input value={phoneInput} onChange={e => setPhoneInput(e.target.value)} placeholder="+968 XXXX XXXX" dir="ltr" type="tel" autoFocus />
            </div>
            <Button className="w-full bg-[#4338CA]" onClick={savePhone} disabled={savingPhone}>
              {savingPhone ? "جارٍ الحفظ..." : "حفظ الرقم"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SupportChat />
      <style>{`@keyframes ping{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.6)}}`}</style>
    </div>
  );
};

export default DriverDashboard;
