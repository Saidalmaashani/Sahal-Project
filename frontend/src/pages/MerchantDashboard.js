import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Store, Package, DollarSign, ArrowRight, Plus } from 'lucide-react';
import SupportChat from '../components/SupportChat';

const getStatusArabic = (s) => ({
  pending: 'قيد الانتظار', confirmed: 'مؤكد', shipped: 'تم الشحن',
  delivered: 'تم التوصيل', cancelled: 'ملغى', approved: 'موافق عليه',
  rejected: 'مرفوض', paid: 'مدفوع'
}[s] || s);

const MerchantDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStoreDialog, setShowStoreDialog] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [storeForm, setStoreForm] = useState({ name: '', description: '' });
  const [productForm, setProductForm] = useState({
    name: '', description: '', price: '', stock: '', category: '', images: ['']
  });

  useEffect(() => {
    if (!user || user.role !== 'merchant') { navigate('/shop'); return; }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      const [a, s, p, o] = await Promise.all([
        api.get('/admin/analytics'), api.get('/stores/my'),
        api.get('/products/my'), api.get('/orders')
      ]);
      setAnalytics(a.data); setStores(s.data); setProducts(p.data); setOrders(o.data);
    } catch { toast.error('فشل التحميل'); }
    finally { setLoading(false); }
  };

  const createStore = async () => {
    try {
      await api.post('/stores', storeForm);
      toast.success('تم الإنشاء! بانتظار موافقة المدير');
      setShowStoreDialog(false);
      setStoreForm({ name: '', description: '' });
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'فشل'); }
  };

  const createProduct = async () => {
    try {
      const data = {
        ...productForm,
        price: parseFloat(productForm.price),
        stock: parseInt(productForm.stock),
        images: productForm.images.filter(img => img.trim() !== '')
      };
      await api.post('/products', data);
      toast.success('تم الإنشاء!');
      setShowProductDialog(false);
      setProductForm({ name: '', description: '', price: '', stock: '', category: '', images: [''] });
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'فشل'); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA]"></div>
    </div>
  );

  const hasApprovedStore = stores.some(s => s.status === 'approved');

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-white border-b border-[#E2E8F0] py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">لوحة التاجر</h1>
            <p className="text-sm text-[#475569]">أدر متجرك ومنتجاتك</p>
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
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {[
            { label: 'إجمالي المنتجات', value: products.length, icon: Package, color: '#4338CA' },
            { label: 'إجمالي الطلبات', value: orders.length, icon: Store, color: '#4338CA' },
            { label: 'الإيرادات', value: `ر.ع ر.ع {analytics?.total_revenue?.toFixed(2) || '0.00'}`, icon: DollarSign, color: '#10B981' }
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

        <Tabs defaultValue="stores" className="space-y-4">
          <TabsList>
            <TabsTrigger value="stores">متاجري</TabsTrigger>
            <TabsTrigger value="products">المنتجات</TabsTrigger>
            <TabsTrigger value="orders">الطلبات</TabsTrigger>
          </TabsList>

          <TabsContent value="stores">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>متاجري</CardTitle>
                <Dialog open={showStoreDialog} onOpenChange={setShowStoreDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-[#4338CA] hover:bg-[#3730A3]">
                      <Plus className="h-4 w-4 ml-2" />إنشاء متجر
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>إنشاء متجر</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div><Label>اسم المتجر</Label>
                        <Input value={storeForm.name} onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })} />
                      </div>
                      <div><Label>الوصف</Label>
                        <Textarea value={storeForm.description}
                          onChange={(e) => setStoreForm({ ...storeForm, description: e.target.value })} />
                      </div>
                      <Button className="w-full bg-[#4338CA] hover:bg-[#3730A3]" onClick={createStore}>إنشاء</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {stores.length === 0 ? (
                  <p className="text-center text-[#475569] py-8">لا توجد متاجر.</p>
                ) : (
                  <div className="space-y-4">{stores.map((s) => (
                    <div key={s.store_id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-lg">{s.name}</h3>
                          <p className="text-sm text-[#475569] mt-1">{s.description}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ر.ع {
                          s.status === 'approved' ? 'bg-green-100 text-green-800' :
                          s.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>{getStatusArabic(s.status)}</span>
                      </div>
                    </div>
                  ))}</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>المنتجات</CardTitle>
                {hasApprovedStore && (
                  <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
                    <DialogTrigger asChild>
                      <Button className="bg-[#F97316] hover:bg-[#EA580C]">
                        <Plus className="h-4 w-4 ml-2" />إضافة منتج
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader><DialogTitle>منتج جديد</DialogTitle></DialogHeader>
                      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                        <div><Label>الاسم</Label><Input value={productForm.name}
                          onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></div>
                        <div><Label>الوصف</Label><Textarea value={productForm.description}
                          onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} /></div>
                        <div className="grid grid-cols-2 gap-4">
                          <div><Label>السعر</Label><Input type="number" step="0.01" value={productForm.price}
                            onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} dir="ltr" /></div>
                          <div><Label>المخزون</Label><Input type="number" value={productForm.stock}
                            onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} dir="ltr" /></div>
                        </div>
                        <div><Label>الفئة</Label><Input placeholder="إلكترونيات، أزياء..." value={productForm.category}
                          onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} /></div>
                        <div><Label>رابط الصورة</Label><Input value={productForm.images[0]}
                          onChange={(e) => setProductForm({ ...productForm, images: [e.target.value] })} dir="ltr" /></div>
                        <Button className="w-full bg-[#F97316] hover:bg-[#EA580C]" onClick={createProduct}>إضافة</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                {!hasApprovedStore ? (
                  <p className="text-center text-[#475569] py-8">تحتاج متجر معتمد أولاً.</p>
                ) : products.length === 0 ? (
                  <p className="text-center text-[#475569] py-8">لا توجد منتجات.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>المنتج</TableHead><TableHead>الفئة</TableHead>
                      <TableHead>السعر</TableHead><TableHead>المخزون</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{products.map((p) => (
                      <TableRow key={p.product_id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.category}</TableCell>
                        <TableCell>ر.ع {p.price.toFixed(2)}</TableCell>
                        <TableCell>{p.stock}</TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card><CardHeader><CardTitle>تاريخ الطلبات</CardTitle></CardHeader>
              <CardContent>{orders.length === 0 ? (
                <p className="text-center text-[#475569] py-8">لا توجد طلبات.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>رقم</TableHead><TableHead>المبلغ</TableHead>
                    <TableHead>الحالة</TableHead><TableHead>الدفع</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{orders.map((o) => (
                    <TableRow key={o.order_id}>
                      <TableCell className="font-mono text-sm" dir="ltr">{o.order_id}</TableCell>
                      <TableCell className="font-medium">ر.ع {o.total_amount.toFixed(2)}</TableCell>
                      <TableCell><span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{getStatusArabic(o.status)}</span></TableCell>
                      <TableCell><span className={`px-2 py-1 rounded-full text-xs font-medium ر.ع {
                        o.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>{getStatusArabic(o.payment_status)}</span></TableCell>
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

export default MerchantDashboard;
