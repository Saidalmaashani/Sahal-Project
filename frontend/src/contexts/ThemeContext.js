import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({ dark: false, toggle: () => {} });

export const ThemeProvider = ({ children }) => {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('sahal-theme') === 'dark'; }
    catch { return false; }
  });

  useEffect(() => {
    const html = document.documentElement;
    if (dark) { html.classList.add('dark'); }
    else       { html.classList.remove('dark'); }
    try { localStorage.setItem('sahal-theme', dark ? 'dark' : 'light'); }
    catch {}
  }, [dark]);

  const toggle = () => setDark(d => !d);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

// Object ألوان جاهز للاستخدام في inline styles
export const useT = () => {
  const { dark } = useContext(ThemeContext);
  return dark ? DARK : LIGHT;
};

const LIGHT = {
  bg:        '#FFFFFF',
  bg2:       '#F8F9FA',
  bg3:       '#F1F5F9',
  card:      '#FFFFFF',
  cardHover: '#F8FAFC',
  text:      '#0F172A',
  text2:     '#475569',
  muted:     '#94A3B8',
  border:    '#E2E8F0',
  border2:   '#F1F5F9',
  inputBg:   '#FFFFFF',
  headerBg:  'rgba(255,255,255,0.92)',
  overlay:   'rgba(0,0,0,0.5)',
  shimmer:   '#F1F5F9',
};

const DARK = {
  bg:        '#0F172A',
  bg2:       '#1E293B',
  bg3:       '#334155',
  card:      '#1E293B',
  cardHover: '#263348',
  text:      '#F1F5F9',
  text2:     '#94A3B8',
  muted:     '#64748B',
  border:    '#334155',
  border2:   '#1E293B',
  inputBg:   '#1E293B',
  headerBg:  'rgba(15,23,42,0.92)',
  overlay:   'rgba(0,0,0,0.75)',
  shimmer:   '#334155',
};
