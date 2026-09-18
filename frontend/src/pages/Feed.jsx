import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Activity, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, FileText, Globe2, Plus, Search, ShieldCheck } from 'lucide-react';
import useApi from '../hooks/useApi';
import { domain, PLATFORMS, STATUS, dateTime } from '../lib/evidence';
import StatusBadge from '../components/StatusBadge';
import PlatformLabel from '../components/PlatformLabel';
import TelemetrySummary from '../components/TelemetrySummary';
import { ErrorState, Loading } from '../components/States';

export default function Feed() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const platform = params.get('platform') || '';
  const region = params.get('region') || '';
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
  const [regionInput, setRegionInput] = useState(region);
  useEffect(() => setRegionInput(region), [region]);
  const query = new URLSearchParams({ page: String(page), page_size: '10' });
  if (status) query.set('status', status);
  if (platform) query.set('platform', platform);
  if (region) query.set('region', region);
  const feed = useApi(`/reports?${query}`, 5000);
  const stats = useApi('/stats', 5000);
  function filter(key, value) {
    setParams(previous => { const next = new URLSearchParams(previous); value ? next.set(key, value) : next.delete(key); next.delete('page'); return next; });
  }
  function setPage(value) { setParams(previous => { const next = new URLSearchParams(previous); next.set('page', String(value)); return next; }); }
  const domains = stats.data?.top_flagged_domains || [];
  return <>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div><p className="eyebrow mb-3">The public record / Network access</p><h1 className="page-title">Evidence, in the open.</h1><p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">Citizen leads. Independent network checks. Legal context you can trace.</p></div>
      <Link to="/submit" className="button-primary"><Plus size={17} />Submit a Lead</Link>
    </div>
    {stats.error && <ErrorState message={stats.error} retry={stats.retry} stale={Boolean(stats.data)} />}
    <section aria-label="Observatory statistics" className="mb-8 grid grid-cols-2 divide-x divide-line border-y border-line lg:grid-cols-4">
      {[
        { label: 'Total Reports', value: stats.data?.total_leads, Icon: FileText, note: `${stats.data?.simulated_leads ?? '—'} labeled simulations included` },
        { label: 'Confirmed Regional Blocks', value: stats.data?.confirmed_blocks, Icon: ShieldCheck, note: 'Real observations only', color: 'text-red-400' },
        { label: 'Active Probes', value: stats.data?.active_probes, Icon: Activity, note: `${stats.data?.queued_leads ?? '—'} leads awaiting verification` },
      ].map(({ label, value, Icon, note, color }) => <div key={label} className="min-w-0 px-4 py-6 first:pl-0 sm:px-6"><div className="flex items-start justify-between gap-2 text-sm text-muted"><span>{label}</span><Icon size={17} /></div><p className={`my-3 font-mono text-4xl ${color || 'text-paper'}`}>{value?.toLocaleString() ?? '—'}</p><p className="text-xs leading-relaxed text-muted">{note}</p></div>)}
      <div className="min-w-0 px-4 py-6 sm:px-6"><div className="flex items-center justify-between gap-2 text-sm text-muted">Top Blocked Domains<Globe2 size={17} /></div>
        {domains.length ? <ol className="mt-4 space-y-2 text-sm">{domains.slice(0, 3).map(item => <li key={item.domain} className="flex justify-between gap-3"><span className="truncate" title={item.domain}>{item.domain}</span><strong className="font-mono text-red-400">{item.count}</strong></li>)}</ol> : <><p className="my-3 text-lg">{stats.loading ? 'Loading…' : stats.error && !stats.data ? 'Unavailable' : 'None confirmed'}</p><p className="text-xs text-muted">Simulated restrictions excluded</p></>}
      </div>
    </section>
    <section className="panel overflow-hidden" aria-label="Evidence feed">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6"><h2 className="text-lg font-semibold">Reported resources <span className="ml-2 font-mono text-sm font-normal text-muted">{feed.data?.total ?? '—'}</span></h2><span className="flex items-center gap-2 text-xs text-muted"><span className={`h-1.5 w-1.5 rounded-full ${feed.error ? 'bg-amber-400' : 'bg-signal'}`} />{feed.error ? 'Updates interrupted' : 'Updates every 5 seconds'}</span></div>
      <div className="grid gap-3 px-5 pb-5 sm:px-6 lg:grid-cols-[1fr_auto_auto]">
        <form className="flex min-w-0 gap-2" onSubmit={event => { event.preventDefault(); filter('region', regionInput.trim()); }}><label className="relative min-w-0 flex-1"><span className="sr-only">Region</span><Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-muted" /><input className="field pl-10" placeholder="Filter by region…" maxLength={200} value={regionInput} onChange={event => setRegionInput(event.target.value)} /></label><button className="button-secondary" type="submit">Search</button></form>
        <label><span className="sr-only">Status</span><select aria-label="Status" className="field text-sm" value={status} onChange={event => filter('status', event.target.value)}><option value="">All statuses</option>{Object.entries(STATUS).map(([key, value]) => <option value={key} key={key}>{value.label}</option>)}</select></label>
        <label><span className="sr-only">Platform</span><select aria-label="Platform" className="field text-sm" value={platform} onChange={event => filter('platform', event.target.value)}><option value="">All platforms</option>{PLATFORMS.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
      </div>
      {(status || platform || region) && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-xs text-muted"><span>Filtered results{region && ` · ${region}`}{platform === 'WebDomain' && ' · News / Websites includes all WebDomain reports'}</span><button className="text-link" onClick={() => { setRegionInput(''); setParams({}); }}>Clear filters</button></div>}
      {feed.error && <div className="px-5"><ErrorState message={feed.error} retry={feed.retry} stale={Boolean(feed.data)} /></div>}
      {feed.loading ? <Loading /> : feed.data?.items.length ? <div className="table-scroll"><table className="data-table min-w-[1000px]"><thead><tr><th>Resource / Category</th><th>Reported location</th><th>Observed telemetry</th><th>Verification status</th><th><span className="sr-only">Dossier</span></th></tr></thead><tbody>{feed.data.items.map(report => <tr key={report.id} className="hover:bg-white/[.02]">
        <td className="max-w-80"><Link className="break-all text-base font-semibold hover:text-signal" to={`/dossier/${report.id}`}>{domain(report.target_url)}</Link><p className="mb-3 mt-1 truncate text-xs text-muted" title={report.target_url}>{report.target_url}</p><div className="flex flex-wrap gap-2"><PlatformLabel platform={report.platform} />{report.is_simulation && <span className="rounded border border-amber-500/25 px-2 py-1 font-mono text-xs text-amber-300">SIMULATED</span>}</div></td>
        <td><p>{report.reported_region}</p><p className="mt-2 text-xs text-muted">{report.reported_isp || 'ISP not provided'}</p></td><td><TelemetrySummary rows={report.telemetry} /><p className="mt-2 text-xs text-muted">All retained samples</p></td><td><StatusBadge status={report.status} /><p className="mt-3 text-xs text-muted">{dateTime(report.created_at)}</p></td><td><Link to={`/dossier/${report.id}`} className="text-link whitespace-nowrap" aria-label={`View dossier for ${domain(report.target_url)}`}>Dossier<ArrowUpRight size={16} /></Link></td>
      </tr>)}</tbody></table></div> : feed.data && <div className="px-5 py-16 text-center"><Search className="mx-auto mb-4 text-muted" size={28} /><h3 className="text-lg">{status || platform || region ? 'No reports match these filters.' : 'The public record starts with a lead.'}</h3><p className="my-3 text-sm text-muted">{status || platform || region ? 'Clear your filters or try a broader region.' : 'Share what you observed to begin independent verification.'}</p><Link to="/submit" className="text-link">Submit a Lead<ArrowRight size={16} /></Link></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 text-xs text-muted"><span>{feed.data?.total ? `${(page - 1) * 10 + 1}–${Math.min(page * 10, feed.data.total)} of ${feed.data.total} reports` : 'No results on this page'}</span><div className="flex items-center gap-3"><button className="button-secondary px-3" aria-label="Previous page" disabled={page === 1 || feed.loading} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button><span>Page {page}</span><button className="button-secondary px-3" aria-label="Next page" disabled={feed.loading || !feed.data || page * 10 >= feed.data.total} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button></div></div>
    </section>
    <p className="mt-5 flex items-start gap-2 text-sm leading-relaxed text-muted"><ShieldCheck size={17} className="mt-0.5 shrink-0" />A report is a lead, not a finding. Geographic discrepancies do not establish who caused a restriction or whether it is lawful.</p>
  </>;
}
