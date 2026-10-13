# Google sign in and account recovery setup

Google sign-in supports linked existing accounts and explicit public signup. It is disabled until a real Google client is configured. New signup creates an account in durable onboarding; the existing provisioning service creates its shop after the owner completes business setup. A Google identity cannot select an arbitrary company supplied by the browser or grant Platform Super Admin access. Platform administrators continue using the separate Platform password login.

## Localhost walkthrough for EVOLIX Studio

The current cleaned shop preview uses **http://localhost:5173**, with the backend on **http://localhost:8012**. Port 5175 is currently used by a separate school project. These are development servers. A real public Web OAuth client ID was configured locally on 10 October 2026; live account login and production consent acceptance still require the owner. The client secret is not used or stored by this integration.

1. Sign in to [Google Cloud Console](https://console.cloud.google.com/) with a Google account you control. Use the project selector at the top, select **New project**, name it **EVOLIX Trade**, create it, and select that project.
2. Open **Google Auth Platform** and its setup screen. In **Branding**, use **EVOLIX Trade** as the app name and a real email address you can receive mail at for support and developer contact. The developer is **Evolix Studio**. For local testing, complete the required fields; when publishing, supply the actual deployed app homepage, privacy and terms pages. Do not invent a support email or use an unpublished URL.
3. In **Audience**, choose **External** for customers using their own Google accounts. Keep the development configuration in **Testing** and add your own Gmail and your tester's Google account to **Test users** if the console offers that restriction. Follow the console's verification requirements before public release.
4. In **Data Access**, use only the identity scopes `openid`, `email` and `profile`. No Gmail or Drive permissions are needed.
5. In **Clients**, choose **Create client → Web application**. Name it **EVOLIX Local Web**. Add these **Authorized JavaScript origins**:

   ```text
   http://localhost
   http://localhost:5173
   ```

   Register any additional port only if it actually hosts EVOLIX. Origins must not include `/login`, `/signup`, `/api/v1` or any other path. The frontend origin is required; the API port 8012 is not an additional JavaScript origin for this flow. Leave **Authorized redirect URIs** empty: the existing EVOLIX implementation uses a JavaScript credential callback, not a redirect callback. [Google's setup instructions](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) describe this distinction.
6. Save the client and copy its **Client ID**, ending in `.apps.googleusercontent.com`. In `backend-typescript/.env`, replace the blank `GOOGLE_CLIENT_ID` with that public ID:

   ```dotenv
   GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
   ```

   `YOUR_WEB_CLIENT_ID` is a placeholder, not a working credential. This integration does not use the generated client secret. Do not put a client secret in frontend files or commit it. No separate `VITE_GOOGLE_CLIENT_ID` is needed; the frontend obtains the public ID from the backend capabilities endpoint.
7. Restart the backend after saving the environment file, then refresh **http://localhost:5173/password-login**. Google sign-in should now be available. The configuration can be checked at **http://localhost:5173/api/v1/auth/capabilities**: `google_client_id` should contain your public client ID. This verifies configuration only, not a successful Google login.
8. To use Google with **an existing shop**, sign in using its current shop password first. Open the shop menu → **Settings & Help → Security**, enter that password and choose **Continue with Google**. Select your intended Google account, then sign out and try Google login. Matching email addresses alone do not connect an existing shop.
9. To create **a new owner account**, open **http://localhost:5173/signup** in regular Chrome. The password-login page also offers **Create account with Google**. Review the Terms/Privacy notice yourself and select its checkbox to enable **Sign up with Google**. Select your Google account, then finish your name, business, plan and Import/Start Fresh onboarding. No existing shop password or mobile OTP is required for Google signup. A Google login does not grant a paid plan or Platform Super Admin access. Use **Sign in with Google** with that same account on later visits.
10. Before public release, create a separate production OAuth client, register the **actual HTTPS frontend origin**, publish approved policy pages and complete Google's required checks. `evolix-studio.in` is the developer's supplied domain; an app subdomain must be deployed and confirmed before registering it as the production app origin. Register Android separately as described below.

If the Google button is absent, check the saved client ID, backend restart and capabilities response. On signup, Google remains disabled until the owner accepts the Terms/Privacy notice. For an origin error, open the app using `localhost` exactly and check its port against the client origins. For an access-blocked message, check the selected project, Audience/test accounts and consent status. An unregistered-account message offers **Create account with Google** for new owners; existing shop users must follow the explicit connection in step 8.

### Generic Google 400 in Codex's embedded browser

On 10 October, the owner reported a generic malformed-request 400 from the Codex popup. The same EVOLIX page/client in standalone headed Chrome reached Google's normal account sign-in screen. A subsequent Chrome attempt returned EVOLIX's unlinked-account message, after the verified Google credential/nonce reached the application. This points to embedded-popup behavior for the earlier 400; its exact internal cause was not established. For this local acceptance, use regular Chrome at `http://localhost:5173/signup` or `/password-login`. Do not weaken nonce checks, register unrelated ports or change the client secret to work around a browser popup. A successful Google account selection does not itself create an EVOLIX account: new owners must use the explicit signup flow and accept its policies.

## 1. Create your Google project

Open [Google Cloud Console](https://console.cloud.google.com/) using a Google account controlled by the business. Create a project for EVOLIX and retain access through a business owner/admin group. Google sign in does not require a Firebase project, a Google AI Studio key, Gmail inbox access or a Google client secret in the frontend.

In **Google Auth Platform**, configure Branding, Audience and Clients. Older console layouts call this **APIs & Services → OAuth consent screen / Credentials**. Enter your actual application name, support email, developer contact, production homepage, privacy policy and terms URLs. Use the public policy pages supplied by this repository after completing their real business/contact details. Verify the domain where Google requires it. While the app is in Testing, add the test Google accounts to Audience. Complete Google's publishing/verification requirements before enabling general customer access.

Use only the sign-in identity scopes needed by the app (`openid`, `email`, `profile`). EVOLIX does not request Gmail, Drive, Contacts, financial APIs or broad Google Account permissions.

## 2. Create the web OAuth client

Create an OAuth client of type **Web application**. Under Authorized JavaScript origins, add the exact production frontend origin, for example your own `https://shop.your-domain.example`. Origins contain scheme and host/port only, with no route, wildcard or trailing path. Add development origins separately only while testing locally. Do not use example domains in a production configuration.

The web client ID ends in `.apps.googleusercontent.com`. Set the backend's `GOOGLE_CLIENT_ID` to that ID through your deployment secret/config manager. The ID is public configuration and is returned by `/api/v1/auth/capabilities`; a client secret is not used by this ID-token callback flow. Keep any console-generated client secret out of Git and out of the frontend.

The current web flow uses Google's JavaScript callback and a POST to the EVOLIX API. It does not require a redirect URI. If you later add an authorization-code redirect flow, implement its own state/PKCE/callback verification instead of copying this flow unchanged.

The production CSP must permit the official Google Identity Services script and frame/connect resources. Follow [Google's web setup guidance](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) and the maintained deployment example. Keep the permitted origins explicit.

## 3. Connect your existing EVOLIX account

Sign in once with the shop password. If it is a temporary password, change it first. Open the top-left shop menu → **Settings & Help → Security**, enter the current password and choose **Continue with Google**. This explicitly links the verified Google subject to that EVOLIX user.

After linking, **Sign in with Google** on the login page opens the same shop account. An identical email alone cannot link accounts. One Google subject can be linked to one EVOLIX user; that user's assigned companies determine access. Linking does not change staff roles or subscription entitlements. A verified Gmail/Workspace identity can establish a verified recovery email; a Google account using an unrelated email provider does not automatically establish recovery ownership.

Disconnecting Google requires the current password and revokes all shop sessions. Password sign in remains available. Tokens are checked by Google's official Node library for signature, audience, issuer and expiry. EVOLIX separately requires a verified email and matches a server-issued, five-minute, single-use nonce. Google ID tokens are never persisted as app access tokens or printed to logs. See [Google's verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

For a new owner, open `/signup`, accept the Terms/Privacy notice and choose Google. An optional referral is retained through this flow. Complete owner name, shop/business type and address, then request Starter/Smart/Pro or use an explicitly configured trial, and choose Import or Start Fresh. An unpaid plan request cannot activate a paid subscription. Existing verified Google identity reuse resumes its existing account rather than creating a duplicate shop. An email match alone cannot link an existing password account; use the explicit connection steps above. See [auth and onboarding](AUTH_AND_ONBOARDING.md).

## 4. Configure Android Google sign in

Android uses the native **Credential Manager** account selector through `AuthGooglePlugin`, with the same backend web client ID and nonce validation. It does not load OAuth sign-in inside a WebView. See [Android's official implementation guide](https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation).

Confirm the Android package namespace you own before publishing. The generated project currently uses the provisional `in.evolixstudio.retail`. Changing it requires updating Capacitor config, Gradle namespace/applicationId and Java package/source paths together, then regenerating/syncing and rebuilding.

Create a separate OAuth client of type **Android** in the same Google project. Enter the actual package name and the SHA-1 signing certificate fingerprint. During development, use the debug signing fingerprint from Android Studio/`gradlew signingReport`. For Play distribution, register the **Google Play app signing certificate** fingerprint from Play Console → App integrity. The upload certificate and Play app signing certificate can differ; registering only the upload or debug fingerprint does not configure Play-installed apps. Register each intended build signing identity as needed.

The Android Credential Manager request uses the **web client ID** as its server audience, not the Android client ID. No Firebase `google-services.json` is required for this bridge. Android devices need supported Google Play services/account configuration and network access. Password login provides a fallback when Google account selection is cancelled or unavailable.

Compile the Android project with the required JDK/SDK, then test a Play-installed build on a real device: first connection, linked login, account picker cancellation, wrong/unlinked Google account, nonce expiry, logout and reconnect. Local Node/TypeScript tests do not replace native compilation and real OAuth acceptance. If this environment lacks an Android toolchain or configured Google project, record those checks as pending; do not report Google live sign-in or Android device QA as passed.

## 5. Configure email recovery

Set `EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `EMAIL_FROM`, `PUBLIC_APP_URL`, and SMTP username/password where required. Use port 465 with `SMTP_SECURE=true`, or a STARTTLS-capable provider with `SMTP_SECURE=false` and `SMTP_REQUIRE_TLS=true`. Certificate verification remains on; debug SMTP logging is off. Store authentication secrets in the deployment secret manager. `PUBLIC_APP_URL` must point to your real HTTPS frontend in production.

Use a sending domain/provider you control. Configure its SPF/DKIM/DMARC according to that provider and test real delivery before customer launch. No email is faked when a provider is missing: recovery/verification returns **NOT CONFIGURED**. Network/delivery errors return a clear failure without SMTP credentials or message contents.

Under **Security → Recovery email**, confirm the current password and send a verification link. Only verified recovery addresses receive password reset links. Reset/verification links expire after 20 minutes, store only SHA-256 token hashes, allow one consumption and keep the secret in a URL fragment so access logs/Referer do not contain it. A new reset supersedes prior reset links. Successful password change/reset revokes every shop session and rejects recent password reuse. Staff temporary passwords expire after 24 hours where provisioning enables that policy, and billing is blocked until they are changed.

Platform administrators can change their password at the authenticated change-password screen. Emergency recovery is operator-only: from a private interactive terminal with the correct protected `DATABASE_URL`, run `node scripts/reset-platform-password.cjs` in the backend directory. Verify the exact administrator identity, enter the required confirmation/reason and hidden strong password. The CLI revokes sessions, unlocks the existing active Super Admin and records an audit event. It never creates a new operator, accepts a password argument or reactivates a disabled administrator. Restrict deployment/DB secret access and document who is authorized to run it.

## Required release evidence

- Web OAuth consent/publishing configuration and real verified-domain origins.
- A real new-owner Google signup/onboarding and existing linked-account web login; an unlinked identity must never enter somebody else's tenant.
- Native build compilation plus a real Android/Play signing identity login and logout drill.
- Real SMTP verification/reset delivery and one-use/expiry checks using a disposable test account.
- Central/edge rate limiting for multi-replica deployment; process-local throttles are defense in depth.
- Password recovery and operator procedures included in the service runbook, with no credentials in screenshots, command history or logs.

Automated evidence currently includes real official-library certificate/signature validation tests and real PostgreSQL HTTP lifecycle tests with explicit deterministic external-provider injection. These prove local security logic, not live Google/SMTP provider configuration.
