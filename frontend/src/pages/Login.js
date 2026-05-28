import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { LogIn, Chrome } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(formData.email, formData.password);
      toast.success('تم تسجيل الدخول بنجاح!');
      const dest = data.user.role === 'admin' ? '/admin/dashboard'
        : data.user.role === 'merchant' ? '/merchant/dashboard'
        : data.user.role === 'driver' ? '/driver/dashboard' : '/shop';
      navigate(dest);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const redirectUrl = window.location.origin + '/auth/callback';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <LogIn className="h-12 w-12 text-[#4338CA]" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">مرحباً بعودتك</CardTitle>
          <CardDescription className="text-center">سجل الدخول إلى حسابك في سهل</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button variant="outline" className="w-full" onClick={handleGoogleLogin}>
              <Chrome className="ml-2 h-4 w-4" />
              المتابعة باستخدام Google
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">أو سجل بالبريد الإلكتروني</span>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <Button type="submit" className="w-full bg-[#4338CA] hover:bg-[#3730A3]" disabled={loading}>
                {loading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
              </Button>
              <div className="text-center text-sm">
                ليس لديك حساب؟{' '}
                <button type="button" onClick={() => navigate('/register')} className="text-[#4338CA] hover:underline font-medium">
                  سجل الآن
                </button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
