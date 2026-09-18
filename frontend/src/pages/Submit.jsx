import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Info, LoaderCircle, ShieldCheck } from 'lucide-react';
import { submitReport } from '../lib/api';
import { PLATFORMS, SYMPTOMS, validateUrl } from '../lib/evidence';
import { ErrorState } from '../components/States';

const STEPS = ['The resource', 'Your observation', 'Context & submit'];
const INITIAL = { target_url: '', platform: 'WebDomain', reported_issue: 'HTTP451', reported_region: 'India/Bengaluru', reported_isp: '', notes: '' };

export default function Submit() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const heading = useRef(null);
  function update(event) { setForm(previous => ({ ...previous, [event.target.name]: event.target.value })); }
  function changeStep(value) { setStep(value); setError(''); setTimeout(() => heading.current?.focus(), 0); }
  async function next(event) {
    event.preventDefault();
    if (submitting.current) return;
    const problem = validateUrl(form.target_url);
    if (problem) { setStep(0); setError(problem); return; }
    if (step < 2) { changeStep(step + 1); return; }
    if (form.reported_region.trim().length < 2) { setError('Enter a reported region with at least two characters.'); return; }
    submitting.current = true;
    setBusy(true); setError('');
    try {
      const report = await submitReport({ ...form, target_url: form.target_url.trim(), reported_region: form.reported_region.trim(), reported_isp: form.reported_isp.trim() || null, notes: form.notes.trim() || null });
      navigate(`/dossier/${report.id}`, { state: { submitted: true } });
    } catch (err) { setError(err.message); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <div className="mx-auto max-w-5xl">
    <Link to="/" className="text-link mb-7"><ArrowLeft size={15} />Back to the public record</Link>
    <p className="eyebrow mb-3">Citizen intake / No account required</p>
    <h1 className="page-title">Document what you saw.</h1>
    <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">A resource out of reach is worth investigating. Share an observation in three short steps.</p>
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="panel overflow-hidden">
        <ol aria-label="Submission progress" className="grid grid-cols-3 gap-3 border-b border-line px-5 py-5 sm:px-7">
          {STEPS.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} className={`text-xs leading-relaxed ${step === index ? 'text-signal' : 'text-muted'}`}><span className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full border font-mono ${index <= step ? 'border-signal/50 bg-signal/10 text-signal' : 'border-line'}`}>{index < step ? <Check size={14} /> : index + 1}</span>{label}</li>)}
        </ol>
        <form className="p-5 sm:p-7" onSubmit={next}>
          <h2 ref={heading} tabIndex={-1} className="mb-6 text-xl font-semibold outline-none">{STEPS[step]}</h2>
          <fieldset disabled={busy} className="min-w-0 space-y-6">
            <legend className="sr-only">{STEPS[step]}</legend>
            {step === 0 && <>
              <div><label className="field-label" htmlFor="target-url">Target URL <span className="text-signal">*</span></label><input className="field" id="target-url" name="target_url" type="url" required maxLength={2048} placeholder="https://example.com/resource" value={form.target_url} onChange={update} aria-describedby="url-help" /><p id="url-help" className="mt-2 text-xs leading-relaxed text-muted">Use the full public link. Remove login credentials, access tokens, and personal information.</p></div>
              <div><label className="field-label" htmlFor="platform">Platform / category</label><select className="field" id="platform" name="platform" value={form.platform} onChange={update}>{PLATFORMS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><p className="mt-2 text-xs text-muted">News / Websites is recorded as the API’s WebDomain category.</p></div>
            </>}
            {step === 1 && <fieldset><legend className="field-label">Observed symptom <span className="text-signal">*</span></legend><div className="space-y-3">{SYMPTOMS.map(item => <label key={item.value} className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors ${form.reported_issue === item.value ? 'border-signal/50 bg-signal/5' : 'border-line hover:border-slate-500'}`}><input type="radio" className="mt-1 accent-signal" name="reported_issue" value={item.value} checked={form.reported_issue === item.value} onChange={update} /><span><span className="block text-sm font-medium">{item.label}</span><span className="mt-1 block text-sm text-muted">{item.detail}</span></span></label>)}</div><p className="mt-4 text-xs leading-relaxed text-muted">Unauthenticated network checks cannot independently establish search delisting or account suspension. Those observations remain citizen-reported.</p></fieldset>}
            {step === 2 && <>
              <div className="rounded-md border border-line bg-ink p-4 text-sm"><p className="break-all font-medium">{form.target_url}</p><p className="mt-2 text-muted">{PLATFORMS.find(item => item.value === form.platform)?.label} · {SYMPTOMS.find(item => item.value === form.reported_issue)?.label}</p></div>
              <div><label className="field-label" htmlFor="region">Region reported <span className="text-signal">*</span></label><input className="field" id="region" name="reported_region" required minLength={2} maxLength={200} value={form.reported_region} onChange={update} /></div>
              <div><label className="field-label" htmlFor="isp">Internet provider <span className="font-normal text-muted">(optional)</span></label><input className="field" id="isp" name="reported_isp" maxLength={200} placeholder="e.g. Airtel, Jio, ACT" value={form.reported_isp} onChange={update} /></div>
              <div><label className="field-label" htmlFor="notes">Contextual notes <span className="font-normal text-muted">(optional)</span></label><textarea className="field min-h-32 resize-y" id="notes" name="notes" rows={4} maxLength={2000} placeholder="What message appeared? When did you notice the issue?" value={form.notes} onChange={update} aria-describedby="notes-help" /><p id="notes-help" className="mt-2 text-xs text-muted">{form.notes.length}/2,000 characters. Do not include personal information.</p></div>
              <div className="flex items-start gap-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-relaxed text-amber-200"><Info size={18} className="mt-0.5 shrink-0" /><p>Your URL, region, provider, and notes appear in the public feed. No name or account is requested; this is not a guarantee of network anonymity.</p></div>
            </>}
          </fieldset>
          {error && <ErrorState message={error} />}
          <p role="status" aria-live="polite" className="mt-4 text-sm text-muted">{busy ? 'Submitting your lead and opening its evidence dossier…' : ''}</p>
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-5">
            {step ? <button type="button" className="button-secondary" disabled={busy} onClick={() => changeStep(step - 1)}><ArrowLeft size={16} />Back</button> : <Link to="/" className="text-link">Cancel</Link>}
            <button type="submit" className="button-primary" disabled={busy}>{busy ? <LoaderCircle size={17} className="animate-spin" /> : null}{busy ? 'Submitting…' : step === 2 ? 'Submit lead' : 'Continue'}{!busy && <ArrowRight size={16} />}</button>
          </div>
        </form>
      </div>
      <aside className="space-y-6 text-sm leading-relaxed"><ShieldCheck size={27} className="text-signal" /><h2 className="font-editorial text-2xl">An observation.<br />Not an accusation.</h2><p className="text-slate-200">Submitted URLs are treated as unverified citizen leads until our multi-vantage network probes reproduce the restriction.</p><div className="border-t border-line pt-5 text-muted"><p>We record the lead, compare repeated network observations, and attach relevant statutory research.</p><p className="mt-4">Mock-mode checks are always labeled as simulations and cannot confirm a real restriction.</p></div><Link to="/about" className="text-link">Explore the methodology<ArrowRight size={15} /></Link></aside>
    </div>
  </div>;
}
