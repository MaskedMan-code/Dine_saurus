import { useEffect, useState, useCallback } from 'react';
import { checkSupabaseConnection, ConnectionStatus } from './supabase';

export function useSupabaseConnection() {
  const [status, setStatus] = useState<ConnectionStatus>({ connected: false, message: 'Checking Supabase connection…' });
  const [checking, setChecking] = useState(true);

  const check = useCallback(async () => {
    setChecking(true);
    const result = await checkSupabaseConnection();
    setStatus(result);
    setChecking(false);
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 60000); // periodic re-check so a dropped connection is reported, not just assumed fine
    return () => clearInterval(interval);
  }, [check]);

  return { ...status, checking, recheck: check };
}
