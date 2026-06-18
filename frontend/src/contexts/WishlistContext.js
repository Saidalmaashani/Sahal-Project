import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from './AuthContext';

const WishlistContext = createContext({ ids: new Set(), toggle: () => {}, loading: false });

export const WishlistProvider = ({ children }) => {
  const { user } = useAuth();
  const [ids, setIds] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setIds(new Set()); return; }
    try {
      const r = await api.get('/wishlist/ids');
      setIds(new Set(r.data));
    } catch {}
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback(async (productId) => {
    if (!user) return false;
    // optimistic update
    setIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
    try {
      const r = await api.post(`/wishlist/toggle/${productId}`);
      return r.data.added;
    } catch {
      // rollback
      setIds(prev => {
        const next = new Set(prev);
        if (next.has(productId)) next.delete(productId);
        else next.add(productId);
        return next;
      });
      return null;
    }
  }, [user]);

  return (
    <WishlistContext.Provider value={{ ids, toggle, loading, reload: load }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => useContext(WishlistContext);
