import { useEffect, useState, useCallback, useRef } from 'react';
import { checkSupabaseConnection, ConnectionStatus } from './supabase';
export function useSupabaseConnection() {
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    message: 'Checking Supabase connection?',
  });
  const [checking, setChecking] = useState(true);
  const mounted = useRef(false);
  const running = useRef(false);
  const check = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    if (mounted.current) setChecking(true);
    try {
      const result = await checkSupabaseConnection();
      if (mounted.current) setStatus(result);
    } finally {
      running.current = false;
      if (mounted.current) setChecking(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void check();
    const interval = setInterval(() => {
      if (!document.hidden) void check();
    }, 60000);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [check]);
  return { ...status, checking, recheck: check };
}
