# EVOLIX Retail: Android and Play Store publishing

Status: Android source and public policy screens are prepared. No signed release bundle, Play listing, production OAuth account or physical-device acceptance is verified. Do not upload a debug build. Start with [SETUP_GUIDE.md](SETUP_GUIDE.md).

## 1. Complete your business details

Open **Platform → Settings → App publishing**. Developer name defaults to **EVOLIX Studio** and website to **https://evolix-studio.in**, as supplied by the owner. Fill the legal entity name, business address, monitored support email, retention/deletion policy, approved privacy/commercial terms and Android package identifier. Other fields are deliberately blank. Use the support inbox for privacy contact, and choose your real public app URL in deployment configuration. Review the text, then approve policy publication. Do not mark placeholder values approved.

The provisional package is `in.evolixstudio.retail`; confirm it before signing. It identifies this app permanently in Play. If you choose another ID, update Capacitor config, Gradle namespace/applicationId, native Java package/directories, FileProvider authority and Google Android OAuth configuration together.

The deployed frontend provides `/privacy`, `/terms`, `/support`, `/delete-account` and `/about`. Until publishing details are approved these screens display a draft/setup state. Use actual HTTPS links in Play Console. These pages must load without signing in. The deletion page explains the request process; authenticated owners can submit a persisted request and export their data. A request is **pending**, not proof of deletion. Assign an operator to verify/fulfil requests, document legally retained financial records and communicate retention. Google's [account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111) describe the in-app and external pathways where applicable. Review applicability even though current tenants are provisioned by an administrator.

## 2. Install the Android tools

