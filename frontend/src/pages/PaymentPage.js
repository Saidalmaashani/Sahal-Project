import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { CreditCard, Lock, CheckCircle, ShoppingBag } from 'lucide-react';

const PaymentPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { items, deliveryAddress, total } = location.state || {};
  const [step, setStep] = useState(1); // 1=تفاصيل، 2=معالجة، 3=نجاح
  const [cardData, setCardData] = useState({
    number: '', name: '', expiry: '', cvv: ''
  });
  const [loading, setLoading] = useState(false);

  if (!items || !total) {
    navigate('/cart');
    return null;
  }

  const formatCard = (val) => {
    return val.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim().slice(0, 19);
  };

  const formatExpiry = (val) => {
    return val.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').slice(0, 5);
  };

  const handlePay = async () => {
    if (!cardData.number || !cardData.name || !cardData.expiry || !cardData.cvv) {
      toast.error('يرجى ملء جميع بيانات البطاقة');
      return;
    }
    if (cardData.number.replace(/\s/g, '').length < 16) {
      toast.error('رقم البطاقة غير صحيح');
      return;
    }

    setLoading(true);
    setStep(2);

    // محاكاة معالجة الدفع
    await new Promise(resolve => setTimeout(resolve, 2500));

    try {
      // 1) أنشئ الطلب
      const response = await api.post('/checkout', {
        items,
        delivery_address: deliveryAddress
      });

      // 2) تأكيد الدفع فوراً (mock payment)
      await api.get(`/payment/status/${response.data.session_id}`);

      // الطلب يتأكد تلقائياً من payment/status

      setStep(3);
      setLoading(false);

      setTimeout(() => {
        navigate(`/order-success?session_id=${response.data.session_id}`);
      }, 2000);

    } catch (error) {
      toast.error('فشل إتمام الطلب');
      setStep(1);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-4 py-8" style={{fontFamily: "Tajawal,Cairo,sans-serif", direction: "rtl"}}>
      <div className="w-full max-w-4xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 bg-gradient-to-br from-[#4338CA] to-[#F97316] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">س</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-[#4338CA]">سهل</span>
            <span className="text-sm text-[#475569] mr-2">| إتمام الشراء</span>
          </div>
          <div className="mr-auto flex items-center gap-1 text-sm text-[#10B981]">
            <Lock className="h-4 w-4" />
            دفع آمن ومشفر
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">

          {/* النموذج */}
          <div className="lg:col-span-3">

            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-[#4338CA]" />
                    بيانات البطاقة البنكية
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">

                  {/* أيقونات البطاقات */}
                  <div className="flex gap-2 p-3 bg-[#F8F9FA] rounded-lg">
                    {["visa","mastercard","mada"].map(c => (
                      <div key={c} style={{background:"#fff", border:"1px solid #E2E8F0", borderRadius:"6px", padding:"4px 10px", fontSize:"11px", fontWeight:600, color:"#475569", textTransform:"uppercase"}}>
                        {c === "mada" ? "مدى" : c}
                      </div>
                    ))}
                    <div style={{marginRight:"auto", fontSize:"12px", color:"#10B981", display:"flex", alignItems:"center", gap:"4px"}}>
                      <Lock style={{width:"12px",height:"12px"}} /> SSL آمن
                    </div>
                  </div>

                  {/* رقم البطاقة */}
                  <div>
                    <Label>رقم البطاقة</Label>
                    <div style={{position:"relative"}}>
                      <Input
                        value={cardData.number}
                        onChange={e => setCardData({...cardData, number: formatCard(e.target.value)})}
                        placeholder="0000 0000 0000 0000"
                        dir="ltr"
                        maxLength={19}
                        style={{paddingLeft:"48px", letterSpacing:"2px", fontSize:"16px"}}
                      />
                      <CreditCard style={{position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", color:"#94A3B8", width:"20px", height:"20px"}} />
                    </div>
                  </div>

                  {/* اسم حامل البطاقة */}
                  <div>
                    <Label>اسم حامل البطاقة</Label>
                    <Input
                      value={cardData.name}
                      onChange={e => setCardData({...cardData, name: e.target.value.toUpperCase()})}
                      placeholder="MOHAMMED AL RASHDI"
                      dir="ltr"
                      style={{letterSpacing:"1px"}}
                    />
                  </div>

                  {/* تاريخ الانتهاء و CVV */}
                  <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px"}}>
                    <div>
                      <Label>تاريخ الانتهاء</Label>
                      <Input
                        value={cardData.expiry}
                        onChange={e => setCardData({...cardData, expiry: formatExpiry(e.target.value)})}
                        placeholder="MM/YY"
                        dir="ltr"
                        maxLength={5}
                        style={{letterSpacing:"2px"}}
                      />
                    </div>
                    <div>
                      <Label>رمز الأمان CVV</Label>
                      <div style={{position:"relative"}}>
                        <Input
                          value={cardData.cvv}
                          onChange={e => setCardData({...cardData, cvv: e.target.value.replace(/\D/g,"").slice(0,4)})}
                          placeholder="***"
                          dir="ltr"
                          type="password"
                          maxLength={4}
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handlePay}
                    style={{background:"#4338CA", color:"#fff", padding:"14px", fontSize:"16px", borderRadius:"10px", border:"none", cursor:"pointer", fontFamily:"Cairo,sans-serif", fontWeight:700}}
                  >
                    <Lock className="h-4 w-4 ml-2" />
                    ادفع {total.toFixed(3)} ر.ع الآن
                  </Button>

                  <p style={{textAlign:"center", fontSize:"12px", color:"#94A3B8"}}>
                    بالضغط على "ادفع" توافق على شروط الخدمة وسياسة الخصوصية
                  </p>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <CardContent className="py-16 text-center">
                  <div style={{width:"64px", height:"64px", border:"6px solid #4338CA", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 1s linear infinite", margin:"0 auto 24px"}}></div>
                  <h3 style={{fontSize:"20px", fontWeight:700, marginBottom:"8px", fontFamily:"Cairo,sans-serif"}}>جارٍ معالجة الدفع...</h3>
                  <p style={{color:"#475569"}}>يرجى الانتظار، لا تغلق هذه الصفحة</p>
                  <div style={{marginTop:"24px", display:"flex", flexDirection:"column", gap:"8px", maxWidth:"280px", margin:"24px auto 0"}}>
                    {["التحقق من البطاقة", "تأمين المعاملة", "تأكيد الطلب"].map((s, i) => (
                      <div key={i} style={{display:"flex", alignItems:"center", gap:"8px", fontSize:"13px", color:"#475569"}}>
                        <div style={{width:"20px", height:"20px", borderRadius:"50%", background:"#4338CA", display:"flex", alignItems:"center", justifyContent:"center"}}>
                          <span style={{color:"#fff", fontSize:"11px"}}>✓</span>
                        </div>
                        {s}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card>
                <CardContent className="py-16 text-center">
                  <div style={{width:"80px", height:"80px", background:"#ECFDF5", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px"}}>
                    <CheckCircle style={{width:"48px", height:"48px", color:"#10B981"}} />
                  </div>
                  <h3 style={{fontSize:"24px", fontWeight:700, color:"#10B981", marginBottom:"8px", fontFamily:"Cairo,sans-serif"}}>تم الدفع بنجاح! 🎉</h3>
                  <p style={{color:"#475569", marginBottom:"8px"}}>شكراً لك! تم تأكيد طلبك</p>
                  <p style={{color:"#94A3B8", fontSize:"13px"}}>سيتم تحويلك للمتجر خلال ثوانٍ...</p>
                  <div style={{marginTop:"20px", background:"#F8F9FA", borderRadius:"10px", padding:"16px", textAlign:"right"}}>
                    <p style={{fontSize:"13px", color:"#475569", marginBottom:"4px"}}>المبلغ المدفوع</p>
                    <p style={{fontSize:"24px", fontWeight:700, color:"#4338CA"}}>{total.toFixed(3)} ر.ع</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ملخص الطلب */}
          <div className="lg:col-span-2">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-[#F97316]" />
                  ملخص الطلب
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item, i) => (
                  <div key={i} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"0.5px solid #F1F5F9"}}>
                    <div>
                      <p style={{fontSize:"14px", fontWeight:500}}>{item.name || `منتج ${i+1}`}</p>
                      <p style={{fontSize:"12px", color:"#94A3B8"}}>الكمية: {item.quantity}</p>
                    </div>
                    <p style={{fontSize:"14px", fontWeight:600, color:"#4338CA"}}>
                      {((item.price || 0) * item.quantity).toFixed(3)} ر.ع
                    </p>
                  </div>
                ))}

                <div style={{borderTop:"0.5px solid #E2E8F0", paddingTop:"12px"}}>
                  <div style={{display:"flex", justifyContent:"space-between", marginBottom:"8px", fontSize:"14px", color:"#475569"}}>
                    <span>المجموع الفرعي</span>
                    <span>{total.toFixed(3)} ر.ع</span>
                  </div>
                  <div style={{display:"flex", justifyContent:"space-between", marginBottom:"8px", fontSize:"14px", color:"#475569"}}>
                    <span>رسوم التوصيل</span>
                    <span style={{color:"#10B981"}}>مجاني</span>
                  </div>
                  <div style={{display:"flex", justifyContent:"space-between", fontSize:"18px", fontWeight:700, color:"#0F172A", borderTop:"0.5px solid #E2E8F0", paddingTop:"12px"}}>
                    <span>الإجمالي</span>
                    <span style={{color:"#4338CA"}}>{total.toFixed(3)} ر.ع</span>
                  </div>
                </div>

                <div style={{background:"#F8F9FA", borderRadius:"8px", padding:"12px", fontSize:"12px", color:"#475569"}}>
                  <p style={{marginBottom:"4px"}}>📦 عنوان التوصيل:</p>
                  <p style={{fontWeight:500, color:"#0F172A"}}>{deliveryAddress}</p>
                </div>

                <div style={{display:"flex", alignItems:"center", gap:"6px", fontSize:"12px", color:"#10B981", justifyContent:"center"}}>
                  <Lock style={{width:"12px", height:"12px"}} />
                  مدفوعات مؤمّنة بتشفير SSL
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default PaymentPage;