# Startup and sign-in visual release — 21 October 2026

Replace the unstyled account-check message with an eagerly styled branded startup screen. Show a connection message after eight seconds and an accessible retry action on failure. Add two lightweight green SVG wave layers behind the sign-in/create-account form, with reduced-motion support and no interception of form input.

This is the owner-authorized production publication of the preview documented in STARTUP_SCREEN_20261020.md. Its earlier "local preview only" statement records the preview stage. The existing billing, business personalization, footwear and service changes were already deployed on 20 October.

## Validation before publication

- Clean publication checkout matches GitHub apnagalla53-alt/apnagalla-app main before applying the explicit nine-file preview manifest. Existing file baselines match the saved preview baselines.
- Locked frontend dependencies installed with npm ci; production build passes.
- All 87 existing frontend unit tests pass.
- Built frontend checked in Edge at widths 320, 390 and 1440. Pending account verification keeps page content unmounted; startup styles are available before lazy account CSS; slow feedback, simulated 503 recovery and retry to anonymous sign-in pass.
- Wave movement, reduced motion, nonblocking form interaction, signup and horizontal overflow checks pass. No sign-in form was submitted and no production account was used. Local API status responses were intercepted for deterministic startup checks; the local preview has no running application API proxy.

## Production publication

Publish frontend main through the existing GitHub-to-Netlify connection, retaining the last verified API source 53998b0c18dedb25fc6265de38a128f40574d53d. The commit skips Render because no API code or database schema changes in this release.

Three owner-requested platform administrator accounts were separately created and verified directly in the live database. Each requires individual authenticator enrollment on first sign-in. Existing administrator records and authenticator configuration were preserved. No account password, MFA secret, credential file or account-provisioning script is included in this commit.

After publication, verify the exact live source revision, login/signup and administrator route, served CSS/JS and logo assets, cache headers, mobile/laptop layout and API readiness. Screenshots and operational evidence are retained only under ignored output directories. Existing administrator session expiry and hosting cold-start behavior are unchanged.
