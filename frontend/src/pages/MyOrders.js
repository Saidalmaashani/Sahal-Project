import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Package, Truck, CheckCircle, Clock, XCircle, MessageCircle } from 'lucide-react';
import SupportChat from '../components/SupportChat';
import OrderChat from '../components/OrderChat';

const OrderSkeleton = () => (
  <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #E2E8F0' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
      <div>
        <div style={{ width: '120px', height: '12px', background: '#F1F5F9', borderRadius: '6px', marginBottom: '8px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
        <div style={{ width: '80px', height: '12px', background: '#F1F5F9', borderRadius: '6px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
      </div>
      <div style={{ width: '70px', height: '24px', background: '#F1F5F9', borderRadius: '20px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
    </div>
    <div style={{ width: '60%', height: '12px', background: '#F1F5F9', borderRadius: '6px', marginBottom: '16px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
    <div style={{ display: 'flex', gap: '8px' }}>
      <div style={{ width: '90px', height: '32px', background: '#F1F5F9', borderRadius: '8px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
      <div style={{ width: '70px', height: '32px', background: '#F1F5F9', borderRadius: '8px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
    </div>
    <style>{`@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
  </div>
);

const STATUS_MAP = {
  pending:   { label: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  confirmed: { label: 'مؤكد',          color: 'bg-blue-100 text-blue-800',   icon: Package },
  shipped:   { label: 'في الطريق',     color: 'bg-purple-100 text-purple-800', icon: Truck },
  delivered: { label: 'تم التوصيل',    color: 'bg-green-100 text-green-800',  icon: CheckCircle },
  cancelled: { label: 'ملغى',          color: 'bg-red-100 text-red-800',      icon: XCircle },
};

const MyOrders = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [chatOrder, setChatOrder] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    api.get('/orders')
      .then(r => setOrders(r.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))))
      .catch(() => toast.error('فشل تحميل الطلبات'))
      .finally(() => setLoading(false));
  }, [user, authLoading, navigate]);

  if (loading) return (
    <div className="min-h-screen bg-[#F8F9FA]" style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif' }}>
      <header className="bg-white border-b border-[#E2E8F0] py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div>
            <div style={{ width: '80px', height: '24px', background: '#F1F5F9', borderRadius: '8px', marginBottom: '6px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
            <div style={{ width: '50px', height: '14px', background: '#F1F5F9', borderRadius: '6px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      </header>
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-4">
        {[1,2,3].map(i => <OrderSkeleton key={i} />)}
      </div>
      <style>{`@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA]" style={{ direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif' }}>
      <header className="bg-white border-b border-[#E2E8F0] py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">طلباتي</h1>
            <p className="text-sm text-[#475569]">{orders.length} طلب</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/shop')}>
            <ArrowRight className="h-4 w-4 ml-2" />متابعة التسوق
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {orders.length === 0 ? (
          <Card><CardContent className="py-16 text-center">
            <Package className="h-16 w-16 text-[#4338CA] mx-auto mb-4 opacity-30" />
            <p className="text-lg text-[#475569] mb-4">لا توجد طلبات بعد</p>
            <Button className="bg-[#4338CA] hover:bg-[#3730A3]" onClick={() => navigate('/shop')}>
              ابدأ التسوق
            </Button>
          </CardContent></Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order, idx) => {
              const s = STATUS_MAP[order.status] || STATUS_MAP.pending;
              const Icon = s.icon;
              return (
                <motion.div
                  key={order.order_id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06, duration: 0.25 }}
                >
                <Card className="hover:border-[#4338CA] transition-colors hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-mono text-xs text-[#475569] mb-1" dir="ltr">{order.order_id}</p>
                        <p className="text-sm text-[#475569]">
                          {new Date(order.created_at).toLocaleDateString('ar-OM', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${s.color}`}>
                        <Icon className="h-3 w-3" />{s.label}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-t pt-3">
                      <div>
                        <p className="text-xs text-[#475569] mb-1">المبلغ الإجمالي</p>
                        <p className="text-xl font-bold text-[#4338CA]">ر.ع {order.total_amount.toFixed(3)}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-[#475569] mb-1">عنوان التوصيل</p>
                        <p className="text-sm font-medium max-w-[200px] truncate">{order.delivery_address}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      {(order.status === 'shipped' || order.status === 'confirmed') && (
                        <Button variant="outline" size="sm" className="flex-1 border-[#4338CA] text-[#4338CA]"
                          onClick={() => navigate(`/track/${order.order_id}`)}>
                          <Truck className="h-4 w-4 ml-2" />تتبع الطلب
                        </Button>
                      )}
                      {order.status !== 'cancelled' && (
                        <Button variant="outline" size="sm"
                          className={`${(order.status === 'shipped' || order.status === 'confirmed') ? '' : 'w-full'} border-[#7C3AED] text-[#7C3AED]`}
                          onClick={() => setChatOrder(order)}>
                          <MessageCircle className="h-4 w-4 ml-2" />محادثة
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
      {chatOrder && (
        <OrderChat
          orderId={chatOrder.order_id}
          orderLabel={chatOrder.order_id.slice(-8)}
          onClose={() => setChatOrder(null)}
        />
      )}
      <SupportChat />
    </div>
  );
};

export default MyOrders;
