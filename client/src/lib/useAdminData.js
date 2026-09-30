import { useCallback, useEffect, useState } from 'react';
import { adminGet } from './adminApi';
import { errorMessage } from './api';

/**
 * Load an admin API resource: { data, error, loading, reload, setData }.
 * `path` null skips loading.
 */
export default function useAdminData(path, params) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(path));
  const key = `${path}|${JSON.stringify(params || {})}`;

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      setData(await adminGet(path, params));
    } catch (err) {
      setError(errorMessage(err, 'This could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}
