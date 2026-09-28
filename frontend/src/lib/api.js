const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

export async function request(path, options = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 15000);
  try {
    const response = await fetch(`${API_BASE}${path}`, { ...options, signal: controller.signal });
    if (!response.ok) {
      let message = response.status === 404 ? 'This evidence dossier could not be found.' : `The observatory returned an error (${response.status}). Please try again.`;
      try {
        const body = await response.json();
        if (typeof body.detail === 'string') message = body.detail;
        if (Array.isArray(body.detail)) message = body.detail.map(item => `${item.loc?.at(-1) || 'Report'}: ${item.msg}`).join(' ');
      } catch { /* Keep the HTTP error if an upstream service returns HTML. */ }
      throw new Error(message);
    }
    return await response.json();
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (error.name === 'AbortError') throw new Error('The request timed out. Check that the API is running and try again.');
    if (error instanceof TypeError) throw new Error('Cannot reach the observatory. Check your connection and try again shortly.');
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}

export const submitReport = (data) => request('/reports', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});
