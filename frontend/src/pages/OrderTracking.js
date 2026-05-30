import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { ArrowRight, Truck, MapPin, Phone, Clock, Package } from 'lucide-react';

const getStatusArabic = (s) => ({
  pending: 'قيد الانتظار', confirmed: 'مؤكد - يتم التجهيز',
  shipped: 'في الطريق إليك', delivered: 'تم التوصيل', cancelled: 'ملغى'
}[s] || s);

const OrderTracking = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    fetchTracking();
    pollRef.current = setInterval(fetchTracking, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [orderId, user, authLoading]);

  const fetchTracking = async () => {
    try {
      const r = await api.get(`/orders/${orderId}/tracking`);
      setTracking(r.data);
    } catch (e) { toast.error(e.response?.data?.detail || 'فشل التحميل'); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA]"></div>
    </div>
  );

  if (!tracking) return (
    <div className="min-h-screen flex items-center justify-center">
      <p>لم يتم العثور على الطلب</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-white border-b border-[#E2E8F0] py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">تتبع الطلب</h1>
            <p className="text-sm text-[#475569] font-mono" dir="ltr">{orderId}</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/shop')}>
            <ArrowRight className="h-4 w-4 ml-2" />العودة
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card><CardContent className="p-6 text-center bg-gradient-to-br from-[#4338CA]/5 to-[#F97316]/5" style={{minHeight: '500px'}}>
              <Truck className="h-24 w-24 text-[#4338CA] mx-auto mt-32 mb-4" />
              <h3 className="text-xl font-bold mb-2">{getStatusArabic(tracking.status)}</h3>
              {tracking.driver_location ? (
                <p className="text-[#475569]">
                  موقع السائق: {tracking.driver_location.lat.toFixed(4)}, {tracking.driver_location.lng.toFixed(4)}
                </p>
              ) : (
                <p className="text-[#475569]">{tracking.driver_info ? '⏳ بانتظار موقع السائق' : '📦 سيتم تخصيص سائق'}</p>
              )}
              <p className="text-xs text-[#475569] mt-8">💡 للخريطة الكاملة: ثبّت react-leaflet</p>
            </CardContent></Card>
          </div>
          <div className="space-y-4">
            <Card><CardHeader><CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-[#4338CA]" />حالة الطلب
            </CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><p className="text-xs uppercase text-[#475569] mb-1">الحالة</p>
                  <p className="text-lg font-bold text-[#4338CA]">{getStatusArabic(tracking.status)}</p></div>
                <div><p className="text-xs uppercase text-[#475569] mb-1">المبلغ</p>
                  <p className="text-lg font-medium">ر.ع {tracking.total_amount.toFixed(2)}</p></div>
                <div><p className="text-xs uppercase text-[#475569] mb-1">العنوان</p>
                  <p className="text-sm flex items-start gap-1">
                    <MapPin className="h-4 w-4 text-[#F97316] mt-0.5" />{tracking.delivery_address}
                  </p></div>
              </CardContent>
            </Card>
            {tracking.driver_info && (
              <Card><CardHeader><CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-[#F97316]" />السائق
              </CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div><p className="text-xs uppercase text-[#475569] mb-1">الاسم</p>
                    <p className="font-medium">{tracking.driver_info.name}</p></div>
                  {tracking.driver_info.phone && (
                    <div><p className="text-xs uppercase text-[#475569] mb-1">الهاتف</p>
                      <a href={`tel:${tracking.driver_info.phone}`} className="text-[#4338CA] flex items-center gap-1" dir="ltr">
                        <Phone className="h-4 w-4" />{tracking.driver_info.phone}
                      </a></div>
                  )}
                  <div><p className="text-xs uppercase text-[#475569] mb-1">المركبة</p>
                    <p className="text-sm">{tracking.driver_info.vehicle_type} - <span dir="ltr">{tracking.driver_info.vehicle_number}</span></p></div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderTracking;
