import React, { useState, useRef, useEffect } from 'react';
import api from '../utils/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MessageCircle, X, Send, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const SupportChat = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { type: 'bot', text: 'مرحباً! أنا مساعد سهل الذكي. كيف يمكنني مساعدتك اليوم؟' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!user) return null;

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setMessages(prev => [...prev, { type: 'user', text: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post('/chat', null, { params: { message: userMessage } });
      setMessages(prev => [...prev, { type: 'bot', text: response.data.response }]);
    } catch (error) {
      setMessages(prev => [...prev, { type: 'bot', text: 'عذراً، حدث خطأ. حاول مرة أخرى.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed z-50 bg-[#4338CA] hover:bg-[#3730A3] text-white rounded-full p-4 shadow-lg transition-transform duration-200 hover:scale-110"
        style={{ left: '1.5rem', bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        aria-label="فتح الدردشة"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {isOpen && (
        <div className="fixed z-50 bg-white rounded-lg shadow-2xl border border-[#E2E8F0] flex flex-col"
          style={{
            left: '1rem', right: '1rem',
            bottom: 'calc(max(1.5rem, env(safe-area-inset-bottom)) + 72px)',
            maxWidth: '420px',
            width: 'auto',
            height: 'min(500px, calc(100svh - 160px))',
            margin: '0 auto',
          }}>
          <div className="bg-[#4338CA] text-white p-4 rounded-t-lg">
            <h3 className="font-bold text-lg">مساعد سهل</h3>
            <p className="text-xs opacity-90">مدعوم بالذكاء الاصطناعي</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  msg.type === 'user'
                    ? 'bg-[#4338CA] text-white'
                    : 'bg-[#F8F9FA] text-[#0F172A] border border-[#E2E8F0]'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-end">
                <div className="bg-[#F8F9FA] rounded-lg p-3 border border-[#E2E8F0]">
                  <Loader className="h-4 w-4 animate-spin text-[#4338CA]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-[#E2E8F0]">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="اكتب رسالتك..."
                disabled={loading}
                className="flex-1"
              />
              <Button onClick={sendMessage} disabled={loading || !input.trim()} className="bg-[#4338CA] hover:bg-[#3730A3]">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SupportChat;
