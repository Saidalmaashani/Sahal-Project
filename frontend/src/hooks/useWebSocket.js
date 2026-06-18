import { useEffect, useRef, useCallback } from 'react';

const WS_BASE = process.env.REACT_APP_WS_URL ||
  (process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000')
    .replace(/^http/, 'ws');

export function useWebSocket({ path, token, onMessage, enabled = true }) {
  const wsRef = useRef(null);
  const retryRef = useRef(null);
  const retryCount = useRef(0);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!enabled || !token || !mountedRef.current) return;

    const url = `${WS_BASE}${path}?token=${token}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryCount.current = 0;
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type !== 'ping' && onMessage) onMessage(data);
      } catch {}
    };

    ws.onclose = (e) => {
      if (!mountedRef.current) return;
      // إعادة الاتصال تلقائياً (exponential backoff, max 30s)
      if (e.code !== 4001 && e.code !== 4004) {
        const delay = Math.min(1000 * 2 ** retryCount.current, 30000);
        retryCount.current += 1;
        retryRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => ws.close();
  }, [path, token, enabled, onMessage]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
