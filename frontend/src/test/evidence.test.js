import { describe, expect, it } from 'vitest';
import { confidencePercent, indicatorState, telemetrySummary, validateUrl, safeUrl } from '../lib/evidence';

describe('evidence interpretation', () => {
  it('preserves mixed samples instead of displaying only the latest response', () => {
    const result = telemetrySummary([
      { vantage_point: 'IN-A', country_code: 'IN', http_status: 403 },
      { vantage_point: 'IN-A', country_code: 'IN', http_status: 200 },
      { vantage_point: 'US-East', country_code: 'US', http_status: 200 },
    ]);
    expect(result[0].codes).toEqual([403, 200]);
    expect(result[0].mixed).toBe(true);
    expect(result[1].mixed).toBe(false);
  });
  it('does not render an unknown procedural fact as absent', () => {
    expect(indicatorState(null).label).toBe('Unknown · not assessed');
    expect(indicatorState(undefined).label).toBe('Unknown · not assessed');
    expect(indicatorState(false).label).toBe('Not established');
    expect(indicatorState(true).label).toBe('Established');
  });
  it('flags a blocking string even on a 200 response', () => {
    expect(telemetrySummary([{ vantage_point: 'IN', country_code: 'IN', http_status: 200, dom_signature_matched: 'blocked' }])[0].blocked).toBe(true);
  });
  it('handles missing and out-of-range confidence values', () => {
    expect(confidencePercent(null)).toBeNull();
    expect(confidencePercent(0)).toBe(0);
    expect(confidencePercent(0.75)).toBe(75);
    expect(confidencePercent(8)).toBe(100);
  });
  it('rejects unsafe link protocols and credential-bearing URLs', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(validateUrl('ftp://example.com')).not.toBe('');
    expect(validateUrl('https://user:secret@example.com')).not.toBe('');
    expect(validateUrl('https://example.com/page')).toBe('');
  });
});
