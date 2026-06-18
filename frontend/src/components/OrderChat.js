import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import { useWebSocket } from '../hooks/useWebSocket';

const ROLE_LABELS = { shopper: 'زبون', merchant: 'تاجر', driver: 'مندوب', admin: 'مدير' };
const ROLE_COLORS = { shopper: '#4338CA', merchant: '#F97316', driver: '#10B981', admin: '#7C3AED' };

const OrderChat = ({ orderId, orderLabel, onClose }) => {
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    try {
      const r = await api.get(`/orders/${orderId}/messages`);
      setMessages(r.data);
    } catch {}
    finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // WebSocket — رسائل فورية
  useWebSocket({
    path: `/ws/chat/${orderId}`,
    token,
    onMessage: (data) => {
      if (data.type === 'chat_message') {
        setMessages(prev => {
          if (prev.find(m => m.message_id === data.message_id)) return prev;
          return [...prev, data];
        });
      }
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const optimistic = {
      message_id: `tmp_${Date.now()}`,
      sender_id: user?.user_id,
      sender_name: user?.name,
      sender_role: user?.role,
      message: text.trim(),
      created_at: new Date().toISOString(),
      _pending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setText('');
    try {
      await api.post(`/orders/${orderId}/messages`, { message: optimistic.message });
      setMessages(prev => prev.filter(m => m.message_id !== optimistic.message_id));
    } catch {
      setMessages(prev => prev.filter(m => m.message_id !== optimistic.message_id));
    } finally { setSending(false); }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: 20, opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 300 }}
        style={{
          background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '480px',
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          direction: 'rtl', fontFamily: 'Tajawal,Cairo,sans-serif',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg,#4338CA,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageCircle style={{ width: '18px', height: '18px', color: '#fff' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ fontWeight: 700, fontSize: '15px', margin: 0 }}>محادثة الطلب</h3>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#10B981', fontWeight: 600 }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
                  مباشر
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>#{orderLabel}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X style={{ width: 20, height: 20, color: '#94A3B8' }} />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '200px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '8px' }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: i % 2 === 0 ? 'flex-end' : 'flex-start', gap: '4px' }}>
                  <div style={{ width: i % 2 === 0 ? '60%' : '40%', height: '38px', borderRadius: '12px', background: '#F1F5F9', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
              <MessageCircle style={{ width: '44px', height: '44px', margin: '0 auto 10px', opacity: 0.35 }} />
              <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px', color: '#475569' }}>لا توجد رسائل بعد</p>
              <p style={{ fontSize: '12px', margin: 0 }}>تواصل مع التاجر أو المندوب لأي استفسار</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map(msg => {
                const isMe = msg.sender_id === user?.user_id;
                const color = ROLE_COLORS[msg.sender_role] || '#475569';
                return (
                  <motion.div
                    key={msg.message_id}
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: msg._pending ? 0.6 : 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}
                  >
                    {!isMe && (
                      <span style={{ fontSize: '11px', color, fontWeight: 600, marginBottom: '3px' }}>
                        {msg.sender_name} · {ROLE_LABELS[msg.sender_role] || msg.sender_role}
                      </span>
                    )}
                    <div style={{
                      maxWidth: '78%', padding: '10px 14px',
                      borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                      background: isMe ? '#4338CA' : '#F1F5F9',
                      color: isMe ? '#fff' : '#0F172A',
                      fontSize: '14px', lineHeight: 1.55, wordBreak: 'break-word',
                    }}>
                      {msg.message}
                    </div>
                    <span style={{ fontSize: '10px', color: '#94A3B8', marginTop: '3px' }}>
                      {new Date(msg.created_at).toLocaleTimeString('ar-OM', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="اكتب رسالتك... (Enter للإرسال)"
            rows={1}
            style={{
              flex: 1, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: '10px',
              fontSize: '14px', fontFamily: 'Tajawal,sans-serif', resize: 'none', outline: 'none',
              maxHeight: '100px', overflow: 'auto', lineHeight: 1.5, transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = '#4338CA'}
            onBlur={e => e.target.style.borderColor = '#E2E8F0'}
          />
          <motion.button
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
            onClick={send}
            disabled={!text.trim() || sending}
            style={{
              padding: '10px 14px', borderRadius: '10px', border: 'none', flexShrink: 0,
              background: text.trim() && !sending ? '#4338CA' : '#E2E8F0',
              color: '#fff', cursor: text.trim() && !sending ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s',
            }}
          >
            <Send style={{ width: '18px', height: '18px' }} />
          </motion.button>
        </div>

        <style>{`
          @keyframes shimmer {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.8); }
          }
        `}</style>
      </motion.div>
    </motion.div>
  );
};

export default OrderChat;
