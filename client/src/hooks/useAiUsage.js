import { useCallback, useEffect, useState } from 'react';
import { AI_LIMIT_EVENT, apiJson } from '../lib/api';

/**
 * The signed-in student's AI token use per tool against the admin's limits
 * (GET /api/ai-usage): { period, resetsAt, tools: [{ tool, label, used, limit, reached, message }] }.
 * Re-read whenever a request is refused for a used-up allowance, so the
 * notices appear straight away. null until loaded (or when it cannot load).
 */
export default function useAiUsage() {
  const [usage, setUsage] = useState(null);
  const load = useCallback(() => apiJson('/api/ai-usage').then(setUsage).catch(() => {}), []);

  useEffect(() => {
    load();
    window.addEventListener(AI_LIMIT_EVENT, load);
    return () => window.removeEventListener(AI_LIMIT_EVENT, load);
  }, [load]);

  return usage;
}
