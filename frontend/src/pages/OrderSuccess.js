import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { CheckCircle, Loader } from 'lucide-react';

const OrderSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) { navigate('/shop'); return; }
    checkPaymentStatus();
  }, [sessionId]);

  const checkPaymentStatus = async () => {
    let attempts = 0;
    const interval = setInterval(async () => {
      if (attempts >= 5) { clearInterval(interval); setChecking(false); return; }
      try {
        const response = await api.get(`/payment/status/ر.ع {sessionId}`);
        if (response.data.payment_status === 'paid') {
          setPaymentStatus('success'); setChecking(false); clearInterval(interval);
        }
      } catch {}
      attempts++;
    }, 2000);
    return () => clearInterval(interval);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {checking ? 'جارٍ معالجة الدفع...' : paymentStatus === 'success' ? 'تم تأكيد الطلب!' : 'مشكلة في الدفع'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          {checking && <>
            <Loader className="h-16 w-16 text-[#4338CA] mx-auto animate-spin" />
            <p className="text-[#475569]">يرجى الانتظار...</p>
          </>}
          {!checking && paymentStatus === 'success' && <>
            <CheckCircle className="h-16 w-16 text-[#10B981] mx-auto" />
            <h3 className="text-xl font-semibold">شكراً لطلبك!</h3>
            <Button className="w-full bg-[#4338CA] hover:bg-[#3730A3]" onClick={() => navigate('/shop')}>
              متابعة التسوق
            </Button>
          </>}
          {!checking && paymentStatus !== 'success' && <>
            <div className="text-4xl">⚠️</div>
            <h3 className="text-xl font-semibold">مشكلة في الدفع</h3>
            <Button className="w-full" onClick={() => navigate('/cart')}>العودة للسلة</Button>
          </>}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderSuccess;
