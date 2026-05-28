import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    email: '', password: '', name: '', role: 'shopper',
    phone: '', address: '', referral_code: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setFormData(prev => ({ ...prev, referral_code: ref.toUpperCase() }));
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...formData };
      if (!payload.referral_code) delete payload.referral_code;
      await register(payload);
      toast.success('تم إنشاء الحساب بنجاح!');
      const dest = formData.role === 'admin' ? '/admin/dashboard'
        : formData.role === 'merchant' ? '/merchant/dashboard'
        : formData.role === 'driver' ? '/driver/dashboard' : '/shop';
      navigate(dest);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل التسجيل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <UserPlus className="h-12 w-12 text-[#4338CA]" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">إنشاء حساب</CardTitle>
          <CardDescription className="text-center">انضم إلى سهل وابدأ رحلتك</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">الاسم الكامل</Label>
              <Input id="name" placeholder="محمد أحمد" value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" placeholder="example@email.com" value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })} required dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input id="password" type="password" placeholder="••••••••" value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })} required dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">أرغب في</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shopper">التسوق</SelectItem>
                  <SelectItem value="merchant">البيع</SelectItem>
                  <SelectItem value="driver">التوصيل</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">الهاتف (اختياري)</Label>
              <Input id="phone" placeholder="+966501234567" value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">العنوان (اختياري)</Label>
              <Input id="address" placeholder="الرياض، شارع الملك فهد" value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referral_code">رمز الإحالة (اختياري) 🎁</Label>
              <Input id="referral_code" placeholder="SAHAL123ABC" value={formData.referral_code}
                onChange={(e) => setFormData({ ...formData, referral_code: e.target.value.toUpperCase() })}
                dir="ltr" className="font-mono" />
            </div>
            <Button type="submit" className="w-full bg-[#4338CA] hover:bg-[#3730A3]" disabled={loading}>
              {loading ? 'جارٍ إنشاء الحساب...' : 'إنشاء حساب'}
            </Button>
            <div className="text-center text-sm">
              لديك حساب بالفعل؟{' '}
              <button type="button" onClick={() => navigate('/login')} className="text-[#4338CA] hover:underline font-medium">
                سجل الدخول
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
