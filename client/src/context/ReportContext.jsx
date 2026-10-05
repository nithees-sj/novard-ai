import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReportProblemDialog from '../components/reports/ReportProblemDialog';

/**
 * Opens the "Report a problem" dialog from anywhere:
 *   const report = useReportProblem();
 *   report({ area: 'notes', source: { itemType: 'note_chat', itemId, messageIndex, excerpt } });
 */
const ReportContext = createContext(() => {});

export function ReportProvider({ children }) {
  const [context, setContext] = useState(null);
  const open = useCallback((ctx = {}) => setContext({
    ...ctx,
    source: { page: window.location.pathname + window.location.search, ...(ctx.source || {}) },
  }), []);
  const close = useCallback(() => setContext(null), []);
  const value = useMemo(() => open, [open]);
  return (
    <ReportContext.Provider value={value}>
      {children}
      <ReportProblemDialog open={Boolean(context)} context={context || {}} onClose={close} />
    </ReportContext.Provider>
  );
}

/** A function that opens the report dialog with the given { area, source }. */
export const useReportProblem = () => useContext(ReportContext);

/** Fired on window when a report has been sent, so a list of reports can refresh. */
export const REPORT_SENT_EVENT = 'novard:report-sent';

/**
 * The general "Report a problem" (sidebar, account menu): go to My reports,
 * then open the dialog there once the page has settled. The report still
 * records the page the student came from.
 */
export function useReportFromAnywhere() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  return useCallback(() => {
    navigate('/reports', { state: { newReport: true, from: pathname + search } });
  }, [navigate, pathname, search]);
}

