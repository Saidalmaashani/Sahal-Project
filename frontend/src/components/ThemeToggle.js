import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle = ({ size = 'md' }) => {
  const { dark, toggle } = useTheme();
  const s = size === 'sm' ? 34 : 40;
  const iconSize = size === 'sm' ? 15 : 18;

  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.06 }}
      onClick={toggle}
      aria-label={dark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
      style={{
        width: s, height: s,
        borderRadius: '50%',
        border: `1.5px solid ${dark ? '#334155' : '#E2E8F0'}`,
        background: dark ? '#1E293B' : '#F8FAFC',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
        transition: 'background 0.3s, border-color 0.3s',
        flexShrink: 0,
      }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={dark ? 'moon' : 'sun'}
          initial={{ rotate: dark ? -90 : 90, opacity: 0, scale: 0.5 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: dark ? 90 : -90, opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.22 }}
          style={{ display: 'flex' }}
        >
          {dark
            ? <Sun  style={{ width: iconSize, height: iconSize, color: '#FCD34D' }} />
            : <Moon style={{ width: iconSize, height: iconSize, color: '#475569' }} />
          }
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
};

export default ThemeToggle;
