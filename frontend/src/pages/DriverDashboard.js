import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Truck, Package, ArrowRight } from 'lucide-react';
import SupportChat from '../components/SupportChat';

const getStatusArabic = (s) => ({
  pending: 'قيد الانتظار', confirmed: 'مؤكد', shipped: 'تم الشحن',
  delivered: 'تم التوصيل', cancelled: 'ملغى', paid: 'مدفوع'
}[s] || s);

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, loading: authLoading } = useAuth();
  const [driverProfile, setDriverProfile] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [form, setForm] = useState({ vehicle_type: '', vehicle_number: '', license_number: '' });

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'driver') { navigate('/shop'); return; }
    fetchData();
  }, [user, navigate, authLoading]);

  useEffect(() => {
    if (!sharingLocation) return;
    if (!navigator.geolocation) {
      toast.error('المتصفح لا يدعم الموقع'); setSharingLocation(false); return;
    }
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        try { await api.post('/drivers/location', null, {
          params: { lat: pos.coords.latitude, lng: pos.coords.longitude }
        }); } catch {}
      },
      (err) => { toast.error('فشل الموقع: ' + err.message); setSharingLocation(false); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [sharingLocation]);

  const fetchData = async () => {
    try {
      try {
        const p = await api.get('/drivers/my');
        setDriverProfile(p.data);
      } catch { setDriverProfile(null); }
      const d = await api.get('/deliveries');
      setDeliveries(d.data);
    } catch { toast.error('فشل التحميل'); }
    finally { setLoading(false); }
  };

  const registerDriver = async () => {
    try {
      await api.post('/drivers', form);
      toast.success('تم التسجيل!');
      setShowRegisterDialog(false);
      setForm({ vehicle_type: '', vehicle_number: '', license_number: '' });
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'فشل'); }
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
            <h1 className="text-2xl font-bold tracking-tight">لوحة السائق</h1>
            <p className="text-sm text-[#475569]">أدر توصيلاتك</p>
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
        {!driverProfile ? (
          <Card className="mb-8">
            <CardContent className="py-12 text-center">
              <Truck className="h-16 w-16 text-[#4338CA] mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">أكمل ملفك كسائق</h3>
              <p className="text-[#475569] mb-6">سجل لتبدأ قبول الطلبات</p>
              <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-[#4338CA] hover:bg-[#3730A3]">التسجيل كسائق</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>تسجيل السائق</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>نوع المركبة</Label>
                      <Input placeholder="دراجة نارية، سيارة..." value={form.vehicle_type}
                        onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} /></div>
                    <div><Label>رقم المركبة</Label>
                      <Input placeholder="ABC-1234" value={form.vehicle_number}
                        onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} dir="ltr" /></div>
                    <div><Label>رخصة القيادة</Label>
                      <Input value={form.license_number}
                        onChange={(e) => setForm({ ...form, license_number: e.target.value })} dir="ltr" /></div>
                    <Button className="w-full bg-[#4338CA] hover:bg-[#3730A3]" onClick={registerDriver}>إكمال</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-8">
              <CardHeader><CardTitle>معلومات السائق</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <div><p className="text-xs uppercase text-[#475569] font-semibold mb-1">المركبة</p>
                    <p className="text-lg font-medium">{driverProfile.vehicle_type}</p></div>
                  <div><p className="text-xs uppercase text-[#475569] font-semibold mb-1">الرقم</p>
                    <p className="text-lg font-medium" dir="ltr">{driverProfile.vehicle_number}</p></div>
                  <div><p className="text-xs uppercase text-[#475569] font-semibold mb-1">الحالة</p>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      driverProfile.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>{driverProfile.is_available ? 'متاح' : 'غير متاح'}</span></div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <Button
                    variant={sharingLocation ? 'destructive' : 'outline'}
                    onClick={() => {
                      if (!sharingLocation) toast.success('بدء مشاركة الموقع');
                      else toast.info('إيقاف مشاركة الموقع');
                      setSharingLocation(!sharingLocation);
                    }}>
                    {sharingLocation ? '⏹️ إيقاف الموقع المباشر' : '📍 مشاركة الموقع المباشر'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <Card className="stat-card"><CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase text-[#475569] font-semibold mb-2">النشطة</p>
                    <p className="text-3xl font-bold">{deliveries.filter(d => d.status === 'shipped').length}</p>
                  </div>
                  <Package className="h-12 w-12 text-[#4338CA] opacity-20" />
                </div>
              </CardContent></Card>
              <Card className="stat-card"><CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase text-[#475569] font-semibold mb-2">الإجمالي</p>
                    <p className="text-3xl font-bold">{deliveries.length}</p>
                  </div>
                  <Truck className="h-12 w-12 text-[#4338CA] opacity-20" />
                </div>
              </CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle>توصيلاتي</CardTitle></CardHeader>
              <CardContent>{deliveries.length === 0 ? (
                <p className="text-center text-[#475569] py-8">لا توجد توصيلات.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>رقم</TableHead><TableHead>العنوان</TableHead>
                    <TableHead>المبلغ</TableHead><TableHead>الحالة</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{deliveries.map((d) => (
                    <TableRow key={d.order_id}>
                      <TableCell className="font-mono text-sm" dir="ltr">{d.order_id}</TableCell>
                      <TableCell className="max-w-xs truncate">{d.delivery_address}</TableCell>
                      <TableCell className="font-medium">${d.total_amount.toFixed(2)}</TableCell>
                      <TableCell><span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{getStatusArabic(d.status)}</span></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}</CardContent>
            </Card>
          </>
        )}
      </div>
      <SupportChat />
    </div>
  );
};

export default DriverDashboard;
