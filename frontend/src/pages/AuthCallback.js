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

    const processCallback = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');

      try {
        if (!code) { navigate('/login'); return; }

        const response = await api.post('/auth/google', {
          code,
          redirect_uri: window.location.origin + '/auth/callback'
        });

        localStorage.setItem('token', response.data.token);
        setUser(response.data.user);

        const dest = response.data.user.role === 'admin' ? '/admin/dashboard'
          : response.data.user.role === 'merchant' ? '/merchant/dashboard'
          : response.data.user.role === 'driver' ? '/driver/dashboard' : '/shop';
        navigate(dest);
      } catch (error) {
        console.error('Auth error:', error);
        navigate('/login');
      }
    };

    processCallback();
  }, [location, navigate, setUser]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #4338CA', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
        <p style={{ marginTop: '1rem', color: '#475569', fontFamily: 'Tajawal,sans-serif' }}>جارٍ تسجيل الدخول...</p>
      </div>
    </div>
  );
};

export default AuthCallback;