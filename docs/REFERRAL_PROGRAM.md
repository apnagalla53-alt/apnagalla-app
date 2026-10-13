# Referral program

Owners have opaque referral codes and `/signup?ref=CODE` links. The signup page retains the code in session storage while the user changes sign-in methods. Verified signup records an attribution; business setup binds it to the new tenant. Repeated signup of the same verified identity cannot create another attribution. The shared link contains no raw tenant UUID.

Campaigns support TRACKING_ONLY, SUBSCRIPTION_DAYS, ACCOUNT_CREDIT and FIXED_REWARD. Campaign rules are snapshotted at signup so later edits do not silently alter an earned promise. Without a configured campaign, referrals only track invitations and advertise no reward.

Qualification is checked server-side from actual signup, subscription state and non-refunded paid receipts. Platform review is required before a reward. Subscription days extend the referrer's existing expiry without manufacturing a paid receipt. Account credits are recorded manual credits; checkout redemption is not integrated. Fixed rewards require the actual payout reference and do not initiate payment. Duplicate reward approval is rejected under a database lock and unique constraint.

ACTIVE_DAYS means continuous eligible subscription time after a positive, non-refunded paid receipt. Recorded suspension, archive, restoration, reactivation and renewal after expiry reset that period. Trial time alone is not paid conversion. Qualification refreshes during subscription/payment controls or an explicit Platform review refresh; there is no background reward-payment scheduler. Fraud and billing policy changes still require an operator review.

Self-referrals, same business and same verified identity are blocked. Staff cannot access the owner invitation endpoint. Platform can reject questionable records with an audited reason. A fully issued reward cannot be silently rejected: a separately reviewed reversal is required. Broad fraud-scoring, automatic payouts and online credit redemption are not implemented.

Owner totals cover the complete attribution history; the list shows the latest 100 records. Platform review is paginated. No referred user phone/email is exposed to the referrer. Conversion and monetary reward records derive from actual database records.