Install Android Studio supported by [Capacitor 8](https://capacitorjs.com/docs/updating/8-0), its JDK 21 toolchain and Android SDK 36. Open `frontend/android` and let Gradle sync. Install SDK/build tools through Android Studio and accept licenses yourself. The repository targets API 36 and min SDK 24. As checked on 7 October 2026, Google requires new apps and updates to target [API 36 or higher](https://support.google.com/googleplay/android-developer/answer/11926878).

In a PowerShell terminal in `frontend`, using your real API origin:

```powershell
npm ci
$env:VITE_API_URL='https://YOUR_API_DOMAIN/api/v1'
$env:ANDROID_APP_ID='in.evolixstudio.retail'
$env:APP_PUBLISHING_APPROVED='true'
# If Google is configured, use the same public WEB OAuth client ID as the server.
$env:VITE_GOOGLE_CLIENT_ID='YOUR_WEB_CLIENT_ID.apps.googleusercontent.com'
npm run android:release:prepare
npm run android:open
```

Replace every uppercase placeholder before running. The approval flag is an operator gate; it does not replace checking real public pages. The script rejects localhost, placeholder API hosts and a package mismatch. Capacitor copies the compiled frontend into the native project. Production must use HTTPS; no development `server.url` or mixed-content bypass belongs in the release.

## 3. Google sign-in

Follow [GOOGLE_LOGIN_SETUP.md](GOOGLE_LOGIN_SETUP.md). Create a Web OAuth client for backend token audience, and an Android client for the final package plus certificate SHA-1. Register both your internal-test signing certificate and the **Play app-signing** certificate when appropriate. Native sign-in uses Credential Manager and a server-issued single-use nonce. Retail users link an existing account after proving their password; Google sign-in does not grant platform access or automatically merge matching emails. Test cancellation, wrong audience, revoked/disabled user and logout on the real device.

## 4. Build and sign

In Android Studio choose **Build → Generate Signed App Bundle / APK → Android App Bundle**. Create an upload key in a private location outside Git; use a strong password and an encrypted recovery copy. Select the release variant. Set release `versionCode` to a new integer and a meaningful `versionName` before every upload. Enrol in Play App Signing and record the upload-key recovery process. Never add keystore files or passwords to source control or this document.

The expected output is `frontend/android/app/build/outputs/bundle/release/app-release.aab`. Its existence alone does not prove acceptance: install through an internal Play track and test the actual signed application. Java/native builds were unavailable on the development machine, so this remains a release gate.

## 5. Prepare the listing

Draft app name: **EVOLIX Retail**. Draft short description: **Simple billing, stock and khata for your shop.**

Suggested factual full description: “EVOLIX Retail helps shop owners record bills, purchases, expenses and customer/supplier payments. See Daily Galla, stock, dues and reports in one place. Configure your shop's UPI QR and confirm payments yourself. Supported plans provide variants, pack units, measurements, batch/expiry, serial/warranty and bundles. Your account is supplied by your business administrator.” Review against the exact released plan/flows. Do not advertise offline billing, bank-verified UPI, automated subscription payments, active WhatsApp AI or selective tenant restore.

Original draft assets exist in `docs/play-store/assets`: a 512×512 store icon and 1024×500 feature graphic. Review them and the [listing draft](play-store/STORE_LISTING_DRAFT.md), then capture genuine phone/tablet screenshots of the signed app with disposable shop data. Show Home, Make Bill, Daily Galla, Khata and Items. Never show passwords, real customer balances or competitor branding. Complete category, content rating, target audience, ads declaration, app access and Data Safety in Play Console.

## 6. Data Safety and permission review

Use a release-specific data inventory, not a copied declaration:

| Data / capability | Current use to review |
|---|---|
| Account name, email/phone, Google identity | Authentication, account/support and business administration; Google subject is bound to an existing account. |
| Shop/customer/supplier and financial records | Billing, inventory, khata, reports and export in the authenticated tenant. |
| Uploaded files / photos | Optional user-selected bills, proof and documents; private tenant-scoped storage. |
| Device/session activity and audit events | Account security, revocation and operator investigation. |
| UPI ID/payee | User-configured incoming QR; displaying QR never confirms payment. |
| Voice / WhatsApp | Not integrated in this release. Revisit disclosures and consent before enabling it. |

Verify encryption in transit on deployed endpoints, access controls, deletion/retention, processors and whether any monitoring SDK is actually enabled. Native printing uses the Android print dialog. QR sharing uses a private cache file and temporary URI permission. File/photo selection uses system pickers; no blanket storage/contact/microphone permission should be added for an unimplemented feature. Inspect the **merged release manifest**, including dependencies, before declaring permissions.

## 7. Subscription policy and test access

The Android app consumes an existing shop subscription. Native subscription/features screens do not route users to external SaaS checkout. Do not add “pay on our website” purchase steering without an applicable approved programme or proper Play Billing integration. Shop UPI collection for physical retail goods is separate from selling EVOLIX digital access. Review Google's [Payments policy](https://support.google.com/googleplay/android-developer/answer/10281818) for the actual distribution model.

Create a controlled reviewer tenant with all advertised workflows enabled and a working reviewer login. Supply credentials securely in Play Console's [app access instructions](https://support.google.com/googleplay/android-developer/answer/9859455); never put them in Git/docs. Avoid requiring access to your personal Google account. Follow the internal/closed testing requirements shown for your developer account; [new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465) may require 12 continuously opted-in testers for 14 days before applying for production access. Check the current console requirement before scheduling a launch.

## 8. Device acceptance and release gates

- Test fresh-owner login/password change, Google linking/login/cancel/logout and session/device revocation.
- Run item/purchase/cash/UPI/Udhar/split/return/customer/supplier/expense/Galla/report flows on supported Android versions.
- Check 360, 390 and 412 pixel layouts, larger text, TalkBack, keyboard, back button, rotation and dark mode.
- Test camera/gallery chooser, QR share, static/exact amount QR print and invoice printing through real Android dialogs.
- Test slow/disconnected network: retain cart and retry the same operation; never claim full offline POS.
- Verify public policy/deletion URLs, actual deletion handling, backup/restore, monitoring and reviewer access.
- Inspect Play pre-launch reports, fix crashes/accessibility/security findings, then request review of the exact signed version.

Stop for owner approval. No build has been uploaded and no release has been published automatically.
