import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import Submit from '../pages/Submit';
import Feed from '../pages/Feed';
import Dossier from '../pages/Dossier';

function Destination() { const { id } = useParams(); return <h1>Dossier {id}</h1>; }
const response = data => Promise.resolve({ ok: true, json: async () => data });
beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());

async function completeIntake(user) {
  await user.type(screen.getByLabelText(/Target URL/), 'https://example.com/resource');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.click(screen.getByRole('radio', { name: /Geo-blocked notice/ }));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('citizen intake', () => {
  it('keeps values between steps, uses API enums, and redirects after submission', async () => {
    fetch.mockImplementation(() => response({ id: 'lead-123' }));
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/submit']}><Routes><Route path="/submit" element={<Submit />} /><Route path="/dossier/:id" element={<Destination />} /></Routes></MemoryRouter>);
    await completeIntake(user);
    expect(screen.getByLabelText(/Region reported/)).toHaveValue('India/Bengaluru');
    await user.type(screen.getByLabelText(/Internet provider/), 'Airtel');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('radio', { name: /Geo-blocked notice/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText(/Internet provider/)).toHaveValue('Airtel');
    await user.click(screen.getByRole('button', { name: 'Submit lead' }));
    expect(await screen.findByRole('heading', { name: 'Dossier lead-123' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('/api/v1/reports');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ platform: 'WebDomain', reported_issue: 'GeoBlockedNotice', reported_region: 'India/Bengaluru', reported_isp: 'Airtel', notes: null });
  });
  it('retains the form and surfaces backend validation errors', async () => {
    fetch.mockResolvedValue({ ok: false, status: 422, json: async () => ({ detail: [{ loc: ['body', 'target_url'], msg: 'A public hostname is required.' }] }) });
    const user = userEvent.setup();
    render(<MemoryRouter><Submit /></MemoryRouter>);
    await completeIntake(user);
    await user.click(screen.getByRole('button', { name: 'Submit lead' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A public hostname is required.');
    expect(screen.getByLabelText(/Region reported/)).toHaveValue('India/Bengaluru');
    expect(screen.getByRole('button', { name: 'Submit lead' })).toBeEnabled();
  });
});

describe('feed API integration', () => {
  it('maps News / Websites to WebDomain and sends status and region filters to the API', async () => {
    fetch.mockImplementation(url => response(url.includes('/stats') ? { total_leads: 0, confirmed_blocks: 0, active_probes: 0, top_flagged_domains: [] } : { items: [], total: 0 }));
    const user = userEvent.setup();
    render(<MemoryRouter><Feed /></MemoryRouter>);
    await screen.findByText('The public record starts with a lead.');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Platform' }), 'WebDomain');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'GLOBAL_OUTAGE');
    await user.type(screen.getByRole('textbox', { name: 'Region' }), 'Delhi');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.includes('platform=WebDomain') && url.includes('status=GLOBAL_OUTAGE') && url.includes('region=Delhi'))).toBe(true));
    expect(await screen.findByText('No reports match these filters.')).toBeInTheDocument();
  });
});

const dossier = {
  id: 'record-123', target_url: 'https://example.com/resource', platform: 'WebDomain',
  status: 'CONFIRMED_REGIONAL_RESTRICTION', reported_region: 'India/Bengaluru',
  created_at: '2026-09-16T12:00:00Z', is_simulation: true,
  telemetry: [{ id: 'probe-1', vantage_point: 'Node-IN-South', country_code: 'IN', is_domestic: true,
    http_status: 451, dns_resolved: null, response_time_ms: 120.5, egress_type: 'MockFixture',
    is_simulation: true, attempt: 1, timestamp: '2026-09-16T12:00:00Z' }],
  legal_audit: { primary_jurisdiction: 'India', applicable_frameworks: ['Section 69A IT Act'],
    procedural_indicators: { notice_to_originator_traceable: null, public_order_available: false },
    potential_concerns: ['Underlying orders require review.'], confidence_score: 0,
    confidence_basis: 'HTTP observations only, zero for fixtures.', citations: [] },
};

describe('dossier', () => {
  it('shows unknown DNS and legal indicators, frameworks, and a zero confidence bar', async () => {
    fetch.mockImplementation(() => response(dossier));
    render(<MemoryRouter initialEntries={['/dossier/record-123']}><Routes><Route path="/dossier/:id" element={<Dossier />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'example.com' })).toBeInTheDocument();
    expect(screen.getByText('Unknown · not assessed')).toBeInTheDocument();
    expect(screen.getByText('Not established')).toBeInTheDocument();
    expect(screen.getByText('Section 69A IT Act')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText(/Simulated evidence/)).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Unknown' })).toBeInTheDocument();
  });
  it('offers print export using the browser print dialog', async () => {
    fetch.mockImplementation(() => response(dossier));
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<MemoryRouter initialEntries={['/dossier/record-123']}><Routes><Route path="/dossier/:id" element={<Dossier />} /></Routes></MemoryRouter>);
    await userEvent.click(await screen.findByRole('button', { name: 'Print to PDF' }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });
  it('renders a useful missing-dossier error', async () => {
    fetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({ detail: 'Report not found' }) });
    render(<MemoryRouter initialEntries={['/dossier/missing']}><Routes><Route path="/dossier/:id" element={<Dossier />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Report not found');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
