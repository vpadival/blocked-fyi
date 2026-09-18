import { Link, NavLink } from 'react-router-dom';
import { ArrowUpRight, ScanLine } from 'lucide-react';

export default function Navbar() {
  return <header className="border-b border-line bg-ink">
    <div className="page-width flex flex-wrap items-center justify-between gap-5 py-6">
      <Link to="/" className="flex items-start gap-3" aria-label="Blocked.fyi home">
        <span className="mt-0.5 rounded-md bg-signal p-2 text-ink"><ScanLine size={24} strokeWidth={2.5} /></span>
        <div><div className="text-2xl font-bold tracking-tight">Blocked<span className="text-signal">.fyi</span></div>
          <p className="mt-1 max-w-72 text-xs leading-relaxed text-muted sm:max-w-none">Civic Censorship Observatory &amp; Legal Evidence Pipeline</p></div>
      </Link>
      <nav aria-label="Main navigation" className="flex w-full items-center gap-1 text-sm sm:w-auto sm:gap-3">
        {[[ '/', 'Feed' ], [ '/submit', 'Submit a Lead' ], [ '/about', 'About / Methodology' ]].map(([path, label]) =>
          <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => `flex min-h-11 items-center gap-1 rounded-md px-3 py-2 transition-colors ${isActive ? 'bg-white/5 text-signal' : 'text-muted hover:bg-white/5 hover:text-paper'}`}>
            {label}{path === '/submit' && <ArrowUpRight size={14} aria-hidden="true" />}
          </NavLink>)}
      </nav>
    </div>
  </header>;
}
