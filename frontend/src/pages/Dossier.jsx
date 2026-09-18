import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Activity, ArrowLeft, BookOpen, Check, CircleHelp, Download, ExternalLink, FileText, Minus, Printer, ShieldCheck } from 'lucide-react';
import useApi from '../hooks/useApi';
import { confidencePercent, dateTime, DISCLAIMER, domain, indicatorState, safeUrl } from '../lib/evidence';
import { exportDossier } from '../lib/export';
import { ErrorState, Loading, SimulationNotice } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import PlatformLabel from '../components/PlatformLabel';

const INDICATORS = {
  notice_to_originator_traceable: 'Pre-decisional notice to creator',
  public_order_available: 'Public order located',
  localized_restriction_confirmed: 'Regional restriction observed',
  url_vs_account_scope_established: 'URL-level vs. account-level scope established',
  review_process_verified: 'Review process verified',
};
const EGRESS = { ResidentialProxy: 'Residential proxy', DatacenterProxy: 'Datacenter proxy', LocalInterface: 'Local interface', MockFixture: 'Fixture · simulated' };

function SectionTitle({ number, title, description, Icon }) {
  return <div className="flex items-start gap-3 p-5 sm:p-6"><span className="section-number">{number}</span><div className="min-w-0 flex-1"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm leading-relaxed text-muted">{description}</p></div><Icon size={21} className="hidden shrink-0 text-muted sm:block" /></div>;
}

