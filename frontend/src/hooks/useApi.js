import { useEffect, useState } from 'react';
import { request } from '../lib/api';

/** Abort stale requests; schedule polling only after the previous request settles. */
export default function useApi(path, interval = 0) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    setState({ data: null, error: '', loading: true });
    async function load() {
      try {
        const data = await request(path, { signal: controller.signal });
        if (!controller.signal.aborted) setState({ data, error: '', loading: false });
      } catch (error) {
        if (!controller.signal.aborted) setState(old => ({ ...old, error: error.message, loading: false }));
      } finally {
        if (interval && !controller.signal.aborted) timer = setTimeout(load, interval);
      }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [path, interval, revision]);
  return { ...state, retry: () => setRevision(value => value + 1) };
}
