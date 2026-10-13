# Approving new shop access

Google signup verifies an identity. Creating a shop and requesting Starter, Smart or Pro leaves its subscription **PENDING**. The owner cannot enter Retail until a trial or subscription is approved.

## Temporary access while the payment gateway is not connected

1. Sign in to **Platform administration** as Super Admin.
2. Open **Organizations**. Set **Access requests → Pending access requests**.
3. Find the owner/shop and select **Review / grant access**.
4. Enter a meaningful **Reason for administrative changes**. This enables the administrative controls and records your reason in the audit log.
5. In **Grant access**, confirm the requested **Access plan**. Select **Complimentary / temporary access**, then choose the number of days.
6. Click **Grant access**. The backend activates the organization and selected subscription atomically. Complimentary access records no payment or revenue.
7. The owner selects **Check activation status**, then **Start fresh** or **Import my existing data**. Their existing Google session can continue through setup.

“Activate / reactivate” changes organization status. It does not approve a pending subscription; use **Grant access** for that step.

## Actual manual payment

1. Check that payment was actually received.
2. Open the shop’s **Billing** tab and record the receipt against its requested plan, with a unique reference and correct amount/period.
3. Return to **Grant access**. Select **Verified manual payment** and the recorded paid receipt for the selected plan.
4. Choose the covered duration and approve. The backend rejects a missing, unpaid, refunded, foreign-shop or different-plan receipt, and durations longer than its recorded period permits. The audit links the receipt to the approval.

These controls are Super Admin operations. Tenant tokens cannot approve access. A second approval of an already approved request cannot extend expiry or generate another approval. Archived tenants must first be restored through their existing lifecycle controls.

## Future payment gateway integration

Online payment confirmation is currently **NOT CONFIGURED**. Plan selection, QR display, a browser success URL and an unverified webhook must never activate access.

A future integration needs a server-created order that snapshots the tenant, plan, billing period, amount and currency; a configured provider adapter; provider signature verification; and server-side verification of the paid order. Never accept the plan or price solely from the browser/callback payload.

Persist provider event/order identifiers with unique constraints. In one database transaction, record the verified receipt and activate only its tenant/plan for the purchased period. Duplicate callbacks must return the previously committed result without charging, posting or extending twice. Handle pending/failed/refunded events separately, record an audit trail, and test invalid signatures, wrong amount/currency, foreign order IDs, replay and concurrent delivery.

The current admin approval action is protected by platform authentication and is not a payment webhook. A provider integration must use its own verification boundary and automated integration tests before automatic activation can be enabled.
