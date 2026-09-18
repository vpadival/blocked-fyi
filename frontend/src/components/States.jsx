import { AlertTriangle, LoaderCircle, Radio } from 'lucide-react';

export function ErrorState({ message, retry, stale = false }) {
  return <div role="alert" className="my-4 flex flex-wrap items-center gap-3 rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
    <AlertTriangle size={18} /><span className="min-w-0 flex-1">{message}{stale && ' Previously loaded data remains visible and may be out of date.'}</span>
    {retry && <button onClick={retry} className="button-secondary">Try again</button>}
  </div>;
}
export function Loading({ children = 'Loading evidence…' }) {
  return <div role="status" className="flex min-h-48 items-center justify-center gap-3 px-5 text-sm text-muted"><LoaderCircle className="animate-spin" size={20} />{children}</div>;
}
export function SimulationNotice({ compact = false }) {
  return <div className="print-notice flex items-start gap-3 rounded-md border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
    <Radio size={18} className="mt-0.5 shrink-0" /><p><strong>{compact ? 'Demo mode. ' : 'Simulated evidence — mock fixture. '}</strong>{compact ? 'Probe results are synthetic and excluded from confirmed-block statistics.' : 'The submitted URL was not contacted. HTTP responses, latency, and blocking strings are synthetic test data, not findings about this resource.'}</p>
  </div>;
}
