export const DISCLAIMER = 'Automated research analysis; not a formal determination of legality or legal advice.';
export const STATUS = {
  REPORTED: { label: 'Reported', classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  IN_VERIFICATION: { label: 'In verification', classes: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  CONFIRMED_REGIONAL_RESTRICTION: { label: 'Confirmed regional restriction', classes: 'bg-red-500/10 text-red-400 border-red-500/20' },
  GLOBAL_OUTAGE: { label: 'Global outage', classes: 'bg-gray-500/10 text-gray-300 border-gray-500/20' },
  UNRESTRICTED: { label: 'Unrestricted', classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  ANOMALY_INCONCLUSIVE: { label: 'Inconclusive', classes: 'bg-violet-500/10 text-violet-300 border-violet-500/20' },
};
export const PLATFORMS = [
  { value: 'Instagram', label: 'Instagram' }, { value: 'X', label: 'X' },
  { value: 'YouTube', label: 'YouTube' }, { value: 'WebDomain', label: 'News / Websites' },
  { value: 'Other', label: 'Other' },
];
export const SYMPTOMS = [
  { value: 'HTTP451', label: 'HTTP 451', detail: 'Unavailable for legal reasons' },
  { value: 'GeoBlockedNotice', label: 'Geo-blocked notice', detail: 'Content unavailable in your region' },
  { value: 'AccountSuspended', label: 'Account suspended', detail: 'An account is no longer accessible' },
  { value: 'DelistedSearch', label: 'Search delisted', detail: 'A resource is missing from search' },
  { value: 'DNSResolutionFailure', label: 'DNS resolution failure', detail: 'The domain cannot be resolved' },
];
export function domain(url) { try { return new URL(url).hostname; } catch { return url; } }
export function safeUrl(url) { try { const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null; } catch { return null; } }
export function dateTime(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Not available';
  return new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
}
export function validateUrl(value) {
  const url = safeUrl(value.trim());
  if (!url) return 'Enter a complete http:// or https:// resource URL.';
  const parsed = new URL(url);
  if (parsed.username || parsed.password) return 'Remove credentials from the URL.';
  if (parsed.port && !['80', '443'].includes(parsed.port)) return 'Use a public URL on port 80 or 443.';
  if (/\s|\\/.test(value)) return 'Remove spaces or backslashes from the URL.';
  return '';
}
export function telemetrySummary(rows = []) {
  const nodes = new Map();
  for (const row of rows) {
    const key = row.vantage_point;
    if (!nodes.has(key)) nodes.set(key, { node: key, country: row.country_code || '—', codes: new Set(), blocked: false, error: false });
    const node = nodes.get(key);
    node.codes.add(row.http_status ?? '—');
    node.blocked ||= row.http_status === 451 || Boolean(row.dom_signature_matched);
    node.error ||= Boolean(row.error);
  }
  return [...nodes.values()].map(node => ({ ...node, codes: [...node.codes], mixed: node.codes.size > 1 }));
}
export function indicatorState(value) {
  if (value === true) return { label: 'Established', tone: 'text-emerald-400', symbol: 'check' };
  if (value === false) return { label: 'Not established', tone: 'text-amber-400', symbol: 'minus' };
  return { label: 'Unknown · not assessed', tone: 'text-muted', symbol: 'unknown' };
}
export function confidencePercent(value) { return Number.isFinite(value) ? Math.round(Math.max(0, Math.min(1, value)) * 100) : null; }
