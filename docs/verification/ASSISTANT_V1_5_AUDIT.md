# Assistant V1.5 independent audit — 8 October 2026

Scope: extend the existing deterministic Assistant with read-only business diagnosis over Phase 5.6. Preserve the Retail and costing engines, and all preexisting workspace changes.

## Baseline

Git is extensively modified/untracked from earlier authorized phases. No reset or cleanup performed. No AGENTS.md found. Backend TypeScript validation passes. Freshly executed Assistant, costing-profit, universal-item-flow and batch-fefo suites: **164 passed, zero failed, exit 0**. Build/migration evidence is being recorded separately.

## Findings before implementation

| Severity | Finding | Required resolution |
|---|---|---|
| CRITICAL | No diagnosis exists; current profit pattern can answer a why-question with a factual total | Explicit diagnosis intents ahead of fact patterns; refuse unsupported causality |
| HIGH | Existing parser selects a full previous month when both current/previous periods appear | Fair MTD/WTD and equal-length periods with visible comparison dates |
| HIGH | No reconciled primary decomposition or overlapping-dimension policy | Exact sales/profit identities; item/category/staff are alternative drill-downs, never summed together |
| HIGH | Partial known costs are represented by Phase 5.6; diagnosis could overstate complete profit | Propagate both periods' coverage and incomplete/service warnings |
| HIGH | Existing read boundary rejects `compare karo` and controlled read follow-ups | Allow narrowly defined compare/show reads, retain write/SQL/secret rejection |
| HIGH | Owner-only operational dimensions could leak through a broad report permission | Declare dependent permissions/features for cash, parties, inventory and purchases before resolution/execution |
| MEDIUM | Existing stock tool is current-state only | Historical movement reconstruction must disclose recorded physical availability, not invent lost sales or expiry availability |
| MEDIUM | Revenue reports have two intentional definitions: invoice checkout includes GST, financial net sales excludes GST | Label both; diagnosis net sales/profit reuse financial facts, payments use Counter |
| MEDIUM | Existing analytics lacks diagnosis insufficient-data and latency breakdown | Record operational metadata only; platform receives no financial answer payload |
| MEDIUM | Only factual cards/table exist | Structured mobile comparison, driver evidence labels, drill-downs and follow-up chips |
| LOW | Docs still describe 50 intents although Phase 5.6 adds ten | Update catalog/documented counts from runtime code after regression |

## Implementation boundary

BusinessInsightService orchestrates FinancialReportsService, OperationalReportsService and CounterService. Additional aggregate read models belong in those existing reporting facades. No new profit formula, financial-result cache, external LLM, writes, autonomous actions, WhatsApp or voice AI. Queries must be tenant/branch scoped, parameterized, bounded and explicit on insufficient history. Index decisions follow the new query patterns, rather than speculative additions.
