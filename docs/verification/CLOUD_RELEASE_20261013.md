# Cloud release preparation — 13 October 2026

Application source published to `apnagalla53-alt/apnagalla-app`, branch `main`, with root `render.yaml` and `netlify.toml`. Website changes published to `apnagalla53-alt/apnagalla-website`, branch `codex/cloud-release-20261013`; existing live website branch was not changed.

The app repository starts with clean source history. Its release excludes previous Git history, legacy archive, credentials, database dumps, operator handoff, customer uploads, unrelated personal downloads, generated outputs and two unguarded legacy table-drop utilities. Existing development files/customer data/operator credentials were preserved. Pattern-based secret checks found no flagged credentials in the release; this is not a certification that historical exposures are invalidated.

Cloudinary adapter uploads sanitized bytes as authenticated raw assets, keeps signed downloads server-side, validates its provider endpoint, rejects redirects and limits downloads to 5 MB/30 seconds. Existing local/S3 records fail closed when the configured provider differs; no automatic photo/data migration was performed. The existing non-local permanent erasure restriction is retained.

Verification:

- Fresh app release `npm ci`, Prisma 5.22 generate and backend build passed.
- Fresh frontend release `npm ci`, TypeScript and Vite production build passed with `https://api.apnagalla.in` configured. Packaging verification found and corrected an exclusion matching the UI design directory; the corrected release passed.
- Website production Astro build passed: 37 static pages, shared API/application URLs configured.
- Cloudinary adapter/security/provider-mismatch tests: 11 passed. Provider requests mocked; no customer database used.
- Existing attachment integration tests: 5 passed, dedicated disposable localhost `_test` database and separate owners.
- Dependency installations reported zero known vulnerabilities in the app packages at this check. Local Node 24.11.1 emitted engine warnings for development tooling requesting newer Node 24; hosting configs select current Node 24.
- Git remote branch hashes were checked after publishing.
- Public DNS currently resolves apex to `75.2.60.5` and `www` to `apnagalla.netlify.app`, matching the user screenshot. No app/API CNAME was found at this check. No DNS record was changed.
- `npx neon skills -y` installed project-scoped Neon skills. Neon CLI profile has no authenticated account. It did not provision or replace the database/auth/storage system.

The hosting services have not been created or cut over by this work. Provider secrets, restricted Neon roles/migrations, Cloudinary live integration, Render/Netlify custom domains, Google HTTPS origins, SMTP/recovery, trusted ingress and real hosted acceptance remain pending. Browser permission denied opening Netlify; no alternate browser route was attempted.

Follow [the launch steps](../CLOUD_LAUNCH_STEPS.md). Render Blueprint selects a paid Starter service; operator must review the provider cost. `BACKUP_PROVIDER=none` is unavailable protection, not a PASS. Real Google identity and hosted load have not been verified.
