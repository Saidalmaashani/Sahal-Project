import React, { useState } from 'react';
import { motion } from 'framer-motion';

const StarRating = ({ value = 0, onChange, size = 24, readonly = false }) => {
  const [hovered, setHovered] = useState(0);

  const stars = [1, 2, 3, 4, 5];
  const active = hovered || value;

  return (
    <div
      style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
      onMouseLeave={() => !readonly && setHovered(0)}
    >
      {stars.map(star => {
        const filled = star <= active;
        const isHalf = !filled && star - 0.5 <= value && !hovered;

        return (
          <motion.button
            key={star}
            type="button"
            whileHover={!readonly ? { scale: 1.2 } : {}}
            whileTap={!readonly ? { scale: 0.9 } : {}}
            onClick={() => !readonly && onChange?.(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            style={{
              background: 'none', border: 'none',
              cursor: readonly ? 'default' : 'pointer',
              padding: '1px', lineHeight: 1, display: 'flex',
            }}
          >
            <svg
              width={size} height={size}
              viewBox="0 0 24 24"
              fill={filled ? '#F59E0B' : isHalf ? 'url(#half)' : 'none'}
              stroke={filled || isHalf ? '#F59E0B' : '#CBD5E1'}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transition: 'all 0.15s' }}
            >
              {isHalf && (
                <defs>
                  <linearGradient id="half" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="50%" stopColor="#F59E0B" />
                    <stop offset="50%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              )}
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </motion.button>
        );
      })}
    </div>
  );
};

export const StarDisplay = ({ value = 0, count, size = 14 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
    <StarRating value={value} size={size} readonly />
    <span style={{ fontSize: size - 2, color: '#475569', fontWeight: 600 }}>
      {value > 0 ? value.toFixed(1) : ''}
    </span>
    {count !== undefined && (
      <span style={{ fontSize: size - 3, color: '#94A3B8' }}>({count})</span>
    )}
  </div>
);

export default StarRating;
