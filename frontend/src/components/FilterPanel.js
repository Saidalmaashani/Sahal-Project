import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, X, Star, ArrowUpDown } from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'newest',     label: 'الأحدث' },
  { value: 'price_asc',  label: 'السعر: الأقل أولاً' },
  { value: 'price_desc', label: 'السعر: الأعلى أولاً' },
  { value: 'rating',     label: 'الأعلى تقييماً' },
];

const ActiveChip = ({ label, onRemove }) => (
  <motion.span
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    exit={{ scale: 0, opacity: 0 }}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 10px', background: '#EEF2FF', borderRadius: '20px',
      fontSize: '12px', fontWeight: 600, color: '#4338CA',
      border: '1px solid #C7D2FE',
    }}
  >
    {label}
    <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}>
      <X style={{ width: 12, height: 12, color: '#6366F1' }} />
    </button>
  </motion.span>
);

const FilterPanel = ({ filters, onChange, activeCount }) => {
  const [open, setOpen] = React.useState(false);
  const { minPrice, maxPrice, minRating, sortBy } = filters;

  const set = (key, val) => onChange({ ...filters, [key]: val });
  const clear = () => onChange({ minPrice: '', maxPrice: '', minRating: 0, sortBy: 'newest' });

  const activeChips = [];
  if (minPrice) activeChips.push({ key: 'minPrice', label: `من ${minPrice} ر.ع` });
  if (maxPrice) activeChips.push({ key: 'maxPrice', label: `حتى ${maxPrice} ر.ع` });
  if (minRating) activeChips.push({ key: 'minRating', label: `${minRating}+ نجوم` });
  if (sortBy && sortBy !== 'newest') {
    const opt = SORT_OPTIONS.find(o => o.value === sortBy);
    if (opt) activeChips.push({ key: 'sortBy', label: opt.label });
  }

  return (
    <div style={{ fontFamily: 'Tajawal,sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* زر الفلتر */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '10px', border: '1.5px solid',
            borderColor: open || activeCount > 0 ? '#4338CA' : '#E2E8F0',
            background: open || activeCount > 0 ? '#EEF2FF' : '#fff',
            color: open || activeCount > 0 ? '#4338CA' : '#475569',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <SlidersHorizontal style={{ width: 15, height: 15 }} />
          تصفية
          {activeCount > 0 && (
            <span style={{ background: '#4338CA', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>
              {activeCount}
            </span>
          )}
        </motion.button>

        {/* Sort quick select */}
        <select
          value={sortBy || 'newest'}
          onChange={e => set('sortBy', e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #E2E8F0',
            background: '#fff', fontSize: '13px', fontFamily: 'Tajawal,sans-serif',
            color: '#475569', cursor: 'pointer', outline: 'none',
          }}
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Active chips */}
        <AnimatePresence>
          {activeChips.map(chip => (
            <ActiveChip
              key={chip.key}
              label={chip.label}
              onRemove={() => set(chip.key, chip.key === 'minRating' ? 0 : chip.key === 'sortBy' ? 'newest' : '')}
            />
          ))}
          {activeChips.length > 1 && (
            <motion.button
              key="clear-all"
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              onClick={clear}
              style={{ fontSize: '12px', color: '#E11D48', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Tajawal,sans-serif', fontWeight: 600 }}
            >
              مسح الكل
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Panel المفتوح */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px',
              padding: '18px', marginTop: '10px',
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '18px',
            }}>
              {/* نطاق السعر */}
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <ArrowUpDown style={{ width: 13, height: 13, color: '#4338CA' }} />
                  نطاق السعر (ر.ع)
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number" min="0" placeholder="من"
                    value={minPrice} onChange={e => set('minPrice', e.target.value)}
                    style={{ width: '80px', padding: '7px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Tajawal,sans-serif', outline: 'none' }}
                    onFocus={e => e.target.style.borderColor = '#4338CA'}
                    onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                  />
                  <span style={{ color: '#94A3B8', fontSize: '12px' }}>—</span>
                  <input
                    type="number" min="0" placeholder="حتى"
                    value={maxPrice} onChange={e => set('maxPrice', e.target.value)}
                    style={{ width: '80px', padding: '7px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Tajawal,sans-serif', outline: 'none' }}
                    onFocus={e => e.target.style.borderColor = '#4338CA'}
                    onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                  />
                </div>
              </div>

              {/* الحد الأدنى للتقييم */}
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Star style={{ width: 13, height: 13, color: '#F59E0B', fill: '#F59E0B' }} />
                  أدنى تقييم
                </p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[0, 3, 3.5, 4, 4.5].map(r => (
                    <motion.button
                      key={r}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => set('minRating', r)}
                      style={{
                        padding: '5px 10px', borderRadius: '8px', border: '1.5px solid',
                        borderColor: minRating === r ? '#F59E0B' : '#E2E8F0',
                        background: minRating === r ? '#FEF3C7' : '#fff',
                        color: minRating === r ? '#92400E' : '#475569',
                        fontSize: '12px', fontFamily: 'Tajawal,sans-serif', fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {r === 0 ? 'الكل' : `${r}+★`}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FilterPanel;
