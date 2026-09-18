import { DISCLAIMER } from './evidence';

export function exportDossier(report) {
  const document = { ...report, export_research_disclaimer: DISCLAIMER };
  const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = `blocked-fyi-${report.id}.json`;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
