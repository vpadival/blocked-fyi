export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, options);
  if (!response.ok) {
    let message = `Request failed (${response.status}). Please try again.`;
    try {
      const body = await response.json();
      if (typeof body.detail === 'string') message = body.detail;
      else if (Array.isArray(body.detail)) message = body.detail.map((e: {msg: string}) => e.msg).join(' ');
    } catch { /* Keep a readable message for non-JSON upstream errors. */ }
    throw new Error(message);
  }
  return response.json();
}
