import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
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
