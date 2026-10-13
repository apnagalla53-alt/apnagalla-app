# Website and software shared login

Local implementation verified 13 October 2026. No cloud deployment was performed.

Website Google/password login uses the software API and database. The software's `/auth/continue` restores the cookie session and opens onboarding or Retail, without another login or duplicated user. Production clients use the agreed same-site domains `apnagalla.in`, `app.apnagalla.in` and `api.apnagalla.in`; API session cookies remain host-only, Secure, HttpOnly and SameSite Strict.

Verification: **14 unit checks and 40 integration checks passed**, with separate owners on a disposable localhost `_test` database. These cover trusted origins, CSRF, cookie attributes, profile restoration without another device/session, temporary-password restrictions, signup terms, shared Google identity and logout revocation. Google identity is mocked only at the integration-test boundary. Actual Google Cloud sign-in remains an external staging check.

The website, software and backend builds passed. Website production login/signup pages contain external executable scripts compatible with the prepared CSP; both public API variables target `https://api.apnagalla.in`. Headed browser checks passed for website password login → software, responsive signup/provider availability, and the LAN Google explanation. No JWT is passed in the redirect or persisted in browser local storage.

Root Netlify configurations were prepared in both repositories; software root `render.yaml` prepares the API. The website's local changes have not been pushed to GitHub, and neither checkout was automatically committed. Accounts, DNS, production secrets, migration ownership/runtime grants, storage/recovery, SMTP and hosted acceptance remain necessary.

Use [the step-by-step account, Google and deployment guide](../APNAGALLA_WEBSITE_AND_CLOUD_SETUP.md). Preserve the existing operator account and personal-check data; do not restore the pre-cleanup demo dump into a live target.
