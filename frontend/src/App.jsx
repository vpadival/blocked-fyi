import { useEffect } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import Navbar from './components/Navbar';
import Feed from './pages/Feed';
import Submit from './pages/Submit';
import Dossier from './pages/Dossier';
import About from './pages/About';
import useApi from './hooks/useApi';
import { SimulationNotice } from './components/States';
import { DISCLAIMER } from './lib/evidence';

function Observatory() {
  const health = useApi('/health', 15000);
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  return <div className="flex min-h-screen flex-col">
    <a href="#main" className="skip-link sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-signal focus:p-3 focus:text-ink">Skip to content</a>
    <Navbar />
    <div className="page-width no-print pt-5">{health.data?.probe_mode === 'mock' ? <SimulationNotice compact /> : health.data?.probe_mode === 'live' ? <p className="flex items-center gap-2 text-sm text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" />Live environment · {health.data.vantage_count} configured vantage points</p> : <p className="text-sm text-muted">{health.error ? 'API connection unavailable. Evidence may be out of date.' : 'Connecting to the observatory…'}</p>}</div>
    <main id="main" tabIndex={-1} className="page-width flex-1 py-9 sm:py-12"><Routes>
      <Route path="/" element={<Feed />} />
      <Route path="/submit" element={<Submit />} />
      <Route path="/dossier/:id" element={<Dossier />} />
      <Route path="/about" element={<About />} />
      <Route path="/methodology" element={<Navigate to="/about" replace />} />
      <Route path="*" element={<div className="py-20 text-center"><h1 className="page-title">Page not found.</h1><p className="my-5 text-muted">This page is not part of the public record.</p><Link to="/" className="button-primary">Return to the feed</Link></div>} />
    </Routes></main>
    <footer className="mt-6 border-t border-line"><div className="page-width py-7"><p className="flex items-start gap-3 text-sm leading-relaxed text-slate-200"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-signal" />{DISCLAIMER}</p><div className="mt-5 flex flex-wrap justify-between gap-3 text-xs text-muted"><span>Blocked.fyi · LexHack 2026 / Digital Rights &amp; Policy Tech</span><Link className="hover:text-paper" to="/about">Read our methodology →</Link></div></div></footer>
  </div>;
}

export default function App() { return <BrowserRouter><Observatory /></BrowserRouter>; }
