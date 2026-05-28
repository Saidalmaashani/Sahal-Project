import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { ArrowRight, Copy, Users, Gift, DollarSign, Share2, Trophy } from 'lucide-react';
import SupportChat from '../components/SupportChat';

const Referrals = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    fetchAll();
  }, [user, navigate, authLoading]);

  const fetchAll = async () => {
    try {
      const [r, l] = await Promise.all([
        api.get('/referrals/my'),
        api.get('/referrals/leaderboard')
      ]);
      setData(r.data);
      setLeaderboard(l.data);
    } catch { toast.error('فشل التحميل'); }
    finally { setLoading(false); }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(data.referral_code);
    toast.success('تم نسخ الرمز!');
  };

  const shareLink = () => {
    const link = `${window.location.origin}/register?ref=${data.referral_code}`;
    navigator.clipboard.writeText(link);
    toast.success('تم نسخ الرابط!');
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
            <h1 className="text-2xl font-bold tracking-tight">برنامج الإحالات</h1>
            <p className="text-sm text-[#475569]">ادعُ أصدقاءك واربح</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/shop')}>
            <ArrowRight className="h-4 w-4 ml-2" />العودة
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        <Card className="bg-gradient-to-l from-[#4338CA] to-[#F97316] text-white">
          <CardContent className="p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-4">ادعُ صديقاً واربح 10% من أول طلب</h2>
                <Button onClick={shareLink} className="bg-white text-[#4338CA] hover:bg-gray-100">
                  <Share2 className="h-4 w-4 ml-2" />نسخ رابط الدعوة
                </Button>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-6">
                <p className="text-sm uppercase mb-3 opacity-80">رمزك</p>
                <div className="flex items-center justify-between bg-white text-[#0F172A] rounded-lg p-4">
                  <span className="font-mono text-2xl font-bold tracking-wider" dir="ltr">{data?.referral_code}</span>
                  <Button size="sm" onClick={copyCode} className="bg-[#4338CA] hover:bg-[#3730A3]">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { label: 'المدعوين', value: data?.total_referred || 0, icon: Users, color: '#4338CA' },
            { label: 'مكافآت', value: data?.total_rewarded || 0, icon: Gift, color: '#F97316' },
            { label: 'الأرباح', value: `$${data?.total_earnings?.toFixed(2) || '0.00'}`, icon: DollarSign, color: '#10B981' }
          ].map((s, i) => (
            <Card key={i} className="stat-card"><CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-[#475569] font-semibold mb-2">{s.label}</p>
                  <p className="text-3xl font-bold" style={{color: s.color === '#10B981' || s.color === '#F97316' ? s.color : ''}}>{s.value}</p>
                </div>
                <s.icon className="h-12 w-12 opacity-20" style={{color: s.color}} />
              </div>
            </CardContent></Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-[#F97316]" />لوحة المتصدرين 🏆
          </CardTitle></CardHeader>
          <CardContent>{leaderboard.length === 0 ? (
            <p className="text-center text-[#475569] py-8">كن أول من يدعو!</p>
          ) : (
            <div className="space-y-3">{leaderboard.map((e, i) => (
              <div key={e.user_id} className={`flex items-center justify-between p-4 rounded-lg border ${
                e.user_id === user.user_id ? 'bg-[#4338CA]/5 border-[#4338CA]' : 'bg-white border-[#E2E8F0]'
              }`}>
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#F8F9FA]">
                    <span className="font-bold">{i + 1}</span>
                  </div>
                  <div>
                    <p className="font-semibold">{e.name}
                      {e.user_id === user.user_id && <span className="text-xs bg-[#4338CA] text-white px-2 py-0.5 rounded-full mr-2">أنت</span>}
                    </p>
                    <p className="text-xs text-[#475569] font-mono" dir="ltr">{e.referral_code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-left">
                  <div><p className="text-xs uppercase text-[#475569]">إحالات</p>
                    <p className="font-bold text-lg">{e.total_referred}</p></div>
                  <div><p className="text-xs uppercase text-[#475569]">أرباح</p>
                    <p className="font-bold text-lg text-[#10B981]">${e.referral_earnings.toFixed(2)}</p></div>
                </div>
              </div>
            ))}</div>
          )}</CardContent>
        </Card>
      </div>
      <SupportChat />
    </div>
  );
};

export default Referrals;
