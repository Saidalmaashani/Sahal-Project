import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import {
  Store, Package, DollarSign, ArrowRight, Plus, MapPin,
  Upload, X, ImageIcon, Info, Tag, Layers, Weight,
  CheckCircle, Clock, AlertCircle, Trash2, Eye
} from 'lucide-react';
import SupportChat from '../components/SupportChat';

const CATEGORIES = [
  'إلكترونيات', 'أزياء وملابس', 'منزل وحديقة', 'رياضة ولياقة',
  'كتب وتعليم', 'جمال وعناية', 'أطفال وألعاب', 'طعام وشراب',
  'سيارات وإكسسوارات', 'أدوات ومعدات', 'أخرى'
];

const getStatusArabic = (s) => ({
  pending: 'قيد الانتظار', confirmed: 'مؤكد', shipped: 'تم الشحن',
  delivered: 'تم التوصيل', cancelled: 'ملغى', approved: 'موافق عليه',
  rejected: 'مرفوض', paid: 'مدفوع'
}[s] || s);

const PLATFORM_FEE = 0.08;

// ===== مكوّن رفع الصور =====
const ImageUploader = ({ images, onChange, maxImages = 10 }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files) => {
    const fileArr = Array.from(files);
    const remaining = maxImages - images.length;
    if (remaining <= 0) { toast.error(`الحد الأقصى ${maxImages} صور`); return; }
    const toUpload = fileArr.slice(0, remaining);

    setUploading(true);
    const uploaded = [];
    for (const file of toUpload) {
      if (!file.type.startsWith('image/')) { toast.error(`${file.name}: نوع غير مدعوم`); continue; }
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name}: الحجم يتجاوز 5MB`); continue; }
      try {
        const form = new FormData();
        form.append('file', file);
        const r = await api.post('/upload/image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        uploaded.push(r.data.url);
      } catch { toast.error(`فشل رفع ${file.name}`); }
    }
    setUploading(false);
    if (uploaded.length) onChange([...images, ...uploaded]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const removeImage = (idx) => onChange(images.filter((_, i) => i !== idx));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm font-semibold">
          صور المنتج <span className="text-red-500">*</span>
        </Label>
        <span className="text-xs text-[#475569]">{images.length}/{maxImages} صورة</span>
      </div>

      {/* منطقة السحب والإفلات */}
      {images.length < maxImages && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          style={{
            border: '2px dashed #CBD5E1', borderRadius: '12px', padding: '24px',
            textAlign: 'center', cursor: 'pointer', background: '#F8FAFC',
            transition: 'all 0.2s', marginBottom: '12px'
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#4338CA'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#CBD5E1'}
        >
          <input ref={inputRef} type="file" multiple accept="image/*" className="hidden"
            onChange={e => handleFiles(e.target.files)} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4338CA]"></div>
              <p className="text-sm text-[#475569]">جارٍ رفع الصور...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-[#94A3B8]" />
              <p className="text-sm font-medium text-[#475569]">اسحب الصور هنا أو اضغط للاختيار</p>
              <p className="text-xs text-[#94A3B8]">JPEG، PNG، WebP — الحد الأقصى 5MB لكل صورة</p>
            </div>
          )}
        </div>
      )}

      {/* شبكة الصور */}
      {images.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
          {images.map((url, idx) => (
            <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: idx === 0 ? '2px solid #4338CA' : '1px solid #E2E8F0' }}>
              <img src={url} alt={`صورة ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.target.src = 'https://via.placeholder.com/100?text=Error'; }} />
              {idx === 0 && (
                <span style={{ position: 'absolute', bottom: '3px', left: '3px', background: '#4338CA', color: '#fff', fontSize: '9px', padding: '1px 5px', borderRadius: '4px' }}>رئيسية</span>
              )}
              <button onClick={() => removeImage(idx)}
                style={{ position: 'absolute', top: '3px', left: '3px', background: 'rgba(255,0,0,0.8)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: '12px', height: '12px' }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <p className="text-xs text-red-500 mt-1">يجب إضافة صورة واحدة على الأقل</p>
      )}
    </div>
  );
};

