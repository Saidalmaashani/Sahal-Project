import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const PLACEHOLDER_IMG = 'https://images.pexels.com/photos/17938771/pexels-photo-17938771.jpeg';

const SearchAutocomplete = ({ value, onChange, onSearch, placeholder = 'ابحث عن منتج...' }) => {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const fetchSuggestions = useCallback(async (q) => {
    if (!q || q.length < 2) { setSuggestions([]); return; }
    try {
      const r = await api.get('/products/search/autocomplete', { params: { q } });
      setSuggestions(r.data);
    } catch {}
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 280);
    return () => clearTimeout(debounceRef.current);
  }, [value, fetchSuggestions]);

  useEffect(() => {
    setOpen(suggestions.length > 0 && value.length >= 2);
    setActive(-1);
  }, [suggestions, value]);

  // close on outside click
  useEffect(() => {
    const handler = (e) => { if (!containerRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectItem = (item) => {
    setOpen(false);
    navigate(`/product/${item.product_id}`);
  };

  const handleKey = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, -1)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && suggestions[active]) selectItem(suggestions[active]);
      else { setOpen(false); onSearch?.(); }
    }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search style={{
          position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
          width: 18, height: 18, color: '#94A3B8', pointerEvents: 'none', zIndex: 1,
        }} />
        <input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => suggestions.length > 0 && value.length >= 2 && setOpen(true)}
          placeholder={placeholder}
          style={{
            width: '100%', padding: '10px 42px 10px 40px',
            border: '1.5px solid #E2E8F0', borderRadius: '12px',
            fontSize: '14px', fontFamily: 'Tajawal,sans-serif',
            outline: 'none', background: '#fff', color: '#0F172A',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onFocus={e => { e.target.style.borderColor = '#4338CA'; e.target.style.boxShadow = '0 0 0 3px rgba(67,56,202,0.1)'; }}
          onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
        />
        {value && (
          <motion.button
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            onClick={() => { onChange(''); setSuggestions([]); setOpen(false); inputRef.current?.focus(); }}
            style={{ position: 'absolute', left: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', borderRadius: '4px', color: '#94A3B8', display: 'flex' }}
          >
            <X style={{ width: 16, height: 16 }} />
          </motion.button>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, left: 0,
              background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.12)', zIndex: 200, overflow: 'hidden',
              direction: 'rtl',
            }}
          >
            <div style={{ padding: '6px 12px', borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ fontSize: '11px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TrendingUp style={{ width: 11, height: 11 }} />
                نتائج البحث
              </span>
            </div>
            {suggestions.map((item, i) => (
              <motion.div
                key={item.product_id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => selectItem(item)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', cursor: 'pointer',
                  background: active === i ? '#F0F4FF' : 'transparent',
                  borderBottom: i < suggestions.length - 1 ? '1px solid #F8FAFC' : 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={() => setActive(i)}
              >
                <img
                  src={item.images?.[0] || PLACEHOLDER_IMG}
                  alt={item.name}
                  onError={e => { e.target.src = PLACEHOLDER_IMG; }}
                  style={{ width: 38, height: 38, borderRadius: '8px', objectFit: 'cover', flexShrink: 0, border: '1px solid #F1F5F9' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </p>
                  <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>{item.category}</p>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#4338CA', flexShrink: 0 }}>
                  {item.price?.toFixed(3)} ر.ع
                </span>
              </motion.div>
            ))}
            <div
              style={{ padding: '10px 14px', borderTop: '1px solid #F1F5F9', cursor: 'pointer', background: '#FAFAFA' }}
              onClick={() => { setOpen(false); onSearch?.(); }}
            >
              <span style={{ fontSize: '13px', color: '#4338CA', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Search style={{ width: 13, height: 13 }} />
                عرض كل نتائج "{value}"
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchAutocomplete;
