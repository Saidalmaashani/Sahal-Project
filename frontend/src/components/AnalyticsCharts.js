import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, BarChart2, PieChart as PieIcon, Calendar } from 'lucide-react';
import api from '../utils/api';

const COLORS = ['#4338CA', '#7C3AED', '#10B981', '#F97316', '#E11D48', '#F59E0B'];

const ChartCard = ({ title, icon: Icon, color, children, loading }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    style={{
      background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0',
      padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: 17, height: 17, color }} />
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 }}>{title}</h3>
    </div>
    {loading ? (
      <div style={{ height: 200, background: '#F8FAFC', borderRadius: 10, animation: 'shimmer 1.5s ease-in-out infinite' }} />
    ) : children}
    <style>{`@keyframes shimmer{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
  </motion.div>
);

// Tooltip مخصص عربي
const ArabicTooltip = ({ active, payload, label, unit = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontFamily: 'Tajawal,sans-serif', direction: 'rtl' }}>
      {label && <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 6px' }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: 13, fontWeight: 700, color: p.color, margin: '2px 0' }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString('ar') : p.value} {unit}
        </p>
      ))}
    </div>
  );
};

const AnalyticsCharts = ({ role = 'admin' }) => {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/analytics/charts')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hasCategoryData = data?.top_categories?.some(c => c.revenue > 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, fontFamily: 'Tajawal,Cairo,sans-serif' }}>

      {/* 1. الإيرادات الشهرية */}
      <ChartCard title="الإيرادات الشهرية" icon={TrendingUp} color="#4338CA" loading={loading}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data?.monthly_revenue || []} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4338CA" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#4338CA" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'Tajawal,sans-serif', fill: '#64748B' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fontFamily: 'Tajawal,sans-serif', fill: '#64748B' }} axisLine={false} tickLine={false} width={45} />
            <Tooltip content={<ArabicTooltip unit="ر.ع" />} />
            <Area type="monotone" dataKey="revenue" name="الإيرادات" stroke="#4338CA" strokeWidth={2.5} fill="url(#revenueGrad)" dot={{ fill: '#4338CA', r: 4 }} activeDot={{ r: 6 }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 2. الطلبات اليومية */}
      <ChartCard title="الطلبات - آخر 14 يوم" icon={Calendar} color="#10B981" loading={loading}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data?.daily_orders || []} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fontFamily: 'Tajawal,sans-serif', fill: '#64748B' }} axisLine={false} tickLine={false} interval={2} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fontFamily: 'Tajawal,sans-serif', fill: '#64748B' }} axisLine={false} tickLine={false} width={30} />
            <Tooltip content={<ArabicTooltip unit="طلب" />} />
            <Line type="monotone" dataKey="orders" name="الطلبات" stroke="#10B981" strokeWidth={2.5} dot={{ fill: '#10B981', r: 3 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 3. أفضل الفئات */}
      <ChartCard title="إيرادات الفئات" icon={BarChart2} color="#F97316" loading={loading}>
        {hasCategoryData ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.top_categories || []} margin={{ top: 5, right: 5, bottom: 30, left: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fontFamily: 'Tajawal,sans-serif', fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="category" type="category" tick={{ fontSize: 11, fontFamily: 'Tajawal,sans-serif', fill: '#64748B' }} axisLine={false} tickLine={false} width={90} />
              <Tooltip content={<ArabicTooltip unit="ر.ع" />} />
              <Bar dataKey="revenue" name="الإيرادات" radius={[0, 6, 6, 0]} maxBarSize={22}>
                {data?.top_categories?.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 13 }}>
            لا توجد بيانات كافية بعد
          </div>
        )}
      </ChartCard>

      {/* 4. توزيع الحالات — admin فقط */}
      {role === 'admin' && (
        <ChartCard title="توزيع حالات الطلبات" icon={PieIcon} color="#7C3AED" loading={loading}>
          {data?.status_distribution?.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie
                    data={data.status_distribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    innerRadius={52} outerRadius={80}
                    paddingAngle={3}
                  >
                    {data.status_distribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ArabicTooltip unit="طلب" />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {data.status_distribution.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color || COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#475569', flex: 1 }}>{s.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 13 }}>
              لا توجد بيانات بعد
            </div>
          )}
        </ChartCard>
      )}

      {/* 5. مقارنة الطلبات والإيرادات الشهرية */}
      <ChartCard title="الطلبات الشهرية" icon={BarChart2} color="#F59E0B" loading={loading}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data?.monthly_revenue || []} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'Tajawal,sans-serif', fill: '#64748B' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fontFamily: 'Tajawal,sans-serif', fill: '#64748B' }} axisLine={false} tickLine={false} width={30} />
            <Tooltip content={<ArabicTooltip unit="طلب" />} />
            <Bar dataKey="orders" name="الطلبات" fill="#F59E0B" radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

    </div>
  );
};

export default AnalyticsCharts;
