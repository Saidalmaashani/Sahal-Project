import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Users, Store, Package, DollarSign, ArrowRight, CheckCircle, XCircle, Truck, Clock, Bell } from 'lucide-react';
import SupportChat from '../components/SupportChat';

const getStatusArabic = (s) => ({
  pending: 'قيد الانتظار', confirmed: 'مؤكد', shipped: 'تم الشحن',
  delivered: 'تم التوصيل', cancelled: 'ملغى', approved: 'موافق عليه',
  rejected: 'مرفوض', paid: 'مدفوع'
}[s] || s);

const getRoleArabic = (r) => ({ admin: 'مدير', merchant: 'تاجر', shopper: 'متسوق', driver: 'سائق' }[r] || r);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, loading: authLoading } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [orders, setOrders] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') { navigate('/shop'); return; }
    fetchData();
  }, [user, navigate, authLoading]);

  const fetchData = async () => {
    try {
      const [a, u, o, s, d, dr] = await Promise.all([
        api.get('/admin/analytics'), api.get('/admin/users'),
        api.get('/orders'), api.get('/admin/stores'),
        api.get('/admin/deliveries'), api.get('/admin/drivers')
      ]);
      setAnalytics(a.data); setUsers(u.data); setOrders(o.data);
      setStores(s.data); setDeliveries(d.data); setDrivers(dr.data);
    } catch { toast.error('فشل تحميل البيانات'); }
    finally { setLoading(false); }
  };

  const approveUser = async (uid, ok) => {
    try {
      await api.patch(`/admin/users/ر.ع {uid}/approve`, null, { params: { is_approved: ok } });
      toast.success(ok ? 'تمت الموافقة' : 'تم الرفض');
      fetchData();
    } catch { toast.error('فشل'); }
  };

  const updateStoreStatus = async (sid, status) => {
    try {
      await api.patch(`/stores/ر.ع {sid}/status`, null, { params: { status } });
      toast.success('تم التحديث');
      fetchData();
    } catch { toast.error('فشل'); }
  };

  const updateOrderStatus = async (oid, status) => {
    try {
      await api.patch(`/orders/ر.ع {oid}/status`, null, { params: { status } });
      toast.success('تم التحديث');
      fetchData();
    } catch { toast.error('فشل'); }
  };

  const assignDriver = async (oid, did) => {
    try {
      await api.post(`/deliveries/ر.ع {oid}/assign`, null, { params: { driver_id: did } });
      toast.success('تم التخصيص');
      fetchData();
    } catch { toast.error('فشل'); }
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
            <h1 className="text-2xl font-bold tracking-tight">لوحة تحكم المدير</h1>
            <p className="text-sm text-[#475569]">إدارة منصتك</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/shop')}>
              <ArrowRight className="h-4 w-4 ml-2" />العودة للمتجر
            </Button>
            <Button variant="outline" onClick={async () => { await logout(); navigate('/'); }}>خروج</Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="control-grid mb-8">
          {[
            { label: 'إجمالي المستخدمين', value: analytics?.total_users || 0, icon: Users, color: '#4338CA' },
            { label: 'إجمالي المنتجات', value: analytics?.total_products || 0, icon: Package, color: '#4338CA' },
            { label: 'إجمالي الطلبات', value: analytics?.total_orders || 0, icon: Store, color: '#4338CA' },
            { label: 'إجمالي الإيرادات', value: `ر.ع ر.ع {analytics?.total_revenue?.toFixed(2) || '0.00'}`, icon: DollarSign, color: '#10B981' }
          ].map((s, i) => (
            <Card key={i} className="stat-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[#475569] font-semibold mb-2">{s.label}</p>
                    <p className="text-3xl font-bold" style={{color: s.color === '#10B981' ? s.color : ''}}>{s.value}</p>
                  </div>
                  <s.icon className="h-12 w-12 opacity-20" style={{color: s.color}} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">المستخدمون</TabsTrigger>
            <TabsTrigger value="stores">المتاجر</TabsTrigger>
            <TabsTrigger value="orders">الطلبات</TabsTrigger>
            <TabsTrigger value="deliveries">التوصيلات</TabsTrigger>
            <TabsTrigger value="drivers">السائقون</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card><CardHeader><CardTitle>إدارة المستخدمين</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>الاسم</TableHead><TableHead>البريد</TableHead>
                    <TableHead>الدور</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{users.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell>{u.name}</TableCell>
                      <TableCell dir="ltr">{u.email}</TableCell>
                      <TableCell>{getRoleArabic(u.role)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ر.ع {
                          u.is_approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>{u.is_approved ? 'موافق عليه' : 'قيد الانتظار'}</span>
                      </TableCell>
                      <TableCell>{!u.is_approved && u.role === 'merchant' && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => approveUser(u.user_id, true)}>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => approveUser(u.user_id, false)}>
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      )}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stores">
            <Card><CardHeader><CardTitle>الموافقة على المتاجر</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>المتجر</TableHead><TableHead>التاجر</TableHead>
                    <TableHead>الوصف</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{stores.map((s) => (
                    <TableRow key={s.store_id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell><div className="text-sm">
                        <p className="font-medium">{s.merchant_name || '—'}</p>
                        <p className="text-xs text-[#475569]" dir="ltr">{s.merchant_email || ''}</p>
                      </div></TableCell>
                      <TableCell className="max-w-xs truncate">{s.description}</TableCell>
                      <TableCell><span className={`px-2 py-1 rounded-full text-xs font-medium ر.ع {
                        s.status === 'approved' ? 'bg-green-100 text-green-800' :
                        s.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>{getStatusArabic(s.status)}</span></TableCell>
                      <TableCell>{s.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => updateStoreStatus(s.store_id, 'approved')}>موافقة</Button>
                          <Button size="sm" variant="destructive" onClick={() => updateStoreStatus(s.store_id, 'rejected')}>رفض</Button>
                        </div>
                      )}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card><CardHeader><CardTitle>جميع الطلبات</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>رقم</TableHead><TableHead>المبلغ</TableHead>
                    <TableHead>الحالة</TableHead><TableHead>الدفع</TableHead><TableHead>إجراءات</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{orders.map((o) => (
                    <TableRow key={o.order_id}>
                      <TableCell className="font-mono text-sm" dir="ltr">{o.order_id}</TableCell>
                      <TableCell className="font-medium">ر.ع {o.total_amount.toFixed(2)}</TableCell>
                      <TableCell><span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{getStatusArabic(o.status)}</span></TableCell>
                      <TableCell><span className={`px-2 py-1 rounded-full text-xs font-medium ر.ع {
                        o.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>{getStatusArabic(o.payment_status)}</span></TableCell>
                      <TableCell>
                        <Select value={o.status} onValueChange={(v) => updateOrderStatus(o.order_id, v)}>
                          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">قيد الانتظار</SelectItem>
                            <SelectItem value="confirmed">مؤكد</SelectItem>
                            <SelectItem value="shipped">تم الشحن</SelectItem>
                            <SelectItem value="delivered">تم التوصيل</SelectItem>
                            <SelectItem value="cancelled">ملغى</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deliveries">
            <Card><CardHeader><CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#F97316]" />إدارة التوصيلات
            </CardTitle></CardHeader>
              <CardContent>{deliveries.length === 0 ? (
                <p className="text-center text-[#475569] py-8">لا توجد توصيلات.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>رقم</TableHead><TableHead>العنوان</TableHead>
                    <TableHead>المبلغ</TableHead><TableHead>السائق</TableHead>
                    <TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{deliveries.map((d) => (
                    <TableRow key={d.order_id}>
                      <TableCell className="font-mono text-xs" dir="ltr">{d.order_id}</TableCell>
                      <TableCell className="max-w-xs truncate">{d.delivery_address}</TableCell>
                      <TableCell className="font-medium">ر.ع {d.total_amount.toFixed(2)}</TableCell>
                      <TableCell>{d.driver_name ? (
                        <div className="text-sm"><p className="font-medium">{d.driver_name}</p>
                          <p className="text-xs text-[#475569]">{d.driver_vehicle}</p></div>
                      ) : <span className="text-xs text-[#E11D48] font-medium">غير مخصص</span>}</TableCell>
                      <TableCell><span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{getStatusArabic(d.status)}</span></TableCell>
                      <TableCell>{!d.driver_id && d.status === 'confirmed' && drivers.length > 0 && (
                        <Select onValueChange={(did) => assignDriver(d.order_id, did)}>
                          <SelectTrigger className="w-[180px]"><SelectValue placeholder="تخصيص" /></SelectTrigger>
                          <SelectContent>{drivers.filter(dr => dr.is_available).map((dr) => (
                            <SelectItem key={dr.driver_id} value={dr.driver_id}>
                              {dr.name} ({dr.vehicle_type})
                            </SelectItem>
                          ))}</SelectContent>
                        </Select>
                      )}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drivers">
            <Card><CardHeader><CardTitle>السائقون</CardTitle></CardHeader>
              <CardContent>{drivers.length === 0 ? (
                <p className="text-center text-[#475569] py-8">لا يوجد سائقون.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>الاسم</TableHead><TableHead>البريد</TableHead>
                    <TableHead>المركبة</TableHead><TableHead>الرقم</TableHead><TableHead>الحالة</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{drivers.map((d) => (
                    <TableRow key={d.driver_id}>
                      <TableCell>{d.name || '—'}</TableCell>
                      <TableCell dir="ltr">{d.email || '—'}</TableCell>
                      <TableCell>{d.vehicle_type}</TableCell>
                      <TableCell dir="ltr">{d.vehicle_number}</TableCell>
                      <TableCell><span className={`px-2 py-1 rounded-full text-xs font-medium ر.ع {
                        d.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>{d.is_available ? 'متاح' : 'غير متاح'}</span></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}</CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <SupportChat />
    </div>
  );
};

export default AdminDashboard;
