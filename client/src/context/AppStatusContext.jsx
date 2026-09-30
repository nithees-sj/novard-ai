import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

/**
 * The platform's state as the admins set it (GET /api/app-status): which
 * tools are switched off and why, "we know about this issue" notices,
 * maintenance mode, the dashboard banner and what the report form needs.
 * Refreshed every minute.
 */

const REFRESH_MS = 60 * 1000;
const EMPTY = { features: {}, maintenance: { enabled: false, message: '' }, banner: null, reports: { areas: [], maxOpenPerArea: 2, voiceEnabled: false } };

const AppStatusContext = createContext({ status: EMPTY, refresh: () => {} });

export function AppStatusProvider({ children }) {
  const [status, setStatus] = useState(EMPTY);

  const refresh = useCallback(() => api.get('/api/app-status')
    .then(({ data }) => setStatus({ ...EMPTY, ...data }))
    .catch(() => {}), []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const value = useMemo(() => ({ status, refresh }), [status, refresh]);
  return <AppStatusContext.Provider value={value}>{children}</AppStatusContext.Provider>;
}

/** { status, refresh } */
export const useAppStatus = () => useContext(AppStatusContext);

/** One tool's switch: { enabled, message, notice, label } (enabled when unknown). */
export function useFeature(tool) {
  const { status } = useAppStatus();
  return status.features?.[tool] || { enabled: true, message: '', notice: '' };
}
