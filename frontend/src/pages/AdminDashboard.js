import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import AnalyticsCharts from '../components/AnalyticsCharts';
import ThemeToggle from '../components/ThemeToggle';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  Users, Store, Package, DollarSign, ArrowRight, CheckCircle, XCircle,
  Truck, Bell, Pencil, Trash2, UserPlus, Send, Radio,
  Search, Eye, Wallet, RefreshCw, ExternalLink, Hash, Boxes, ClipboardList, History, MapPin
} from 'lucide-react';
import SupportChat from '../components/SupportChat';

const getStatusArabic = (s) => ({
  pending: 'قيد الانتظار', confirmed: 'مؤكد', shipped: 'تم الشحن',
  delivered: 'تم التوصيل', cancelled: 'ملغى', approved: 'موافق عليه',
  rejected: 'مرفوض', paid: 'مدفوع'
}[s] || s);

const getRoleArabic = (r) => ({ admin: 'مدير', merchant: 'تاجر', shopper: 'متسوق', driver: 'سائق' }[r] || r);

const getPaymentStatusArabic = (p) => ({ paid: 'مدفوع', pending: 'قيد الدفع', failed: 'فشل الدفع' }[p] || p);

const statusColor = (s) => ({
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
}[s] || 'bg-gray-100 text-gray-800');

const paymentColor = (p) => ({
  paid: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
}[p] || 'bg-gray-100 text-gray-800');

const ORDER_STATUS_KEYS = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

const formatMoney = (v) => `ر.ع ${Number(v || 0).toFixed(3)}`;

