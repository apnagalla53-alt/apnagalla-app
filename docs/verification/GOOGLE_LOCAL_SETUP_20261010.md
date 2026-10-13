# Local Google OAuth configuration — 10 October 2026

The owner supplied the newly created public OAuth client ID. It was read from the
Client ID region of the local screenshot, checked for the expected Google client
format and placed in the ignored `backend-typescript/.env` as `GOOGLE_CLIENT_ID`.
The exposed client secret was not copied into configuration, scripts or this
report. The owner was advised to replace it in Google Cloud.

## Preview runtime

- EVOLIX Trade frontend: `http://localhost:5173`.
- Existing cleaned-shop database API: `http://localhost:8012`.
- LAN frontend: `http://192.168.31.178:5173` at verification time.
- Port 5175 was occupied by a different school project; its process was preserved.
- Only the saved EVOLIX API process was restarted, after checking its executable,
  command and matching preview bootstrap record. The API uses frontend origin 5173.

## Actual checks

- API and proxied localhost/LAN capabilities: HTTP 200, expected public client ID.
- Proxied database readiness: HTTP 200.
- Google challenge: HTTP 201 with the expected client ID and server-issued challenge
  ID/nonce. Challenge secrets were omitted from output.
- Initial browser load occurred before the restarted API was ready and received
  a 502. Refresh after readiness loaded Google's official **Sign in with Google**
  iframe/button on the password login page.
- Retained screenshot: `output/platform-control/google-login-configured-20261010.jpg`.
- Environment and local operator helpers are ignored by Git.

These initial checks were configuration and UI smoke checks, not a completed
Google account login. No account chooser selection, account linking, consent,
signup or provider-console change was performed by the agent. No whole-product
regression was rerun for the environment configuration change.

## Google account creation and browser follow-up

The owner's Codex popup reported a generic Google 400. A separate visible Chrome
session opened the same official Google button and reached the normal Google
sign-in screen. A subsequent live Chrome attempt returned the application's
unlinked-account rejection; this is different from Google's malformed-request
error. The exact cause inside the embedded popup was not established.

The new-owner path already existed in the backend. This follow-up makes it clear
on the sign-in screens and puts Google first on signup. Unregistered Google login
returns a stable `GOOGLE_ACCOUNT_NOT_REGISTERED` code with an explicit signup
action. Terms start unchecked and Google signup remains disabled until accepted.
Unconfigured mobile OTP does not add a required phone field or disabled OTP form
ahead of Google. Signup uses its own challenge and resumes owner/shop onboarding.
Email matching still cannot silently link an existing password account.

Actual verification for this follow-up:

- All 34 migrations applied to a newly created disposable local PostgreSQL DB.
- First run: 44 API tests passed, 1 failed because a security fixture expected a
  previously seeded `identity.admin` permission. The fixture now creates that
  permission itself; no production permission or authorization behavior changed.
- Final API regression: **45 passed, 0 failed, 3 files, exit 0**. Suites:
  `auth-lifecycle`, `control-plane-security`, `account-onboarding-referral`.
  Google signature/provider verification is an explicitly injected test boundary;
  database transactions, challenges, accounts, sessions and provisioning are real.
- Google signup checks include consent rejection without account/challenge changes,
  nonce mismatch/replay rejection, same-subject reuse, subsequent Google login,
  onboarding state, no default password and no Platform access.
- Headed Playwright CLI: **7 UI checks passed, 0 failed, exit 0**, using isolated
  Google/auth response fixtures. Covered sign-in discoverability, unregistered
  signup action, unchecked consent, no OTP/password dependency, signup payload,
  onboarding navigation and no overflow at 360/390/412/1366 pixels.
- Backend `tsc --noEmit` and `npm run build`: **exit 0**.
- Frontend final `tsc --noEmit` and `npm run build`: **exit 0**.
- Only the verified EVOLIX API on 8012 restarted; proxied readiness returned 200
  with `status: ready`. The separate school project on 5175 was untouched.
- Live signup challenge returned 201 after restart with Google configuration and
  a server-issued challenge present. Its nonce/ID were not printed.
- Actual signup screen retained at
  `output/playwright/google-signup-live-20261010.jpg`, with consent unchecked.
- Temporary databases were removed after tests. Existing local shop data was not
  used for these tests or erased. UI fixtures are not production auth bypasses.

The agent did not accept the owner's policies, choose their Google identity or
complete a live new-owner Google signup. That final provider acceptance remains
for the owner in regular Chrome. Production Google publishing and Android device
acceptance remain pending. This evidence does not declare the entire ERP ready
for production.

## Owner acceptance still required

Confirm `http://localhost:5173` is registered on the Web OAuth client's JavaScript
origins. The console screenshot reports Testing with access limited to test users;
add the intended Google accounts under Audience. Test OAuth through localhost on
the PC; a plain HTTP LAN IP is not a production Google origin.

For an existing shop, sign in with its password and explicitly connect Google in
Settings & Help → Security before trying Google login. For a new owner, use
`/signup` and personally review the terms/consent and finish onboarding. Platform
Super Admin uses the separate platform login. Production origins, publishing and
Android signing/device acceptance remain pending.
