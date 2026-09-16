export type Status = 'REPORTED' | 'IN_VERIFICATION' | 'CONFIRMED_REGIONAL_RESTRICTION' | 'GLOBAL_OUTAGE' | 'ANOMALY_INCONCLUSIVE' | 'UNRESTRICTED';
export interface Telemetry { id: string; vantage_point: string; country_code: string; is_domestic: boolean; egress_type: string; http_status: number | null; dns_resolved: boolean | null; dom_signature_matched: string | null; response_time_ms: number; timestamp: string; is_simulation: boolean; error: string | null; attempt: number }
export interface Evidence { id: string; target_url: string; platform: string; reported_issue: string; reported_region: string; reported_isp: string | null; notes: string | null; status: Status; created_at: string; is_simulation: boolean; verification_error: string | null; telemetry: Telemetry[] }
export interface Source { id: string; title: string; url: string; locator: string; jurisdiction: string; scope: string; text: string; retrieval_similarity: number }
export interface Audit { primary_jurisdiction: string; applicable_frameworks: string[]; procedural_indicators: Record<string, boolean | null>; potential_concerns: string[]; confidence_score: number; confidence_basis: string; citations: Source[]; disclaimer: string; generated_at: string; generation_mode: string }
export interface Dossier extends Evidence { legal_audit: Audit | null; disclaimer: string }
export interface Feed { items: Evidence[]; total: number; page: number; page_size: number }
export interface Stats { total_leads: number; confirmed_blocks: number; active_probes: number; queued_leads: number; simulated_leads: number; top_flagged_domains: {domain: string; count: number}[] }
export interface Health { status: string; probe_mode: string; vantage_count: number; embedded_worker: boolean }
