import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWishlist } from '../contexts/WishlistContext';

const WishlistButton = ({ productId, size = 18, className = '' }) => {
  const { user } = useAuth();
  const { ids, toggle } = useWishlist();
  const navigate = useNavigate();
  const saved = ids.has(productId);

  const handleClick = async (e) => {
    e.stopPropagation();
    if (!user) { toast.error('سجّل دخول أولاً'); navigate('/login'); return; }
    const added = await toggle(productId);
    if (added === true)  toast.success('أُضيف إلى المفضلة ❤️');
    if (added === false) toast.info('حُذف من المفضلة');
  };

  return (
    <motion.button
      whileTap={{ scale: 0.8 }}
      whileHover={{ scale: 1.15 }}
      onClick={handleClick}
      className={className}
      style={{
        background: saved ? '#FFF1F2' : 'rgba(255,255,255,0.9)',
        border: `1.5px solid ${saved ? '#FECDD3' : '#E2E8F0'}`,
        borderRadius: '50%',
        width: size + 16, height: size + 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', padding: 0,
        backdropFilter: 'blur(4px)',
        transition: 'background 0.2s, border-color 0.2s',
        flexShrink: 0,
      }}
      aria-label={saved ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={saved ? 'filled' : 'empty'}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{ display: 'flex' }}
        >
          <Heart
            style={{
              width: size, height: size,
              fill: saved ? '#E11D48' : 'none',
              color: saved ? '#E11D48' : '#94A3B8',
              transition: 'all 0.2s',
            }}
          />
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
};

export default WishlistButton;
