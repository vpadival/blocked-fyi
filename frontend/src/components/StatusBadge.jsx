import { STATUS } from '../lib/evidence';

export default function StatusBadge({ status }) {
  const style = STATUS[status] || { label: status || 'Unknown', classes: 'bg-gray-500/10 text-gray-300 border-gray-500/20' };
  return <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold leading-snug ${style.classes}`}>
    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />{style.label}
  </span>;
}
