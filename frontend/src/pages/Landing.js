import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ShoppingBag, Store, Truck, Shield } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="header-glass sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2 space-x-reverse">
            <div className="h-10 w-10 bg-gradient-to-br from-[#4338CA] to-[#F97316] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">س</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold tracking-tighter text-[#4338CA] leading-none">سهل</span>
              <span className="text-xs text-[#475569] tracking-wider">SAHAL</span>
            </div>
          </div>
          <div className="flex space-x-3 space-x-reverse">
            <Button data-testid="header-login-button" variant="outline" onClick={() => navigate('/login')}>
              تسجيل الدخول
            </Button>
            <Button data-testid="header-register-button" className="bg-[#4338CA] hover:bg-[#3730A3]" onClick={() => navigate('/register')}>
              ابدأ الآن
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-section py-20 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#0F172A] leading-tight">
                منصة <span className="text-[#4338CA]">التجارة الإلكترونية</span> المتكاملة
              </h1>
              <p className="text-lg text-[#475569] leading-relaxed">
                تسوق منتجات رائعة، بع بضائعك، أو وصّل الطلبات - كل ذلك في منصة واحدة قوية.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" className="bg-[#4338CA] hover:bg-[#3730A3] text-lg px-8" onClick={() => navigate('/shop')}>
                  ابدأ التسوق
                </Button>
                <Button size="lg" variant="outline" className="text-lg px-8" onClick={() => navigate('/register')}>
                  كن تاجراً
                </Button>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="aspect-square bg-gradient-to-br from-[#4338CA]/10 to-[#F97316]/10 rounded-3xl flex items-center justify-center">
                <ShoppingBag className="h-48 w-48 text-[#4338CA] opacity-30" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-[#F8F9FA]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight mb-4">كل ما تحتاجه</h2>
            <p className="text-lg text-[#475569]">نظام بيئي متكامل للتجارة الحديثة</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: ShoppingBag, title: 'تسوق المنتجات', desc: 'تصفح آلاف المنتجات من تجار موثوقين' },
              { icon: Store, title: 'بع بضائعك', desc: 'أنشئ متجرك وتواصل مع العملاء' },
              { icon: Truck, title: 'وصّل الطلبات', desc: 'انضم لشبكة التوصيل واربح المال' },
              { icon: Shield, title: 'مدفوعات آمنة', desc: 'طرق دفع متعددة بحماية عالية' }
            ].map((f, i) => (
              <div key={i} className="bg-white p-8 rounded-lg border border-[#E2E8F0] hover:border-[#4338CA] transition-colors duration-200">
                <f.icon className="h-12 w-12 text-[#4338CA] mb-4" />
                <h3 className="text-xl font-medium mb-2">{f.title}</h3>
                <p className="text-[#475569]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="bg-gradient-to-l from-[#4338CA] to-[#F97316] rounded-2xl p-12 text-center text-white">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">جاهز للبدء؟</h2>
            <p className="text-xl mb-8 opacity-90">انضم لآلاف المستخدمين الذين يستخدمون سهل</p>
            <Button size="lg" className="bg-white text-[#4338CA] hover:bg-gray-100 text-lg px-8" onClick={() => navigate('/register')}>
              أنشئ حسابك
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0F172A] text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-[#94A3B8]">© 2026 سهل - Sahal. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
