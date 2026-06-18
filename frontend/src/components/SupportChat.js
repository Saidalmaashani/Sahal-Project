import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Sparkles, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const SUGGESTIONS = [
  'كيف أتتبع طلبي؟',
  'ما هي طرق الدفع المتاحة؟',
  'كيف أنشئ متجراً؟',
  'برنامج الإحالة يمنحك كم؟',
];

const TypingDots = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 14px', background: '#F1F5F9', borderRadius: '4px 16px 16px 16px', width: 'fit-content' }}>
    {[0, 1, 2].map(i => (
      <motion.span
        key={i}
        animate={{ y: [0, -5, 0] }}
        transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
        style={{ width: 7, height: 7, borderRadius: '50%', background: '#94A3B8', display: 'block' }}
      />
    ))}
  </div>
);

const SupportChat = () => {
  const { user } = useAuth();
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [hasNew, setHasNew]     = useState(false);
  const endRef    = useRef(null);
  const inputRef  = useRef(null);
  const isFirst   = messages.length === 0;

  // رسالة ترحيب عند الفتح الأول
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: 'welcome', role: 'ai',
        text: `مرحباً ${user?.name?.split(' ')[0] || ''} 👋\nأنا مساعدك الذكي في سهل. كيف يمكنني مساعدتك اليوم؟`,
        time: new Date(),
      }]);
    }
    if (open) { setHasNew(false); setTimeout(() => inputRef.current?.focus(), 100); }
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg = { id: Date.now(), role: 'user', text: msg, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const r = await api.post('/chat', null, { params: { message: msg } });
      const aiMsg = { id: Date.now() + 1, role: 'ai', text: r.data.response, time: new Date() };
      setMessages(prev => [...prev, aiMsg]);
      if (!open) setHasNew(true);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'ai',
        text: 'عذراً، حدث خطأ مؤقت. حاول مرة أخرى.',
        time: new Date(),
      }]);
    } finally { setLoading(false); }
  }, [input, loading, open]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!user) return null;

  const fmt = (d) => d?.toLocaleTimeString('ar-OM', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      {/* زر الفتح */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', left: '1.5rem',
          bottom: 'max(1.5rem, env(safe-area-inset-bottom))',
          zIndex: 50,
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg,#4338CA,#7C3AED)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(67,56,202,0.45)',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.span key={open ? 'close' : 'open'} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }} transition={{ duration: 0.18 }} style={{ display: 'flex' }}>
            {open ? <X style={{ width: 22, height: 22, color: '#fff' }} /> : <MessageCircle style={{ width: 22, height: 22, color: '#fff' }} />}
          </motion.span>
        </AnimatePresence>
        {hasNew && !open && (
          <span style={{ position: 'absolute', top: 3, right: 3, width: 10, height: 10, borderRadius: '50%', background: '#E11D48', border: '2px solid #fff' }} />
        )}
      </motion.button>

      {/* نافذة الدردشة */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            style={{
              position: 'fixed', zIndex: 50,
              left: '1rem', right: '1rem',
              bottom: 'calc(max(1.5rem, env(safe-area-inset-bottom)) + 68px)',
              maxWidth: 400, margin: '0 auto',
              height: 'min(520px, calc(100svh - 160px))',
              background: '#fff', borderRadius: 20,
              boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
              border: '1px solid #E2E8F0',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif',
            }}
          >
            {/* Header */}
            <div style={{ padding: '14px 18px', background: 'linear-gradient(135deg,#4338CA,#7C3AED)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Sparkles style={{ width: 18, height: 18, color: '#fff' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 800, fontSize: 15, color: '#fff', margin: 0, lineHeight: 1.2 }}>مساعد سهل</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', display: 'inline-block' }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>متصل الآن · مدعوم بـ Claude AI</span>
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8, display: 'flex' }}>
                <ChevronDown style={{ width: 20, height: 20, color: 'rgba(255,255,255,0.8)' }} />
              </button>
            </div>

            {/* رسائل */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <AnimatePresence initial={false}>
                {messages.map(msg => {
                  const isUser = msg.role === 'user';
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-start' : 'flex-end' }}
                    >
                      <div style={{
                        maxWidth: '82%', padding: '10px 14px',
                        borderRadius: isUser ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                        background: isUser ? '#4338CA' : '#F1F5F9',
                        color: isUser ? '#fff' : '#0F172A',
                        fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {msg.text}
                      </div>
                      <span style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>{fmt(msg.time)}</span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <TypingDots />
                </motion.div>
              )}

              {/* اقتراحات عند أول فتح */}
              {isFirst && !loading && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                  {SUGGESTIONS.map(s => (
                    <motion.button
                      key={s}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => sendMessage(s)}
                      style={{
                        padding: '6px 12px', borderRadius: 20, border: '1.5px solid #C7D2FE',
                        background: '#EEF2FF', color: '#4338CA', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'Tajawal,sans-serif',
                        transition: 'all 0.15s',
                      }}
                    >
                      {s}
                    </motion.button>
                  ))}
                </div>
              )}

              <div ref={endRef} />
            </div>

            {/* حقل الإدخال */}
            <div style={{ padding: '10px 12px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="اكتب سؤالك..."
                rows={1}
                disabled={loading}
                style={{
                  flex: 1, padding: '9px 12px', border: '1.5px solid #E2E8F0',
                  borderRadius: 12, fontSize: 14, fontFamily: 'Tajawal,sans-serif',
                  resize: 'none', outline: 'none', maxHeight: 80, overflow: 'auto',
                  lineHeight: 1.5, transition: 'border-color 0.2s', color: '#0F172A',
                }}
                onFocus={e => e.target.style.borderColor = '#4338CA'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                style={{
                  width: 38, height: 38, borderRadius: '50%', border: 'none', flexShrink: 0,
                  background: input.trim() && !loading ? 'linear-gradient(135deg,#4338CA,#7C3AED)' : '#E2E8F0',
                  cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
              >
                <Send style={{ width: 16, height: 16, color: input.trim() && !loading ? '#fff' : '#94A3B8' }} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SupportChat;
