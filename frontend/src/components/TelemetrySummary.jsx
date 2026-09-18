import { telemetrySummary } from '../lib/evidence';

export default function TelemetrySummary({ rows }) {
  const nodes = telemetrySummary(rows);
  if (!nodes.length) return <span className="text-xs text-muted">Awaiting probe samples</span>;
  return <div className="flex max-w-64 flex-wrap gap-1.5">{nodes.map(node =>
    <span key={node.node} title={`${node.node}${node.mixed ? ' · Responses differ between samples' : ''}`} className={`rounded border px-2 py-1 font-mono text-xs ${node.mixed || node.error ? 'border-amber-500/25 bg-amber-500/5 text-amber-300' : node.blocked ? 'border-red-500/25 bg-red-500/5 text-red-300' : node.codes.every(code => code === 200) ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-300' : 'border-line text-muted'}`}>
      {node.country === 'DE' ? 'EU' : node.country}: {node.codes.join('/')}
    </span>)}
  </div>;
}
