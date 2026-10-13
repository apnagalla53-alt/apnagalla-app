# Report questions and daily in-app summaries

Phase 5.6 adds authoritative profit, COGS, margin, coverage and stock valuation questions
to the deterministic in-app Assistant. Hindi/Hinglish item profit and loss answers use
the same saved facts and scoped queries as Home and financial reports. Unknown costs
produce incomplete-profit warnings; service revenue does not imply known direct cost.
See [Financial report definitions](FINANCIAL_REPORTS.md) and [costing policy](COSTING_AND_PROFIT.md).

Open **Reports → Ask about your shop**. Ask in Hindi, Hinglish or English and select the business date and answer language.

Examples:

- `आज कितने लोगों को उधार दिया` / `aaj kitne logo ko udhaar diya`
- `aaj konsa naya maal aaya`
- `today sales`, `aaj kharch`, `daily galla`

This first version recognizes supported report intents and executes tenant/branch-scoped queries. It does not send shop data to an external AI model, generate arbitrary SQL, or guess unsupported answers. Unsupported questions show an understandable error.

| Answer | Definition |
| --- | --- |
| Udhar | Original credit at bill creation from invoice totals and immutable payment snapshots; later collections do not rewrite credit originally given |
| New maal | Posted `PURCHASE_IN` movements; excludes imported opening stock |
| Sales, expenses, galla | Existing authoritative daily accounting/payment summary; UPI/card do not increase physical drawer cash |

Amounts are real posted values. Detail lists show at most 50 records; exact totals and definitions are expandable. Financial days above the 10,000-record safety limit require the detailed report/export, rather than returning partial totals as complete. Query requests are rate limited. The selected business date takes precedence over date words in the question.

## Automatic summaries

The owner opts in, chooses a time in **Asia/Kolkata** and selects Hindi or English. The API checks eligible preferences once per minute and stores one summary per business/branch/owner/day after the chosen time. The summary is a snapshot at generation time, not a continuously recalculated end-of-day close. Prefer a time after closing if that is the intended meaning.

The Home notification bell and Reports inbox read these prefetched records. Visible pages refresh their inbox every minute; unread records can be marked read. Delivery is **in-app only**, as requested. No browser push, WhatsApp or email provider is involved.

Disabled/locked users, removed owner memberships, inactive/expired subscriptions and disabled Retail entitlements do not receive new scheduled summaries. Multiple API instances are protected by a database uniqueness constraint. Per-shop errors are logged without secrets and retried on later ticks.

## Operation and limits

Keep a production API worker running; a scale-to-zero server cannot run the in-process scheduler while asleep. Production/dev enable the scheduler automatically; tests enable it only with `REPORT_SCHEDULER_ENABLED=true`. Restarting after the selected time can generate today's missing summary. Missed prior days are not backfilled. Monitor API availability, generic generation failures and summary freshness before promising scheduled delivery to customers.

The voice-note WhatsApp assistant is a separate future provider integration described in [WhatsApp Voice Assistant](WHATSAPP_VOICE_ASSISTANT.md). These report intents can form its safe read-only tool layer, but this release does not claim live WhatsApp voice transcription or voice-note replies.