// ===== مكوّن نموذج المنتج الاحترافي =====
const ProductForm = ({ onSuccess, onClose }) => {
  const [form, setForm] = useState({
    name: '', description: '', price: '', stock: '',
    category: '', brand: '', sku: '', weight: '', images: []
  });
  const [loading, setLoading] = useState(false);

  const merchantPrice = parseFloat(form.price) || 0;
  const customerPrice = Math.round(merchantPrice * (1 + PLATFORM_FEE) * 1000) / 1000;
  const adminFee      = Math.round(merchantPrice * 0.04 * 1000) / 1000;
  const driverFee     = Math.round(merchantPrice * 0.04 * 1000) / 1000;

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name.trim())     { toast.error('اسم المنتج مطلوب'); return; }
    if (!form.description.trim()) { toast.error('وصف المنتج مطلوب'); return; }
    if (!form.price || merchantPrice <= 0) { toast.error('السعر يجب أن يكون أكبر من صفر'); return; }
    if (!form.stock || parseInt(form.stock) < 0) { toast.error('الكمية غير صالحة'); return; }
    if (!form.category) { toast.error('الفئة مطلوبة'); return; }
    if (form.images.length === 0) { toast.error('يجب إضافة صورة واحدة على الأقل'); return; }

    setLoading(true);
    try {
      await api.post('/products', {
        name: form.name.trim(),
        description: form.description.trim(),
        price: merchantPrice,
        stock: parseInt(form.stock),
        category: form.category,
        brand: form.brand.trim(),
        sku: form.sku.trim(),
        weight: form.weight ? parseFloat(form.weight) : null,
        images: form.images
      });
      toast.success('تم إضافة المنتج بنجاح!');
      onSuccess();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'فشل الإضافة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

        {/* العمود الأيمن: الصور */}
        <div>
          <ImageUploader
            images={form.images}
            onChange={imgs => setForm(f => ({ ...f, images: imgs }))}
          />
        </div>

        {/* العمود الأيسر: البيانات */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* اسم المنتج */}
          <div>
            <Label>اسم المنتج <span className="text-red-500">*</span></Label>
            <Input value={form.name} onChange={set('name')} placeholder="مثال: سماعات لاسلكية احترافية" />
          </div>

          {/* الوصف */}
          <div>
            <Label>وصف المنتج <span className="text-red-500">*</span></Label>
            <textarea
              value={form.description} onChange={set('description')}
              placeholder="اشرح مميزات المنتج، المواصفات، وأي تفاصيل مهمة..."
              rows={4}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', fontFamily: 'Tajawal,sans-serif', resize: 'vertical', background: '#fff', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#4338CA'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
          </div>

          {/* الفئة */}
          <div>
            <Label>الفئة <span className="text-red-500">*</span></Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue placeholder="اختر الفئة" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* السعر والكمية */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <Label>سعرك <span className="text-red-500">*</span></Label>
              <div style={{ position: 'relative' }}>
                <Input type="number" min="0" step="0.001" value={form.price}
                  onChange={set('price')} placeholder="0.000" dir="ltr"
                  style={{ paddingLeft: '48px' }} />
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#475569', fontWeight: 600 }}>ر.ع</span>
              </div>
            </div>
            <div>
              <Label>الكمية في المخزون <span className="text-red-500">*</span></Label>
              <Input type="number" min="0" value={form.stock} onChange={set('stock')} placeholder="0" dir="ltr" />
            </div>
          </div>

          {/* حاسبة الرسوم */}
          {merchantPrice > 0 && (
            <div style={{ background: '#F0F4FF', border: '1px solid #C7D2FE', borderRadius: '10px', padding: '12px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#4338CA', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Info style={{ width: '14px', height: '14px' }} />توزيع السعر (رسوم المنصة 8%)
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#475569' }}>سعرك (دخلك)</span>
                  <span style={{ fontWeight: 700, color: '#10B981' }}>{merchantPrice.toFixed(3)} ر.ع</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#475569' }}>رسوم الإدارة (4%)</span>
                  <span style={{ color: '#F97316' }}>{adminFee.toFixed(3)} ر.ع</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#475569' }}>رسوم التوصيل (4%)</span>
                  <span style={{ color: '#F97316' }}>{driverFee.toFixed(3)} ر.ع</span>
                </div>
                <div style={{ borderTop: '1px solid #C7D2FE', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>سعر العميل النهائي</span>
                  <span style={{ fontWeight: 700, color: '#4338CA', fontSize: '15px' }}>{customerPrice.toFixed(3)} ر.ع</span>
                </div>
              </div>
            </div>
          )}

          {/* العلامة التجارية والـ SKU */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <Label className="flex items-center gap-1"><Tag className="h-3 w-3" />العلامة التجارية</Label>
              <Input value={form.brand} onChange={set('brand')} placeholder="اختياري" />
            </div>
            <div>
              <Label className="flex items-center gap-1"><Layers className="h-3 w-3" />رمز المنتج (SKU)</Label>
              <Input value={form.sku} onChange={set('sku')} placeholder="اختياري" dir="ltr" />
            </div>
          </div>

          {/* الوزن */}
          <div>
            <Label className="flex items-center gap-1"><Weight className="h-3 w-3" />الوزن (كجم) — اختياري</Label>
            <Input type="number" min="0" step="0.01" value={form.weight}
              onChange={set('weight')} placeholder="0.00" dir="ltr" />
          </div>
        </div>
      </div>

      {/* أزرار الحفظ */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
        <Button variant="outline" onClick={onClose}>إلغاء</Button>
        <Button
          onClick={handleSubmit} disabled={loading}
          style={{ background: '#4338CA', color: '#fff', minWidth: '120px' }}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              جارٍ الحفظ...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" />إضافة المنتج
            </span>
          )}
        </Button>
      </div>
    </div>
  );
};

// ===== لوحة التاجر الرئيسية =====
const MerchantDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [analytics, setAnalytics]   = useState(null);
  const [store, setStore]            = useState(null);    // المتجر الوحيد
  const [storeLoading, setStoreLoading] = useState(true);
  const [products, setProducts]      = useState([]);
  const [orders, setOrders]          = useState([]);
  const [loading, setLoading]        = useState(true);
  const [showStoreDialog, setShowStoreDialog] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [storeForm, setStoreForm]    = useState({ name: '', description: '' });
  const [creatingStore, setCreatingStore] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    if (!user || user.role !== 'merchant') { navigate('/shop'); return; }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      const [a, s, p, o] = await Promise.all([
        api.get('/admin/analytics'),
        api.get('/stores/my'),
        api.get('/products/my'),
        api.get('/orders')
      ]);
      setAnalytics(a.data);
      setStore(s.data[0] || null);   // متجر واحد فقط
      setProducts(p.data);
      setOrders(o.data);
    } catch { toast.error('فشل التحميل'); }
    finally { setLoading(false); setStoreLoading(false); }
  };

  const createStore = async () => {
    if (!storeForm.name.trim()) { toast.error('اسم المتجر مطلوب'); return; }
    setCreatingStore(true);
    try {
      const r = await api.post('/stores', storeForm);
      toast.success('تم إرسال طلب إنشاء المتجر! بانتظار موافقة الإدارة');
      setShowStoreDialog(false);
      setStore(r.data);
    } catch (e) { toast.error(e.response?.data?.detail || 'فشل'); }
    finally { setCreatingStore(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA]"></div>
    </div>
  );

  const hasApprovedStore = store?.status === 'approved';

  const StoreStatusBanner = () => {
    if (!store) return (
      <Card className="mb-6 border-dashed border-2 border-[#4338CA]/30">
        <CardContent className="py-10 text-center">
          <Store className="h-14 w-14 text-[#4338CA] mx-auto mb-3 opacity-40" />
          <h3 className="text-xl font-bold mb-2">لا يوجد متجر بعد</h3>
          <p className="text-[#475569] mb-4 text-sm">أنشئ متجرك الأول لتبدأ بإضافة المنتجات</p>
          <Button className="bg-[#4338CA] hover:bg-[#3730A3]" onClick={() => setShowStoreDialog(true)}>
            <Plus className="h-4 w-4 ml-2" />إنشاء متجري
          </Button>
        </CardContent>
      </Card>
    );

    const statusConfig = {
      pending:  { color: '#FEF9C3', border: '#FDE047', icon: Clock,         iconColor: '#CA8A04', text: 'طلبك قيد المراجعة من قِبل الإدارة. سيتم إشعارك عند الموافقة.' },
      approved: { color: '#F0FDF4', border: '#86EFAC', icon: CheckCircle,   iconColor: '#16A34A', text: 'متجرك معتمد ويظهر للعملاء.' },
      rejected: { color: '#FFF1F2', border: '#FECDD3', icon: AlertCircle,   iconColor: '#DC2626', text: 'تم رفض المتجر. تواصل مع الإدارة لمعرفة السبب.' },
    };
    const cfg = statusConfig[store.status] || statusConfig.pending;
    const Icon = cfg.icon;

    return (
      <div style={{ background: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: '12px', padding: '16px', marginBottom: '24px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        <Icon style={{ width: '24px', height: '24px', color: cfg.iconColor, flexShrink: 0, marginTop: '2px' }} />
        <div>
          <p style={{ fontWeight: 700, fontSize: '16px', marginBottom: '2px' }}>{store.name}</p>
          <p style={{ fontSize: '13px', color: '#475569' }}>{cfg.text}</p>
          {store.description && <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>{store.description}</p>}
        </div>
        {store.status === 'approved' && (
          <Button variant="outline" size="sm" className="mr-auto" onClick={() => navigate('/merchant/profile')}>
            <MapPin className="h-3 w-3 ml-1" />موقع المتجر
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]" style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif' }}>

      {/* Header */}
      <header className="bg-white border-b border-[#E2E8F0] py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {store?.name ? `متجر ${store.name}` : 'لوحة التاجر'}
            </h1>
            <p className="text-sm text-[#475569]">
              {store?.status === 'approved'
                ? `مرحباً بك في متجرك — ${user?.name}`
                : store
                  ? `مرحباً ${user?.name} — متجرك ${store.status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}`
                  : `مرحباً ${user?.name} — ابدأ بإنشاء متجرك`}
            </p>
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

        {/* إحصائيات */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'المنتجات', value: products.length, icon: Package, color: '#4338CA' },
            { label: 'الطلبات', value: orders.length, icon: Store, color: '#7C3AED' },
            { label: 'إيراداتي', value: `ر.ع ${analytics?.total_revenue?.toFixed(3) || '0.000'}`, icon: DollarSign, color: '#10B981' },
            { label: 'المنتج الأغلى', value: products.length ? `ر.ع ${Math.max(...products.map(p => p.merchant_price || p.price)).toFixed(3)}` : '—', icon: Tag, color: '#F97316' },
          ].map((s, i) => (
            <Card key={i} className="stat-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[#475569] font-semibold mb-1">{s.label}</p>
                    <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  </div>
                  <s.icon className="h-10 w-10 opacity-15" style={{ color: s.color }} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* بانر حالة المتجر */}
        <StoreStatusBanner />

        {/* Tabs — تظهر فقط إذا كان المتجر موجوداً */}
        {store && (
          <Tabs defaultValue="products" className="space-y-4">
            <TabsList>
              <TabsTrigger value="products">المنتجات ({products.length})</TabsTrigger>
              <TabsTrigger value="orders">الطلبات ({orders.length})</TabsTrigger>
            </TabsList>

            {/* تبويب المنتجات */}
            <TabsContent value="products">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-[#4338CA]" />منتجاتي
                  </CardTitle>
                  {hasApprovedStore && (
                    <Button className="bg-[#F97316] hover:bg-[#EA580C]" onClick={() => setShowProductDialog(true)}>
                      <Plus className="h-4 w-4 ml-2" />إضافة منتج
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {!hasApprovedStore ? (
                    <div className="text-center py-10 text-[#475569]">
                      <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>بانتظار اعتماد المتجر لتتمكن من إضافة المنتجات</p>
                    </div>
                  ) : products.length === 0 ? (
                    <div className="text-center py-10">
                      <Package className="h-12 w-12 mx-auto mb-3 text-[#4338CA] opacity-30" />
                      <p className="text-[#475569] mb-4">لا توجد منتجات بعد</p>
                      <Button className="bg-[#F97316] hover:bg-[#EA580C]" onClick={() => setShowProductDialog(true)}>
                        <Plus className="h-4 w-4 ml-2" />أضف منتجك الأول
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>الصورة</TableHead>
                            <TableHead>المنتج</TableHead>
                            <TableHead>الفئة</TableHead>
                            <TableHead>سعرك</TableHead>
                            <TableHead>سعر العميل</TableHead>
                            <TableHead>المخزون</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {products.map(p => (
                            <TableRow key={p.product_id} className="cursor-pointer hover:bg-[#F8F9FA]"
                              onClick={() => setSelectedProduct(p)}>
                              <TableCell>
                                {p.images?.[0] ? (
                                  <img src={p.images[0]} alt={p.name}
                                    style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                                    onError={e => { e.target.style.display = 'none'; }} />
                                ) : (
                                  <div style={{ width: '48px', height: '48px', background: '#F1F5F9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <ImageIcon style={{ width: '20px', height: '20px', color: '#94A3B8' }} />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <p className="font-medium text-sm">{p.name}</p>
                                {p.brand && <p className="text-xs text-[#94A3B8]">{p.brand}</p>}
                              </TableCell>
                              <TableCell><span className="text-xs bg-[#F1F5F9] px-2 py-1 rounded-full">{p.category}</span></TableCell>
                              <TableCell className="font-medium text-[#10B981]">ر.ع {(p.merchant_price ?? p.price).toFixed(3)}</TableCell>
                              <TableCell className="font-bold text-[#4338CA]">ر.ع {p.price.toFixed(3)}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.stock > 5 ? 'bg-green-100 text-green-800' : p.stock > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                  {p.stock > 0 ? `${p.stock} قطعة` : 'نفذ'}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* تبويب الطلبات */}
            <TabsContent value="orders">
              <Card>
                <CardHeader><CardTitle>تاريخ الطلبات</CardTitle></CardHeader>
                <CardContent>
                  {orders.length === 0 ? (
                    <p className="text-center text-[#475569] py-8">لا توجد طلبات بعد</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>رقم الطلب</TableHead>
                          <TableHead>المبلغ</TableHead>
                          <TableHead>الحالة</TableHead>
                          <TableHead>الدفع</TableHead>
                          <TableHead>التاريخ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map(o => (
                          <TableRow key={o.order_id}>
                            <TableCell className="font-mono text-xs" dir="ltr">{o.order_id.slice(-10)}</TableCell>
                            <TableCell className="font-bold text-[#4338CA]">ر.ع {o.total_amount.toFixed(3)}</TableCell>
                            <TableCell>
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {getStatusArabic(o.status)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${o.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {getStatusArabic(o.payment_status)}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-[#475569]">
                              {new Date(o.created_at).toLocaleDateString('ar-OM')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Dialog إنشاء المتجر */}
      <Dialog open={showStoreDialog} onOpenChange={setShowStoreDialog}>
        <DialogContent style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif', maxWidth: '480px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-[#4338CA]" />إنشاء متجرك
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              يُسمح بمتجر واحد فقط لكل تاجر. سيتم مراجعة طلبك من قِبل الإدارة.
            </div>
            <div>
              <Label>اسم المتجر <span className="text-red-500">*</span></Label>
              <Input value={storeForm.name}
                onChange={e => setStoreForm(f => ({ ...f, name: e.target.value }))}
                placeholder="مثال: متجر الإلكترونيات الحديثة" />
            </div>
            <div>
              <Label>وصف المتجر</Label>
              <textarea
                value={storeForm.description}
                onChange={e => setStoreForm(f => ({ ...f, description: e.target.value }))}
                placeholder="اشرح ما تبيعه في متجرك..."
                rows={3}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', fontFamily: 'Tajawal,sans-serif', resize: 'none' }}
              />
            </div>
            <Button className="w-full bg-[#4338CA] hover:bg-[#3730A3]"
              onClick={createStore} disabled={creatingStore}>
              {creatingStore ? 'جارٍ الإرسال...' : 'إرسال طلب الإنشاء'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog إضافة منتج */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#F97316]" />إضافة منتج جديد
            </DialogTitle>
          </DialogHeader>
          <ProductForm
            onSuccess={() => { setShowProductDialog(false); fetchData(); }}
            onClose={() => setShowProductDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog تفاصيل المنتج */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        {selectedProduct && (
          <DialogContent style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif', maxWidth: '600px' }}>
            <DialogHeader>
              <DialogTitle>{selectedProduct.name}</DialogTitle>
            </DialogHeader>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                {selectedProduct.images?.[0] ? (
                  <img src={selectedProduct.images[0]} alt={selectedProduct.name}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '10px' }} />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '1', background: '#F1F5F9', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ImageIcon style={{ width: '48px', height: '48px', color: '#94A3B8' }} />
                  </div>
                )}
                {selectedProduct.images?.length > 1 && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    {selectedProduct.images.slice(1).map((img, i) => (
                      <img key={i} src={img} alt="" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #E2E8F0' }} />
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div><p className="text-xs text-[#475569]">الفئة</p><p className="font-medium">{selectedProduct.category}</p></div>
                {selectedProduct.brand && <div><p className="text-xs text-[#475569]">العلامة التجارية</p><p className="font-medium">{selectedProduct.brand}</p></div>}
                <div><p className="text-xs text-[#475569]">سعرك (دخلك)</p><p className="text-xl font-bold text-[#10B981]">ر.ع {(selectedProduct.merchant_price ?? selectedProduct.price).toFixed(3)}</p></div>
                <div><p className="text-xs text-[#475569]">سعر العميل</p><p className="text-xl font-bold text-[#4338CA]">ر.ع {selectedProduct.price.toFixed(3)}</p></div>
                <div><p className="text-xs text-[#475569]">المخزون</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${selectedProduct.stock > 5 ? 'bg-green-100 text-green-800' : selectedProduct.stock > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                    {selectedProduct.stock} قطعة
                  </span>
                </div>
                <div><p className="text-xs text-[#475569]">الوصف</p><p className="text-sm text-[#475569]">{selectedProduct.description}</p></div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <SupportChat />
    </div>
  );
};

export default MerchantDashboard;
