import { Globe2, Instagram, Youtube, Newspaper, MessageSquare } from 'lucide-react';
const icons = { Instagram, YouTube: Youtube, WebDomain: Newspaper, Other: Globe2, X: MessageSquare };

export default function PlatformLabel({ platform }) {
  const Icon = icons[platform] || Globe2;
  return <span className="inline-flex items-center gap-1.5 rounded border border-line px-2 py-1 text-xs text-muted"><Icon size={13} />{platform === 'WebDomain' ? 'Website' : platform}</span>;
}
