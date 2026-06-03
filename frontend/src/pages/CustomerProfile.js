import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import {
  User, Phone, MapPin, Package, ArrowRight, Save,
  Copy, Gift, Navigation, Edit3, CheckCircle,
  Clock, Truck, XCircle, ShoppingBag, DollarSign
} from 'lucide-react';
import SupportChat from '../components/SupportChat';

const STATUS_MAP = {
  pending:   { label: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  confirmed: { label: 'مؤكد',         color: 'bg-blue-100 text-blue-800',    icon: CheckCircle },
  shipped:   { label: 'في الطريق',    color: 'bg-purple-100 text-purple-800', icon: Truck },
  delivered: { label: 'تم التوصيل',   color: 'bg-green-100 text-green-800',  icon: CheckCircle },
  cancelled: { label: 'ملغى',         color: 'bg-red-100 text-red-800',      icon: XCircle },
};

const CustomerProfile = () => {
  const navigate    = useNavigate();
  const { user, setUser, loading: authLoading } = useAuth();
  const [profile, setProfile]   = useState(null);
  const [orders, setOrders]     = useState([]);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [form, setForm] = useState({ name: '', phone: '', address: '', lat: '', lng: '' });

  const mapRef      = useRef(null);
  const leafletMap  = useRef(null);
  const markerRef   = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    fetchAll();
  }, [user, authLoading, navigate]);

  const fetchAll = async () => {
    try {
      const [p, o] = await Promise.all([
        api.get('/users/profile'),
        api.get('/users/orders')
      ]);
      setProfile(p.data);
      setOrders(o.data);
      setForm({
        name:    p.data.name    || '',
        phone:   p.data.phone   || '',
        address: p.data.address || '',
        lat:     p.data.lat     || '',
        lng:     p.data.lng     || '',
      });
    } catch { toast.error('فشل التحميل'); }
  };

  // تهيئة الخريطة
  const initMap = () => {
    if (!mapRef.current || leafletMap.current || !window.L) return;
    const L = window.L;
    const lat = parseFloat(form.lat) || 23.5880;
    const lng = parseFloat(form.lng) || 58.3829;
    leafletMap.current = L.map(mapRef.current).setView([lat, lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(leafletMap.current);
    markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(leafletMap.current);
    markerRef.current.on('dragend', e => {
      const pos = e.target.getLatLng();
      setForm(f => ({ ...f, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) }));
    });
    leafletMap.current.on('click', e => {
      markerRef.current.setLatLng([e.latlng.lat, e.latlng.lng]);
      setForm(f => ({ ...f, lat: e.latlng.lat.toFixed(6), lng: e.latlng.lng.toFixed(6) }));
    });
  };

  useEffect(() => {
    if (activeTab !== 'location' || !editing) return;
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (window.L) { setTimeout(initMap, 50); }
    else if (!document.querySelector('script[src*="leaflet"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setTimeout(initMap, 100);
      document.head.appendChild(script);
    }
  }, [activeTab, editing]);

  const detectLocation = () => {
    if (!navigator.geolocation) { toast.error('المتصفح لا يدعم تحديد الموقع'); return; }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      setForm(f => ({ ...f, lat, lng }));
      if (leafletMap.current && markerRef.current) {
        leafletMap.current.setView([lat, lng], 15);
        markerRef.current.setLatLng([lat, lng]);
      }
      setDetecting(false);
      toast.success('تم تحديد موقعك!');
    }, () => { toast.error('فشل تحديد الموقع'); setDetecting(false); });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('الاسم مطلوب'); return; }
    if (!form.phone.trim()) { toast.error('رقم الهاتف مطلوب'); return; }
    setSaving(true);
    try {
      const payload = {};
      if (form.name)    payload.name    = form.name.trim();
      if (form.phone)   payload.phone   = form.phone.trim();
      if (form.address) payload.address = form.address.trim();
      if (form.lat)     payload.lat     = parseFloat(form.lat);
      if (form.lng)     payload.lng     = parseFloat(form.lng);
      const r = await api.patch('/users/profile', payload);
      setProfile(r.data);
      setUser(r.data);
      setEditing(false);
      toast.success('تم حفظ الملف الشخصي!');
    } catch { toast.error('فشل الحفظ'); }
    finally { setSaving(false); }
  };

  const copyReferral = () => {
    navigator.clipboard.writeText(profile?.referral_code || '');
    toast.success('تم نسخ الرمز!');
  };

  const shareReferral = () => {
    const link = `${window.location.origin}/register?ref=${profile?.referral_code}`;
    navigator.clipboard.writeText(link);
    toast.success('تم نسخ رابط الإحالة!');
  };

  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA]"></div>
    </div>
  );

  const initials = profile.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'ز';
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
  const activeOrders    = orders.filter(o => ['confirmed', 'shipped'].includes(o.status)).length;

  return (
    <div className="min-h-screen bg-[#F8F9FA]" style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif' }}>

      {/* Header */}
      <header className="bg-white border-b border-[#E2E8F0] py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">حسابي</h1>
          <Button variant="outline" onClick={() => navigate('/shop')}>
            <ArrowRight className="h-4 w-4 ml-2" />العودة للمتجر
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">

        {/* بطاقة الهوية العلوية */}
        <Card className="mb-6 overflow-hidden">
          <div style={{ background: 'linear-gradient(135deg, #4338CA, #7C3AED)', height: '80px' }}></div>
          <CardContent className="pt-0 pb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-10 px-4">
              {/* الصورة الرمزية */}
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #4338CA, #F97316)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '4px solid #fff', flexShrink: 0, fontSize: '28px',
                fontWeight: 700, color: '#fff', fontFamily: 'Cairo,sans-serif',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>{initials}</div>

              <div className="flex-1 mt-2">
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A' }}>{profile.name}</h2>
                <p style={{ fontSize: '14px', color: '#475569' }} dir="ltr">{profile.email}</p>
                {profile.phone && (
                  <p style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <Phone style={{ width: '13px', height: '13px' }} />{profile.phone}
                  </p>
                )}
              </div>

              {/* إحصائيات سريعة */}
              <div className="flex gap-4 mt-2 sm:mt-0">
                {[
                  { label: 'إجمالي الطلبات', value: orders.length, color: '#4338CA' },
                  { label: 'مُنجزة', value: deliveredOrders, color: '#10B981' },
                  { label: 'نشطة', value: activeOrders, color: '#F97316' },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: 'center', minWidth: '60px' }}>
                    <p style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>{s.value}</p>
                    <p style={{ fontSize: '11px', color: '#475569' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: '#F1F5F9', padding: '4px', borderRadius: '12px', marginBottom: '20px' }}>
          {[
            { key: 'profile', label: 'بياناتي', icon: User },
            { key: 'location', label: 'موقعي', icon: MapPin },
            { key: 'orders', label: `طلباتي (${orders.length})`, icon: Package },
            { key: 'referral', label: 'الإحالات', icon: Gift },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{
              flex: 1, padding: '8px 4px', border: 'none', borderRadius: '8px',
              fontSize: '13px', cursor: 'pointer', fontFamily: 'Tajawal,sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
              background: activeTab === key ? '#fff' : 'transparent',
              color: activeTab === key ? '#4338CA' : '#475569',
              fontWeight: activeTab === key ? 600 : 400,
              boxShadow: activeTab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s'
            }}>
              <Icon style={{ width: '14px', height: '14px' }} />{label}
            </button>
          ))}
        </div>

        {/* ===== تبويب البيانات الشخصية ===== */}
        {activeTab === 'profile' && (
          <Card>
            {!profile.phone && !editing && (
              <div style={{ background: '#FFF7ED', borderBottom: '1px solid #FED7AA', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Phone style={{ width: '16px', height: '16px', color: '#F97316', flexShrink: 0 }} />
                <p style={{ fontSize: '13px', color: '#92400E', margin: 0 }}>
                  رقم هاتفك مطلوب — يستخدمه المندوب للتواصل معك عند التوصيل.{' '}
                  <button onClick={() => setEditing(true)} style={{ color: '#F97316', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Tajawal,sans-serif', fontSize: '13px', textDecoration: 'underline' }}>
                    أضفه الآن
                  </button>
                </p>
              </div>
            )}
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-[#4338CA]" />البيانات الشخصية
              </CardTitle>
              {!editing ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Edit3 className="h-4 w-4 ml-1" />تعديل
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}>إلغاء</Button>
                  <Button size="sm" className="bg-[#4338CA]" onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 ml-1" />{saving ? 'حفظ...' : 'حفظ'}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <Label>الاسم الكامل</Label>
                  {editing ? (
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  ) : (
                    <p style={{ padding: '8px 0', fontSize: '15px', fontWeight: 500 }}>{profile.name || '—'}</p>
                  )}
                </div>
                <div>
                  <Label>البريد الإلكتروني</Label>
                  <p style={{ padding: '8px 0', fontSize: '15px', color: '#475569' }} dir="ltr">{profile.email}</p>
                </div>
                <div>
                  <Label className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />رقم الهاتف <span style={{ color: '#E11D48', marginRight: '2px' }}>*</span>
                  </Label>
                  {editing ? (
                    <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="+968 XXXX XXXX" dir="ltr" type="tel"
                      style={{ borderColor: !form.phone ? '#E11D48' : undefined }} />
                  ) : profile.phone ? (
                    <p style={{ padding: '8px 0', fontSize: '15px', direction: 'ltr' }}>{profile.phone}</p>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
                      <span style={{ color: '#E11D48', fontSize: '13px' }}>⚠️ لم يُضف بعد</span>
                      <button onClick={() => setEditing(true)} style={{ color: '#4338CA', fontWeight: 600, fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Tajawal,sans-serif', textDecoration: 'underline' }}>
                        أضفه الآن
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" />عنوان التوصيل الافتراضي</Label>
                  {editing ? (
                    <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="الحي، الشارع، رقم المبنى..." />
                  ) : (
                    <p style={{ padding: '8px 0', fontSize: '15px' }}>
                      {profile.address || <span style={{ color: '#94A3B8' }}>لم يُضف بعد</span>}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== تبويب الموقع الجغرافي ===== */}
        {activeTab === 'location' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#F97316]" />موقعي الجغرافي
              </CardTitle>
              {!editing ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Edit3 className="h-4 w-4 ml-1" />تحديث الموقع
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}>إلغاء</Button>
                  <Button size="sm" className="bg-[#4338CA]" onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 ml-1" />{saving ? 'حفظ...' : 'حفظ الموقع'}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.lat && profile.lng && !editing ? (
                <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '10px', padding: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <CheckCircle style={{ color: '#16A34A', width: '20px', height: '20px', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontWeight: 600, color: '#15803D' }}>موقعك محدد ✓</p>
                    <p style={{ fontSize: '12px', color: '#475569', direction: 'ltr' }}>
                      {parseFloat(profile.lat).toFixed(4)}, {parseFloat(profile.lng).toFixed(4)}
                    </p>
                  </div>
                </div>
              ) : !editing ? (
                <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '10px', padding: '12px' }}>
                  <p style={{ color: '#92400E', fontSize: '14px' }}>لم تُحدد موقعك بعد. اضغط "تحديث الموقع" لإضافته.</p>
                </div>
              ) : null}

              {editing && (
                <>
                  <Button variant="outline" className="w-full border-[#4338CA] text-[#4338CA]"
                    onClick={detectLocation} disabled={detecting}>
                    <Navigation className="h-4 w-4 ml-2" />
                    {detecting ? 'جارٍ التحديد...' : 'تحديد موقعي الحالي تلقائياً'}
                  </Button>

                  <div ref={mapRef} style={{ height: '360px', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}></div>
                  <p style={{ fontSize: '12px', color: '#94A3B8', textAlign: 'center' }}>
                    اضغط على الخريطة أو اسحب العلامة لتحديد موقعك بدقة
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>خط العرض</Label>
                      <Input value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} dir="ltr" placeholder="23.5880" /></div>
                    <div><Label>خط الطول</Label>
                      <Input value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} dir="ltr" placeholder="58.3829" /></div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* ===== تبويب الطلبات ===== */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <Card><CardContent className="py-14 text-center">
                <ShoppingBag className="h-14 w-14 text-[#4338CA] mx-auto mb-3 opacity-30" />
                <p className="text-[#475569] mb-3">لا توجد طلبات بعد</p>
                <Button className="bg-[#4338CA]" onClick={() => navigate('/shop')}>ابدأ التسوق</Button>
              </CardContent></Card>
            ) : orders.map(order => {
              const s = STATUS_MAP[order.status] || STATUS_MAP.pending;
              const Icon = s.icon;
              return (
                <Card key={order.order_id} className="hover:border-[#4338CA] transition-colors">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p style={{ fontFamily: 'monospace', fontSize: '12px', color: '#475569' }} dir="ltr">{order.order_id}</p>
                        <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                          {new Date(order.created_at).toLocaleDateString('ar-OM', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${s.color}`}>
                        <Icon style={{ width: '12px', height: '12px' }} />{s.label}
                      </span>
                    </div>

                    {/* منتجات الطلب */}
                    {order.items?.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        {order.items.slice(0, 4).map((item, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F8F9FA', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' }}>
                            {item.product?.images?.[0] && (
                              <img src={item.product.images[0]} alt="" style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'cover' }} />
                            )}
                            <span>{item.product?.name || 'منتج'}</span>
                            <span style={{ color: '#94A3B8' }}>×{item.quantity}</span>
                          </div>
                        ))}
                        {order.items.length > 4 && <span style={{ fontSize: '12px', color: '#94A3B8', alignSelf: 'center' }}>+{order.items.length - 4} أخرى</span>}
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <p style={{ fontSize: '20px', fontWeight: 700, color: '#4338CA' }}>ر.ع {order.total_amount.toFixed(3)}</p>
                      {['confirmed', 'shipped'].includes(order.status) && (
                        <Button size="sm" className="bg-[#4338CA] hover:bg-[#3730A3]"
                          onClick={() => navigate(`/track/${order.order_id}`)}>
                          <Truck className="h-3 w-3 ml-1" />تتبع الطلب
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ===== تبويب الإحالات ===== */}
        {activeTab === 'referral' && (
          <div className="space-y-4">
            <Card style={{ background: 'linear-gradient(135deg, #4338CA, #7C3AED)', color: '#fff' }}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Gift className="h-8 w-8 opacity-80" />
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700 }}>ادعُ أصدقاءك واربح</h3>
                    <p style={{ fontSize: '13px', opacity: 0.8 }}>10% من قيمة أول طلب لكل صديق تدعوه</p>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '16px' }}>
                  <p style={{ fontSize: '11px', opacity: 0.7, marginBottom: '8px' }}>رمز الإحالة الخاص بك</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', color: '#0F172A', borderRadius: '8px', padding: '10px 16px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 700, letterSpacing: '3px' }}>
                      {profile.referral_code || '—'}
                    </span>
                    <button onClick={copyReferral} style={{ background: '#4338CA', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px' }}>
                      <Copy style={{ width: '14px', height: '14px', display: 'inline', marginLeft: '4px' }} />نسخ
                    </button>
                  </div>
                </div>
                <Button onClick={shareReferral} style={{ marginTop: '12px', width: '100%', background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
                  مشاركة رابط الدعوة
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <p style={{ fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <DollarSign style={{ width: '16px', height: '16px', color: '#10B981' }} />
                  أرباحي من الإحالات
                </p>
                <p style={{ fontSize: '32px', fontWeight: 700, color: '#10B981' }}>
                  ر.ع {(profile.referral_earnings || 0).toFixed(3)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <SupportChat />
    </div>
  );
};

export default CustomerProfile;