export default function Dossier() {
  const { id } = useParams();
  const location = useLocation();
  const { data: report, loading, error, retry } = useApi(`/reports/${encodeURIComponent(id)}`, 3000);
  const [exportError, setExportError] = useState('');
  function download() { try { exportDossier(report); setExportError(''); } catch { setExportError('The browser could not download the dossier. Use Print to PDF or try another browser.'); } }
  if (loading) return <Loading>Loading the evidence dossier…</Loading>;
  if (!report) return <><Link to="/" className="text-link"><ArrowLeft size={16} />Back to feed</Link><ErrorState message={error || 'Dossier unavailable.'} retry={retry} /></>;
  const audit = report.legal_audit;
  const pending = ['REPORTED', 'IN_VERIFICATION'].includes(report.status);
  const score = confidencePercent(audit?.confidence_score);
  const isSimulation = report.is_simulation || report.telemetry?.some(row => row.is_simulation);
  const samples = [...(report.telemetry || [])].sort((a, b) => a.attempt - b.attempt || a.vantage_point.localeCompare(b.vantage_point));
  return <>
    <Link className="text-link no-print mb-7" to="/"><ArrowLeft size={16} />Back to the public record</Link>
    {location.state?.submitted && <p role="status" className="no-print mb-5 flex items-start gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200"><Check size={18} />Lead received. This dossier updates automatically as verification progresses.</p>}
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5"><div className="min-w-0"><p className="eyebrow mb-3">Evidence dossier / {report.id.slice(0, 8)}</p><h1 className="page-title break-all">{domain(report.target_url)}</h1></div><div className="no-print flex flex-wrap gap-3" role="group" aria-label="Export Evidence Dossier"><button className="button-secondary" onClick={download}><Download size={16} />Export JSON</button><button className="button-primary" onClick={() => window.print()}><Printer size={16} />Print to PDF</button></div></div>
    {error && <ErrorState message={error} retry={retry} stale />}{exportError && <ErrorState message={exportError} />}
    {isSimulation && <div className="mb-6"><SimulationNotice /></div>}
    <div className="space-y-6">
      <section className="panel print-keep"><SectionTitle number="01" title="Incident overview" description="Citizen-reported details and the current verification state." Icon={FileText} /><dl className="grid gap-6 border-t border-line p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3"><dt className="mb-2 text-xs uppercase tracking-wider text-muted">Target resource</dt><dd className="break-all">{safeUrl(report.target_url) ? <a href={safeUrl(report.target_url)} target="_blank" rel="noreferrer" className="inline-flex items-start gap-2 hover:text-signal">{report.target_url}<ExternalLink size={15} className="mt-1 shrink-0" /></a> : report.target_url}</dd></div>
        <div><dt className="mb-2 text-xs uppercase tracking-wider text-muted">Current status</dt><dd><StatusBadge status={report.status} /></dd></div>
        <div><dt className="mb-2 text-xs uppercase tracking-wider text-muted">Timestamp</dt><dd className="text-sm">{dateTime(report.created_at)}</dd></div>
        <div><dt className="mb-2 text-xs uppercase tracking-wider text-muted">Platform</dt><dd><PlatformLabel platform={report.platform} /></dd></div>
        <div><dt className="mb-2 text-xs uppercase tracking-wider text-muted">Reported region / ISP</dt><dd className="text-sm">{report.reported_region}<span className="mt-1 block text-muted">{report.reported_isp || 'ISP not provided'}</span></dd></div>
        <div className="sm:col-span-2"><dt className="mb-2 text-xs uppercase tracking-wider text-muted">Report identifier</dt><dd className="break-all font-mono text-sm text-muted">{report.id}</dd></div>
        {report.notes && <div className="sm:col-span-2 lg:col-span-3"><dt className="mb-2 text-xs uppercase tracking-wider text-muted">Citizen notes · Unverified</dt><dd className="whitespace-pre-wrap break-words text-sm leading-relaxed">{report.notes}</dd></div>}
      </dl>{report.verification_error && <div className="px-5 pb-2"><ErrorState message={report.verification_error} /></div>}</section>

      <section className="panel overflow-hidden"><SectionTitle number="02" title="Multi-vantage technical telemetry" description="Observable facts · Every sampled node and every retained response." Icon={Activity} />
        {samples.length ? <div className="table-scroll"><table className="data-table min-w-[1050px]"><thead><tr><th>Probe / Egress</th><th>Sample</th><th>HTTP</th><th>DNS</th><th>Latency</th><th>Matched DOM / Error</th><th>Timestamp</th></tr></thead><tbody>{samples.map((row, index) => <tr key={row.id || `${row.vantage_point}-${index}`}>
          <td><p className="font-medium">{row.vantage_point}</p><p className="mb-2 mt-1 text-xs text-muted">{row.country_code} · {row.is_domestic ? 'Domestic' : 'International control'}</p><span className={`inline-block rounded border px-2 py-1 text-xs ${row.is_simulation ? 'border-amber-500/25 bg-amber-500/5 text-amber-300' : 'border-line text-muted'}`}>{EGRESS[row.egress_type] || row.egress_type}{row.is_simulation && row.egress_type !== 'MockFixture' ? ' · simulated' : ''}</span></td>
          <td className="font-mono text-muted">#{row.attempt ?? 1}</td><td><span className={`font-mono font-semibold ${row.http_status === 451 || row.dom_signature_matched ? 'text-red-400' : row.http_status === 200 ? 'text-emerald-400' : 'text-slate-300'}`}>{row.http_status ?? 'No response'}</span></td>
          <td>{row.dns_resolved === true ? 'Resolved' : row.dns_resolved === false ? 'Failed' : 'Unknown'}</td><td className="whitespace-nowrap font-mono">{Number.isFinite(row.response_time_ms) ? `${row.response_time_ms.toFixed(1)} ms` : '—'}</td>
          <td className="max-w-72"><p className="break-words text-xs leading-relaxed text-muted">{row.dom_signature_matched || 'No blocking string matched'}</p>{row.error && <p className="mt-2 text-xs text-amber-300">Transport error: {row.error}</p>}</td><td className="min-w-36 text-xs leading-relaxed text-muted">{dateTime(row.timestamp)}</td>
        </tr>)}</tbody></table></div> : <div className="border-t border-line p-6 text-sm text-muted">{pending ? 'Verification is queued or running. Probe samples will appear here automatically.' : 'No probe telemetry is available for this report.'}</div>}
        <p className="border-t border-line p-5 text-xs leading-relaxed text-muted">Coverage is limited to sampled routes and times. HTTP 200 is reachability, not proof of intended-content availability. “Global outage” means 404/500 at all sampled nodes, not worldwide proof. Proxy DNS remains unknown unless independently measured.</p>
      </section>

      <section className="panel"><SectionTitle number="03" title="Legal & procedural audit" description="Interpretive layer · Research questions, relevant frameworks, and their limits." Icon={BookOpen} />
        {audit ? <div className="space-y-7 border-t border-line p-5 sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_2fr]"><div><h3 className="mb-2 text-sm font-semibold">Primary jurisdiction</h3><p className="text-sm text-muted">{audit.primary_jurisdiction || 'Not established'}</p></div><div><h3 className="mb-2 text-sm font-semibold">Applicable frameworks / potential context</h3>{audit.applicable_frameworks?.length ? <ul className="space-y-2 text-sm text-muted">{audit.applicable_frameworks.map(framework => <li key={framework} className="flex items-start gap-2"><span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-signal" />{framework}</li>)}</ul> : <p className="text-sm text-muted">No applicable frameworks established within the available corpus.</p>}</div></div>
          <div><h3 className="mb-4 text-sm font-semibold">Procedural checklist</h3><div className="grid gap-3 sm:grid-cols-2">{Object.entries(audit.procedural_indicators || {}).map(([key, value]) => {
            const state = indicatorState(value); const Icon = state.symbol === 'check' ? Check : state.symbol === 'minus' ? Minus : CircleHelp;
            return <div key={key} className="print-keep flex items-start gap-3 rounded-md border border-line p-4"><Icon size={18} className={`mt-0.5 shrink-0 ${state.tone}`} /><div><p className="text-sm">{INDICATORS[key] || key.replaceAll('_', ' ')}</p><p className={`mt-1 text-xs ${state.tone}`}>{state.label}</p></div></div>;
          })}</div><p className="mt-3 text-xs leading-relaxed text-muted">Unknown means not assessed. It does not mean a notice or public order is absent. Network telemetry cannot establish a procedural violation.</p></div>
          <div><h3 className="mb-3 text-sm font-semibold">Key statutory considerations & potential procedural ambiguities</h3><ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed text-slate-300">{(audit.potential_concerns || []).map(concern => <li key={concern}>{concern}</li>)}</ul></div>
          <div className="print-keep rounded-md border border-line bg-ink p-5"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Confidence score <span className="font-normal text-muted">/ HTTP observation completeness</span></h3><span className="font-mono text-sm text-signal">{score === null ? 'Unknown' : `${score}%`}</span></div>{score !== null && <div role="progressbar" aria-label="HTTP observation completeness" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-slate-700"><div className="h-full rounded-full bg-signal" style={{ width: `${score}%` }} /></div>}<p className="mt-3 text-xs leading-relaxed text-muted">{audit.confidence_basis || 'This score describes evidence completeness, not the probability of illegality.'} It is never an unconstitutionality score.</p></div>
          {audit.citations?.length > 0 && <div><h3 className="mb-3 text-sm font-semibold">Grounding sources</h3><div className="divide-y divide-line">{audit.citations.map((source, index) => <article key={source.id || index} className="print-keep flex gap-4 py-5"><span className="font-mono text-xs text-muted">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1">{safeUrl(source.url) ? <a href={safeUrl(source.url)} className="source-link text-link" target="_blank" rel="noreferrer">{source.title}<ExternalLink size={14} className="shrink-0" /></a> : <p>{source.title}</p>}<p className="mt-2 text-xs text-muted">{source.locator} · {source.jurisdiction}</p><p className="mt-3 text-sm leading-relaxed text-slate-300">{source.text}</p>{source.scope && <p className="mt-3 border-l-2 border-amber-500/50 pl-3 text-xs leading-relaxed text-amber-200">{source.scope}</p>}</div></article>)}</div></div>}
          <p className="text-xs text-muted">Generated {dateTime(audit.generated_at)} · {audit.generation_mode === 'deterministic_retrieval' ? 'Offline, source-grounded research' : audit.generation_mode || 'Automated research'}</p>
        </div> : <div className="border-t border-line p-6 text-sm text-muted">{pending ? 'Statutory research follows network verification. This section will update automatically.' : 'No legal audit was generated. The available technical observations are preserved above.'}</div>}
      </section>
      <section className="print-notice print-keep flex items-start gap-4 rounded-lg border border-signal/25 bg-signal/5 p-5 sm:p-6"><ShieldCheck className="mt-0.5 shrink-0 text-signal" size={23} /><div><h2 className="mb-2 text-base font-semibold">Research disclaimer</h2><p className="text-sm leading-relaxed">{DISCLAIMER}</p><p className="mt-2 text-sm leading-relaxed text-muted">Technical signals cannot establish the actor, legal authority, necessity, or proportionality of a restriction. Source summaries require current, jurisdiction-specific review.</p>{report.disclaimer && report.disclaimer !== DISCLAIMER && <p className="mt-3 text-xs text-muted">Record disclaimer: {report.disclaimer}</p>}</div></section>
    </div>
  </>;
}
