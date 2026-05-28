import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      const hash = location.hash;
      const params = new URLSearchParams(hash.substring(1));
      const sessionId = params.get('session_id');

      if (!sessionId) {
        navigate('/login');
        return;
      }

      try {
        const response = await api.post('/auth/session', null, {
          headers: { 'X-Session-ID': sessionId }
        });

        setUser(response.data);
        const dest = response.data.role === 'admin' ? '/admin/dashboard'
          : response.data.role === 'merchant' ? '/merchant/dashboard'
          : response.data.role === 'driver' ? '/driver/dashboard' : '/shop';
        navigate(dest);
      } catch (error) {
        console.error('Auth error:', error);
        navigate('/login');
      }
    };

    processSession();
  }, [location, navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA] mx-auto"></div>
        <p className="mt-4 text-[#475569]">جارٍ إكمال المصادقة...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