const formatDate = (d) => d ? new Date(d).toLocaleString('ar-OM', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const ROLES = [
  { value: 'shopper', label: 'متسوق' },
  { value: 'merchant', label: 'تاجر' },
  { value: 'driver', label: 'سائق' },
  { value: 'admin', label: 'مدير' },
];

// ===== Dialog: تعديل مستخدم =====
const EditUserDialog = ({ target, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: target.name || '',
    phone: target.phone || '',
    role: target.role || 'shopper',
    address: target.address || '',
    is_approved: target.is_approved ?? true,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) { toast.error('الاسم مطلوب'); return; }
    setSaving(true);
    try {
      await api.patch(`/admin/users/${target.user_id}`, form);
      toast.success('تم تحديث المستخدم');
      onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || 'فشل التحديث'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif', maxWidth: '480px' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-[#4338CA]" />تعديل: {target.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الاسم <span className="text-red-500">*</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>رقم الهاتف</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" type="tel" placeholder="+968 XXXX XXXX" />
            </div>
          </div>
          <div>
            <Label>البريد الإلكتروني</Label>
            <Input value={target.email} disabled dir="ltr" style={{ background: 'var(--bg2)', color: 'var(--muted)' }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الدور</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>الحالة</Label>
              <Select value={String(form.is_approved)} onValueChange={v => setForm(f => ({ ...f, is_approved: v === 'true' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">موافق عليه</SelectItem>
                  <SelectItem value="false">معلّق</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>العنوان</Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="اختياري" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>إلغاء</Button>
            <Button className="flex-1 bg-[#4338CA]" onClick={save} disabled={saving}>
              {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ===== Dialog: إضافة مستخدم =====
const AddUserDialog = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'shopper' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error('الاسم والبريد وكلمة المرور مطلوبة'); return;
    }
    if (form.password.length < 8) { toast.error('كلمة المرور 8 أحرف على الأقل'); return; }
    setSaving(true);
    try {
      await api.post('/admin/users', form);
      toast.success('تم إنشاء الحساب');
      onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || 'فشل الإنشاء'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif', maxWidth: '480px' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[#10B981]" />إضافة مستخدم جديد
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الاسم الكامل <span className="text-red-500">*</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="محمد علي" />
            </div>
            <div>
              <Label>رقم الهاتف</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" type="tel" placeholder="+968 XXXX XXXX" />
            </div>
          </div>
          <div>
            <Label>البريد الإلكتروني <span className="text-red-500">*</span></Label>
            <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" dir="ltr" placeholder="user@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>كلمة المرور <span className="text-red-500">*</span></Label>
              <Input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} type="password" dir="ltr" placeholder="8 أحرف على الأقل" />
            </div>
            <div>
              <Label>الدور</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>إلغاء</Button>
            <Button className="flex-1 bg-[#10B981] hover:bg-[#059669]" onClick={save} disabled={saving}>
              {saving ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ===== Dialog: إرسال رسالة لمستخدم =====
const NotifyDialog = ({ target, onClose }) => {
  const [form, setForm] = useState({ title: '', message: '', link: '' });
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!form.title.trim() || !form.message.trim()) { toast.error('العنوان والرسالة مطلوبان'); return; }
    setSending(true);
    try {
      await api.post(`/admin/users/${target.user_id}/notify`, { title: form.title, message: form.message, link: form.link || undefined });
      toast.success(`تم إرسال الرسالة لـ ${target.name}`);
      onClose();
    } catch { toast.error('فشل الإرسال'); }
    finally { setSending(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif', maxWidth: '460px' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-[#7C3AED]" />رسالة لـ: {target.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>العنوان <span className="text-red-500">*</span></Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="مثال: تحديث مهم" />
          </div>
          <div>
            <Label>نص الرسالة <span className="text-red-500">*</span></Label>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="اكتب الرسالة هنا..." rows={4}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontFamily: 'Tajawal,sans-serif', resize: 'vertical', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#4338CA'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          </div>
          <div>
            <Label>رابط (اختياري)</Label>
            <Input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} placeholder="/shop أو /my-orders" dir="ltr" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>إلغاء</Button>
            <Button className="flex-1 bg-[#7C3AED] hover:bg-[#6D28D9]" onClick={send} disabled={sending}>
              <Send className="h-4 w-4 ml-2" />{sending ? 'جارٍ الإرسال...' : 'إرسال'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ===== Dialog: إرسال رسالة جماعية =====
const BroadcastDialog = ({ onClose }) => {
  const [form, setForm] = useState({ title: '', message: '', link: '', role: 'all' });
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!form.title.trim() || !form.message.trim()) { toast.error('العنوان والرسالة مطلوبان'); return; }
    setSending(true);
    try {
      const params = form.role !== 'all' ? { role: form.role } : {};
      const r = await api.post('/admin/broadcast', { title: form.title, message: form.message, link: form.link || undefined }, { params });
      toast.success(r.data.message);
      onClose();
    } catch { toast.error('فشل الإرسال'); }
    finally { setSending(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif', maxWidth: '460px' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-[#F97316]" />إرسال رسالة جماعية
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>إرسال لـ</Label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المستخدمين</SelectItem>
                {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>العنوان <span className="text-red-500">*</span></Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="مثال: إعلان هام" />
          </div>
          <div>
            <Label>نص الرسالة <span className="text-red-500">*</span></Label>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="اكتب الرسالة هنا..." rows={4}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontFamily: 'Tajawal,sans-serif', resize: 'vertical', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#F97316'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          </div>
          <div>
            <Label>رابط (اختياري)</Label>
            <Input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} placeholder="/shop" dir="ltr" />
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            ⚠️ سيتم إرسال هذه الرسالة لجميع المستخدمين المحددين كإشعار داخل التطبيق.
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>إلغاء</Button>
            <Button className="flex-1 bg-[#F97316] hover:bg-[#EA580C]" onClick={send} disabled={sending}>
              <Radio className="h-4 w-4 ml-2" />{sending ? 'جارٍ الإرسال...' : 'إرسال الجميع'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};


// ===== Dialog: تفاصيل الطلب وإجراءاته =====
const OrderDetailsDialog = ({ order, drivers, onClose, onChanged }) => {
  const [busy, setBusy] = useState(null);
  const [driverPick, setDriverPick] = useState('');

  const updateStatus = async (status) => {
    if (!window.confirm(`هل تريد نقل الطلب إلى "${getStatusArabic(status)}"؟`)) return;
    setBusy(`st_${status}`);
    try {
      await api.patch(`/orders/${order.order_id}/status`, null, { params: { status } });
      toast.success('تم تحديث الحالة'); onChanged();
    } catch (e) { toast.error(e.response?.data?.detail || 'فشل التحديث'); }
    finally { setBusy(null); }
  };

  const updatePayment = async (ps) => {
    setBusy(`pay_${ps}`);
    try {
      await api.patch(`/orders/${order.order_id}/payment`, null, { params: { payment_status: ps } });
      toast.success('تم تحديث حالة الدفع'); onChanged();
    } catch (e) { toast.error(e.response?.data?.detail || 'فشل'); }
    finally { setBusy(null); }
  };

  const assignDriverToOrder = async () => {
    if (!driverPick) return;
    setBusy('driver');
    try {
      await api.post(`/deliveries/${order.order_id}/assign`, null, { params: { driver_id: driverPick } });
      toast.success('تم تخصيص المندوب وبدء التوصيل'); setDriverPick(''); onChanged();
    } catch (e) { toast.error(e.response?.data?.detail || 'فشل التخصيص'); }
    finally { setBusy(null); }
  };

  const canAssign = String(order.status) === 'confirmed' && !order.driver?.driver_id;
  const availableDrivers = drivers.filter((d) => d.is_available);

  const statusBtnClass = (s) => ({
    confirmed: 'border-blue-400 text-blue-700',
    shipped: 'border-purple-400 text-purple-700',
    delivered: 'border-emerald-400 text-emerald-700',
    cancelled: 'border-red-300 text-red-600',
  }[s] || '');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent style={{
        direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif', maxWidth: '780px',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Hash className="h-5 w-5 text-[#4338CA]" />
            طلب رقم #{order.order_number || `…${String(order.order_id).slice(-6)}`}
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(order.status)}`}>
              {getStatusArabic(order.status)}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${paymentColor(order.payment_status)}`}>
              {getPaymentStatusArabic(order.payment_status)}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* العميل */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
            <p className="flex items-center gap-2 text-sm font-bold text-[#4338CA] mb-2">
              <Users className="h-4 w-4" />العميل
            </p>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <div><span className="text-[#475569]">الاسم:</span> <span className="font-medium">{order.customer?.name || '—'}</span></div>
              <div>
                <span className="text-[#475569]">البريد:</span>{' '}
                {order.customer?.email
                  ? <a href={`mailto:${order.customer.email}`} dir="ltr" className="text-[#4338CA]">{order.customer.email}</a>
                  : '—'}
              </div>
              <div>
                <span className="text-[#475569]">الهاتف:</span>{' '}
                {order.customer?.phone
                  ? <a href={`tel:${order.customer.phone}`} dir="ltr" className="text-[#4338CA]">{order.customer.phone}</a>
                  : '—'}
              </div>
              <div><span className="text-[#475569]">العنوان:</span> <span>{order.customer?.address || '—'}</span></div>
            </div>
          </div>

          {/* المنتجات */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
            <p className="flex items-center gap-2 text-sm font-bold text-[#7C3AED] mb-2">
              <Boxes className="h-4 w-4" />المنتجات ({order.items?.length || 0})
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>المنتج</TableHead><TableHead>المتجر</TableHead>
                  <TableHead>الكمية</TableHead><TableHead>السعر</TableHead><TableHead>الإجمالي</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(order.items || []).map((it) => (
                    <TableRow key={it.product_id}>
                      <TableCell className="font-medium text-sm">{it.name || it.product_id}</TableCell>
                      <TableCell className="text-sm text-[#475569]">{it.merchant_name || '—'}</TableCell>
                      <TableCell>{it.quantity}</TableCell>
                      <TableCell>{formatMoney(it.price)}</TableCell>
                      <TableCell className="font-medium text-sm">{formatMoney(it.price * it.quantity)}</TableCell>
                    </TableRow>
                  ))}
                  {(!order.items || order.items.length === 0) && (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-[#94A3B8]">لا توجد منتجات</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-between items-center mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="text-sm text-[#475569]">الإجمالي الفرعي</span>
              <span className="text-sm">{formatMoney(order.subtotal ?? order.total_amount)}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-[#475569]">الإجمالي النهائي</span>
              <span className="font-bold text-[#10B981] text-base">{formatMoney(order.total_amount)}</span>
            </div>
          </div>

          {/* التوصيل */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
            <p className="flex items-center gap-2 text-sm font-bold text-[#F97316] mb-2">
              <MapPin className="h-4 w-4" />التوصيل
            </p>
            <p className="text-sm">{order.delivery_address || '—'}</p>
            {(order.delivery_lat != null || order.delivery_lng != null) && (
              <p className="font-mono text-xs text-[#475569]" dir="ltr">
                {order.delivery_lat ?? ''}, {order.delivery_lng ?? ''}
              </p>
            )}
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <span className="text-sm text-[#475569]">المندوب:</span>
                {order.driver?.driver_id ? (
                  <div className="text-sm">
                    <span className="font-medium">{order.driver.name || 'مندوب'}</span>
                    <span className="text-[#475569]">
                      {order.driver.phone ? ` · ${order.driver.phone}` : ''}
                      {order.driver.vehicle ? ` · ${order.driver.vehicle}` : ''}
                      {order.driver.vehicle_number ? ` (${order.driver.vehicle_number})` : ''}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-[#E11D48] font-medium">غير مخصص</span>
                )}
              </div>
              {canAssign && (
                <div className="flex gap-2 flex-wrap items-center">
                  <Select value={driverPick} onValueChange={setDriverPick}>
                    <SelectTrigger className="w-[230px]"><SelectValue placeholder="اختر مندوباً متاحاً" /></SelectTrigger>
                    <SelectContent>
                      {availableDrivers.length === 0 && (
                        <div className="px-3 py-2 text-xs text-[#475569]">لا يوجد مندوبون متاحون حالياً</div>
                      )}
                      {availableDrivers.map((dr) => (
                        <SelectItem key={dr.driver_id} value={dr.driver_id}>{dr.name} ({dr.vehicle_type})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={assignDriverToOrder} disabled={!driverPick || busy === 'driver'}>
                    {busy === 'driver' ? 'جارٍ التخصيص...' : 'تخصيص وبدء التوصيل'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* الأوقات */}
          <div className="flex flex-wrap gap-4 text-xs text-[#475569]" style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 14px' }}>
            <div className="flex items-center gap-1.5"><History className="h-3.5 w-3.5" />الإنشاء: {formatDate(order.created_at)}</div>
            <div className="flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" />آخر تحديث: {formatDate(order.updated_at)}</div>
          </div>

          {/* الإجراءات الممكنة */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', background: 'var(--bg3)' }}>
            <p className="flex items-center gap-2 text-sm font-bold text-[#10B981] mb-3">
              <ClipboardList className="h-4 w-4" />الإجراءات الممكنة لهذا الطلب
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm text-[#475569]">الخطوة القادمة:</span>
                {order.allowed_transitions?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {order.allowed_transitions.map((s) => (
                      <Button key={s} size="sm" variant="outline" className={statusBtnClass(s)}
                        disabled={busy === `st_${s}`} onClick={() => updateStatus(s)}>
                        {busy === `st_${s}` ? 'جارٍ...' : getStatusArabic(s)}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-[#475569]">لا توجد خطوات — الطلب في حالة نهائية</span>
                )}
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-sm text-[#475569]">حالة الدفع:</span>
                <div className="flex flex-wrap gap-2">
                  {order.payment_status !== 'paid' && (
                    <Button size="sm" variant="outline" className="border-emerald-400 text-emerald-700"
                      disabled={busy === 'pay_paid'} onClick={() => updatePayment('paid')}>
                      {busy === 'pay_paid' ? 'جارٍ...' : <><Wallet className="h-3.5 w-3.5 ml-1" />تأكيد الدفع</>}
                    </Button>
                  )}
                  {order.payment_status !== 'failed' && (
                    <Button size="sm" variant="outline" className="border-red-300 text-red-600"
                      disabled={busy === 'pay_failed'} onClick={() => updatePayment('failed')}>
                      {busy === 'pay_failed' ? 'جارٍ...' : 'وضع كفشل'}
                    </Button>
                  )}
                  {order.payment_status !== 'pending' && (
                    <Button size="sm" variant="outline" disabled={busy === 'pay_pending'} onClick={() => updatePayment('pending')}>
                      {busy === 'pay_pending' ? 'جارٍ...' : 'إرجاع لقيد الدفع'}
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-sm text-[#475569]">متابعة:</span>
                <div className="flex gap-2 flex-wrap">
                  <a href={`/track/${order.order_id}`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline">
                      <ExternalLink className="h-3.5 w-3.5 ml-1" />صفحة التتبع المباشر
                    </Button>
                  </a>
                  <Button size="sm" variant="outline" onClick={onChanged} disabled={busy === 'refresh'}>
                    <RefreshCw className="h-3.5 w-3.5 ml-1" />تحديث البيانات
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* المعرّف الداخلي */}
          <div className="flex items-center justify-between text-xs text-[#475569] pt-1">
            <span className="font-mono" dir="ltr">{order.order_id}</span>
            <span>{formatMoney(order.total_amount)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};


// ===== اللوحة الرئيسية =====
const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, loading: authLoading } = useAuth();
  const [analytics, setAnalytics]   = useState(null);
  const [users, setUsers]           = useState([]);
  const [stores, setStores]         = useState([]);
  const [orders, setOrders]         = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [drivers, setDrivers]       = useState([]);
  const [activeTab, setActiveTab]   = useState('users');
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [orderQuery, setOrderQuery]     = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder]     = useState(null);

  // dialogs
  const [editUser, setEditUser]         = useState(null);
  const [notifyUser, setNotifyUser]     = useState(null);
  const [showAddUser, setShowAddUser]   = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [deletingId, setDeletingId]     = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') { navigate('/shop'); return; }
    fetchData();
  }, [user, navigate, authLoading]);

  const fetchData = async () => {
    try {
      const [a, u, o, s, d, dr] = await Promise.all([
        api.get('/admin/analytics'), api.get('/admin/users'),
        api.get('/admin/orders'),      api.get('/admin/stores'),
        api.get('/admin/deliveries'), api.get('/admin/drivers')
      ]);
      setAnalytics(a.data); setUsers(u.data); setOrders(o.data);
      setStores(s.data);    setDeliveries(d.data); setDrivers(dr.data);
    } catch { toast.error('فشل تحميل البيانات'); }
    finally { setLoading(false); }
  };

  const deleteUser = async (uid, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف "${name}"؟ لا يمكن التراجع.`)) return;
    setDeletingId(uid);
    try {
      await api.delete(`/admin/users/${uid}`);
      toast.success('تم حذف المستخدم');
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'فشل الحذف'); }
    finally { setDeletingId(null); }
  };

  const approveUser = async (uid, ok) => {
    try {
      await api.patch(`/admin/users/${uid}/approve`, null, { params: { is_approved: ok } });
      toast.success(ok ? 'تمت الموافقة' : 'تم الرفض');
      fetchData();
    } catch { toast.error('فشل'); }
  };

  const updateStoreStatus = async (sid, status) => {
    try {
      await api.patch(`/stores/${sid}/status`, null, { params: { status } });
      toast.success('تم التحديث'); fetchData();
    } catch { toast.error('فشل'); }
  };

  const assignDriver = async (oid, did) => {
    try {
      await api.post(`/deliveries/${oid}/assign`, null, { params: { driver_id: did } });
      toast.success('تم التخصيص'); fetchData();
    } catch { toast.error('فشل'); }
  };

  // إبقاء نافذة التفاصيل محدّثة بعد أي إجراء
  useEffect(() => {
    if (!selectedOrder) return;
    const fresh = orders.find((o) => o.order_id === selectedOrder.order_id);
    if (fresh) setSelectedOrder(fresh);
  }, [orders]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA]"></div>
    </div>
  );

  const filteredUsers = search.trim()
    ? users.filter(u =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.phone?.includes(search)
      )
    : users;

  const roleColor = (r) => ({
    admin: 'bg-purple-100 text-purple-800',
    merchant: 'bg-orange-100 text-orange-800',
    shopper: 'bg-blue-100 text-blue-800',
    driver: 'bg-green-100 text-green-800',
  }[r] || 'bg-gray-100 text-gray-800');

  const statusCounts = {};
  ORDER_STATUS_KEYS.forEach((k) => { statusCounts[k] = orders.filter((o) => o.status === k).length; });
  statusCounts.all = orders.length;

  const q = orderQuery.trim().toLowerCase();
  const filteredOrders = orders.filter((o) => {
    if (orderStatusFilter !== 'all' && o.status !== orderStatusFilter) return false;
    if (!q) return true;
    const hay = [
      String(o.order_number || ''), o.order_id, o.order_id.replace('order_', ''),
      o.customer?.name || '', o.customer?.email || '', o.customer?.phone || '',
      String(o.total_amount),
      getStatusArabic(o.status), getPaymentStatusArabic(o.payment_status),
    ].join(' ').toLowerCase();
    return hay.includes(q);
  });

  return (
    <div className="min-h-screen bg-[#F8F9FA]" style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif' }}>

      <header className="bg-white border-b border-[#E2E8F0] py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="سهل" className="flex-shrink-0" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">لوحة تحكم المدير</h1>
              <p className="text-sm text-[#475569]">إدارة المنصة</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <ThemeToggle size="sm" />
            <Button variant="outline" onClick={() => navigate('/shop')}>
              <ArrowRight className="h-4 w-4 ml-2" />العودة
            </Button>
            <Button variant="outline" onClick={async () => { await logout(); navigate('/'); }}>خروج</Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">

        {/* إحصائيات */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'المستخدمون', value: analytics?.total_users || 0, icon: Users, color: '#4338CA' },
            { label: 'المنتجات', value: analytics?.total_products || 0, icon: Package, color: '#7C3AED' },
            { label: 'الطلبات', value: analytics?.total_orders || 0, icon: Store, color: '#F97316' },
            { label: 'الإيرادات', value: `${analytics?.total_revenue?.toFixed(3) || '0.000'} ر.ع`, icon: DollarSign, color: '#10B981' },
          ].map((s, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#475569] font-semibold mb-1">{s.label}</p>
                    <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  </div>
                  <s.icon className="h-10 w-10 opacity-15" style={{ color: s.color }} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="charts">📊 الإحصائيات</TabsTrigger>
            <TabsTrigger value="users">المستخدمون ({users.length})</TabsTrigger>
            <TabsTrigger value="stores">المتاجر</TabsTrigger>
            <TabsTrigger value="orders">الطلبات</TabsTrigger>
            <TabsTrigger value="deliveries">التوصيلات</TabsTrigger>
            <TabsTrigger value="drivers">السائقون</TabsTrigger>
          </TabsList>

          {/* ===== تبويب الإحصائيات ===== */}
          <TabsContent value="charts">
            <AnalyticsCharts role="admin" />
          </TabsContent>

          {/* ===== تبويب المستخدمين ===== */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-[#4338CA]" />إدارة المستخدمين
                  </CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="بحث بالاسم أو البريد..."
                      style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontFamily: 'Tajawal,sans-serif', outline: 'none', minWidth: '180px' }}
                    />
                    <Button size="sm" className="bg-[#F97316] hover:bg-[#EA580C]"
                      onClick={() => setShowBroadcast(true)}>
                      <Radio className="h-4 w-4 ml-1" />رسالة جماعية
                    </Button>
                    <Button size="sm" className="bg-[#10B981] hover:bg-[#059669]"
                      onClick={() => setShowAddUser(true)}>
                      <UserPlus className="h-4 w-4 ml-1" />إضافة مستخدم
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>البريد</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>الدور</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.user_id} className="hover:bg-[#F8F9FA]">
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell dir="ltr" className="text-sm text-[#475569]">{u.email}</TableCell>
                        <TableCell dir="ltr" className="text-sm">{u.phone || <span className="text-[#CBD5E1]">—</span>}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColor(u.role)}`}>
                            {getRoleArabic(u.role)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.is_approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {u.is_approved ? 'موافق عليه' : 'قيد الانتظار'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1.5 flex-wrap">
                            {/* موافقة/رفض للتجار */}
                            {!u.is_approved && u.role === 'merchant' && (
                              <>
                                <button title="موافقة" onClick={() => approveUser(u.user_id, true)}
                                  style={{ padding: '4px 6px', border: '1px solid #86EFAC', borderRadius: '6px', background: '#F0FDF4', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                  <CheckCircle style={{ width: '14px', height: '14px', color: '#16A34A' }} />
                                </button>
                                <button title="رفض" onClick={() => approveUser(u.user_id, false)}
                                  style={{ padding: '4px 6px', border: '1px solid #FECDD3', borderRadius: '6px', background: '#FFF1F2', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                  <XCircle style={{ width: '14px', height: '14px', color: '#DC2626' }} />
                                </button>
                              </>
                            )}
                            {/* تعديل */}
                            <button title="تعديل" onClick={() => setEditUser(u)}
                              style={{ padding: '4px 8px', border: '1px solid #C7D2FE', borderRadius: '6px', background: '#EEF2FF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#4338CA' }}>
                              <Pencil style={{ width: '12px', height: '12px' }} />تعديل
                            </button>
                            {/* رسالة */}
                            <button title="إرسال رسالة" onClick={() => setNotifyUser(u)}
                              style={{ padding: '4px 8px', border: '1px solid #E9D5FF', borderRadius: '6px', background: '#F5F3FF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#7C3AED' }}>
                              <Bell style={{ width: '12px', height: '12px' }} />رسالة
                            </button>
                            {/* حذف */}
                            <button title="حذف" onClick={() => deleteUser(u.user_id, u.name)}
                              disabled={deletingId === u.user_id}
                              style={{ padding: '4px 8px', border: '1px solid #FECDD3', borderRadius: '6px', background: '#FFF1F2', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#DC2626', opacity: deletingId === u.user_id ? 0.5 : 1 }}>
                              <Trash2 style={{ width: '12px', height: '12px' }} />حذف
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredUsers.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-[#94A3B8]">لا توجد نتائج</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== تبويب المتاجر ===== */}
          <TabsContent value="stores">
            <Card>
              <CardHeader><CardTitle>الموافقة على المتاجر</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>الشعار</TableHead><TableHead>المتجر</TableHead><TableHead>التاجر</TableHead>
                    <TableHead>الوصف</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{stores.map((s) => (
                    <TableRow key={s.store_id}>
                      <TableCell>
                        {s.logo ? (
                          <img src={s.logo} alt={s.name} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border)' }} />
                        ) : (
                          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'linear-gradient(135deg,#4338CA,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Store style={{ width: '18px', height: '18px', color: '#fff' }} />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell><p className="font-medium text-sm">{s.merchant_name || '—'}</p>
                        <p className="text-xs text-[#475569]" dir="ltr">{s.merchant_email || ''}</p></TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{s.description}</TableCell>
                      <TableCell><span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        s.status === 'approved' ? 'bg-green-100 text-green-800' :
                        s.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>{getStatusArabic(s.status)}</span></TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline"
                            className={s.status === 'approved' ? 'border-red-300 text-red-600' : 'border-green-300 text-green-700'}
                            onClick={() => updateStoreStatus(s.store_id, s.status === 'approved' ? 'rejected' : 'approved')}>
                            {s.status === 'approved' ? 'إلغاء الاعتماد' : 'موافقة'}
                          </Button>
                          {s.status === 'pending' && (
                            <Button size="sm" variant="destructive" onClick={() => updateStoreStatus(s.store_id, 'rejected')}>رفض</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== تبويب الطلبات ===== */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-[#4338CA]" />إدارة الطلبات
                    <span className="text-sm font-normal text-[#475569]">({orders.length} طلب)</span>
                  </CardTitle>
                  <div className="flex gap-2 flex-wrap w-full lg:w-auto">
                    <div className="relative flex-1 lg:flex-none">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                      <input
                        value={orderQuery}
                        onChange={(e) => setOrderQuery(e.target.value)}
                        placeholder="بحث برقم الطلب أو العميل أو الحالة أو المبلغ..."
                        style={{ padding: '8px 36px 8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontFamily: 'Tajawal,sans-serif', outline: 'none', minWidth: '240px', background: 'var(--card)', color: 'var(--text)' }}
                      />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { setOrderQuery(''); setOrderStatusFilter('all'); }}
                      disabled={!orderQuery && orderStatusFilter === 'all'}>
                      <RefreshCw className="h-3.5 w-3.5 ml-1" />مسح
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {/* شرائح الفلترة حسب الحالة */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {[{ key: 'all', label: 'الكل' }, ...ORDER_STATUS_KEYS.map((k) => ({ key: k, label: getStatusArabic(k) }))].map(({ key, label }) => (
                    <button key={key}
                      onClick={() => setOrderStatusFilter(key)}
                      style={key === orderStatusFilter
                        ? { padding: '6px 14px', borderRadius: '999px', fontSize: '12.5px', fontWeight: 700, border: '1px solid #4338CA', background: 'linear-gradient(135deg,#4338CA,#7C3AED)', color: '#fff', cursor: 'pointer' }
                        : { padding: '6px 14px', borderRadius: '999px', fontSize: '12.5px', fontWeight: 600, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text2)', cursor: 'pointer' }}>
                      {label} <span style={{ opacity: 0.8, marginInlineStart: 4 }}>({statusCounts[key] || 0})</span>
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>رقم الطلب</TableHead><TableHead>العميل</TableHead><TableHead>المنتجات</TableHead>
                      <TableHead>المبلغ</TableHead><TableHead>الدفع</TableHead><TableHead>الحالة</TableHead>
                      <TableHead>التاريخ</TableHead><TableHead>تفاصيل</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {filteredOrders.map((o) => (
                        <TableRow key={o.order_id} className="hover:bg-[#F8F9FA] cursor-pointer" onClick={() => setSelectedOrder(o)}>
                          <TableCell>
                            <span className="font-medium">#{o.order_number || `…${String(o.order_id).slice(-6)}`}</span>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{o.customer?.name || '—'}</p>
                            {o.customer?.phone && <p className="text-xs text-[#475569]" dir="ltr">{o.customer.phone}</p>}
                          </TableCell>
                          <TableCell className="text-sm text-[#475569]">{o.item_count ?? o.items?.length ?? 0}</TableCell>
                          <TableCell className="font-medium text-[#4338CA]">{formatMoney(o.total_amount)}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${paymentColor(o.payment_status)}`}>
                              {getPaymentStatusArabic(o.payment_status)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(o.status)}`}>
                              {getStatusArabic(o.status)}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-[#475569]">{formatDate(o.created_at)}</TableCell>
                          <TableCell>
                            <button
                              title="عرض التفاصيل والإجراءات"
                              onClick={(e) => { e.stopPropagation(); setSelectedOrder(o); }}
                              style={{ padding: '6px 10px', border: '1px solid #C7D2FE', borderRadius: '8px', background: '#EEF2FF', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#4338CA' }}>
                              <Eye className="h-3.5 w-3.5" />عرض
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredOrders.length === 0 && (
                        <TableRow><TableCell colSpan={8} className="text-center py-10">
                          <p className="text-[#94A3B8] font-medium mb-1">لا توجد طلبات مطابقة</p>
                          <p className="text-xs text-[#CBD5E1]">غيّر كلمة البحث أو الفلترة</p>
                        </TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== تبويب التوصيلات ===== */}
          <TabsContent value="deliveries">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-[#F97316]" />إدارة التوصيلات
              </CardTitle></CardHeader>
              <CardContent>{deliveries.length === 0 ? (
                <p className="text-center text-[#475569] py-8">لا توجد توصيلات.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>رقم</TableHead><TableHead>العنوان</TableHead>
                      <TableHead>المبلغ</TableHead><TableHead>السائق</TableHead>
                      <TableHead>الحالة</TableHead><TableHead>تخصيص</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{deliveries.map((d) => (
                      <TableRow key={d.order_id}>
                        <TableCell className="font-mono text-xs" dir="ltr">{d.order_id.slice(-10)}</TableCell>
                        <TableCell className="max-w-xs truncate text-sm">{d.delivery_address}</TableCell>
                        <TableCell className="font-medium">ر.ع {d.total_amount.toFixed(3)}</TableCell>
                        <TableCell>{d.driver_name ? (
                          <div><p className="font-medium text-sm">{d.driver_name}</p>
                            <p className="text-xs text-[#475569]">{d.driver_vehicle}</p></div>
                        ) : <span className="text-xs text-[#E11D48] font-medium">غير مخصص</span>}</TableCell>
                        <TableCell><span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{getStatusArabic(d.status)}</span></TableCell>
                        <TableCell>{!d.driver_id && d.status === 'confirmed' && drivers.length > 0 && (
                          <Select onValueChange={(did) => assignDriver(d.order_id, did)}>
                            <SelectTrigger className="w-[160px]"><SelectValue placeholder="تخصيص سائق" /></SelectTrigger>
                            <SelectContent>{drivers.filter(dr => dr.is_available).map((dr) => (
                              <SelectItem key={dr.driver_id} value={dr.driver_id}>{dr.name} ({dr.vehicle_type})</SelectItem>
                            ))}</SelectContent>
                          </Select>
                        )}</TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              )}</CardContent>
            </Card>
          </TabsContent>

          {/* ===== تبويب السائقون ===== */}
          <TabsContent value="drivers">
            <Card>
              <CardHeader><CardTitle>السائقون ({drivers.length})</CardTitle></CardHeader>
              <CardContent>{drivers.length === 0 ? (
                <p className="text-center text-[#475569] py-8">لا يوجد سائقون.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>الاسم</TableHead><TableHead>البريد</TableHead><TableHead>الهاتف</TableHead>
                      <TableHead>المركبة</TableHead><TableHead>الرقم</TableHead><TableHead>الحالة</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{drivers.map((d) => (
                      <TableRow key={d.driver_id}>
                        <TableCell className="font-medium">{d.name || '—'}</TableCell>
                        <TableCell dir="ltr" className="text-sm text-[#475569]">{d.email || '—'}</TableCell>
                        <TableCell dir="ltr" className="text-sm">{d.phone || '—'}</TableCell>
                        <TableCell>{d.vehicle_type}</TableCell>
                        <TableCell dir="ltr">{d.vehicle_number}</TableCell>
                        <TableCell><span className={`px-2 py-1 rounded-full text-xs font-medium ${d.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {d.is_available ? 'متاح' : 'غير متاح'}
                        </span></TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              )}</CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      {editUser    && <EditUserDialog target={editUser}   onClose={() => setEditUser(null)}   onSaved={() => { setEditUser(null);  fetchData(); }} />}
      {notifyUser  && <NotifyDialog   target={notifyUser} onClose={() => setNotifyUser(null)} />}
      {showAddUser && <AddUserDialog  onClose={() => setShowAddUser(false)}   onSaved={() => { setShowAddUser(false); fetchData(); }} />}
      {showBroadcast && <BroadcastDialog onClose={() => setShowBroadcast(false)} />}
      {selectedOrder && (
        <OrderDetailsDialog order={selectedOrder} drivers={drivers}
          onClose={() => setSelectedOrder(null)} onChanged={() => fetchData()} />
      )}

      <SupportChat />
    </div>
  );
};

export default AdminDashboard;
