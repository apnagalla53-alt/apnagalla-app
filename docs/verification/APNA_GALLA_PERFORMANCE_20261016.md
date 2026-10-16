# Apna Galla performance verification — 16 October 2026

Status: production builds, fresh installs, focused automated tests and browser checks passed. Source changes are ready for the separate software and website main branches. This performance pass introduces no database migration.

## Measured results

Three paired before/after runs, reporting medians. Chromium mobile viewport 390 × 844, 4× CPU slowdown, 120 ms network latency, 200,000 bytes/s download, 100,000 bytes/s upload. Browser HTTP cache disabled; identical Brotli preview server, same disposable local API and synthetic Footwear owner. Session cookies still require the real isolated API. Before is a frozen production build of the previous release; after is the current source build. No performance measurement creates sales or modifies customer records.

| User-visible operation | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| App: sign-in form ready | 2286 ms | 2027 ms | 11.3% |
| App: first Home summary after login | 3571 ms | 3584 ms | -0.4% |
| App: open Quick Bill from Home | 979 ms | 607 ms | 38.0% |
| App: return from Quick Bill to Home | 433 ms | 316 ms | 27.0% |
| App: restore authenticated Home on reload | 4197 ms | 4054 ms | 3.4% |
| Website: first content paint | 1752 ms | 1376 ms | 21.5% |
| Website: demo and fonts ready | 2294 ms | 1900 ms | 17.2% |

Timings describe this controlled browser environment, not a production SLA. The first Home summary remains dependent on authoritative API/report work; a negative reduction is a measured regression/noise and is reported rather than hidden. Baseline Google Fonts was unavailable in the local browser, so baseline transfer bytes exclude third-party font files. The optimized site loads and verifies its original fonts locally. Production font/network timings can differ.

| Download measure | Before | After |
| --- | ---: | ---: |
| Main app JavaScript, uncompressed | 5,00,276 bytes | 3,58,380 bytes |
| Main app JavaScript, gzip | 1,55,265 bytes | 1,11,614 bytes |
| Initial sign-in JavaScript, Brotli observed | 159767 bytes | 137905 bytes |
| Website homepage images, observed | 157952 bytes | 20515 bytes |
| Website observed encoded resources | 177698 bytes | 131883 bytes |

Returning from Quick Bill to Home previously requested experience and calendar again. The optimized run issued zero repeat Home reads inside the ten-second reuse window. Stock, price validation, payments, sessions and permissions are not added to this cache.

## Software changes

- Load Hindi on demand; restore a saved Hindi selection before rendering and show a retryable error if a later language download fails. English uses the existing copy as its fallback.
- Load password recovery screens and the LAN-only SHA-256 fallback on demand. Preserve identical retry fingerprints on native WebCrypto and LAN fallback paths.
- Download the requested retail/login screen while the authoritative session check runs. Protected components and shop API reads still wait for authentication.
- Warm billing code only after Home is usable, during idle time. Respect data-saving and slow 2G connections. This does not fetch items or prices.
- Reuse approved Home, calendar and migration reads for ten seconds, using session, owner and full tenant context keys. All successful mutations clear this memory cache. Reject late reads from an old shop or from before a mutation.

## Website changes

- Use the existing WebP logos in the header and login/signup pages. The header image changes from 152,509 to 15,072 bytes; the auth logo changes from 436,969 to 51,002 bytes.
- Self-host version-locked Latin variable versions of Manrope, Plus Jakarta Sans and JetBrains Mono. Remove the blocking Google Fonts import/preconnects and keep the visual design.
- Give content-hashed /_astro/ assets an immutable one-year browser cache policy. Keep API responses no-store.

## Verification

- Fresh npm ci and production builds pass in the software publication checkout and marketing-site checkout.
- 22 frontend unit tests pass: read coalescing, cloned responses, TTL, query separation, company/branch/year/session isolation, mutation invalidation, stale response rejection, failures, live-endpoint rejection, SHA-256/UUID fallback and language restoration/races.
- 32 backend acceptance tests pass: business Quick Bill (22) and zero-setup simplicity (10). Mutating tests run only on the dedicated localhost database ending in _test with synthetic owners, preserving the operator account and user data.
- 12 website demo accounting/state tests pass.
- 17 browser assertions pass:
- session gate remains visible while route code warms.
- no protected reads before authoritative session check.
- unauthenticated restored route redirects without shop reads.
- latest + and AI navigation preserved.
- Quick Bill still opens inline unknown-item entry.
- one-click Home remains usable.
- Hindi lazy-loads on selection.
- saved Hindi survives authenticated reload.
- English selection restores immediately.
- mobile software has no horizontal overflow.
- website has no Google Fonts network dependency.
- original website typefaces load locally.
- interactive demo generates matching receipt.
- demo keyboard navigation works.
- mobile website has no horizontal overflow.
- signup uses optimized branded image.
- signup logo loads.
- Mobile and desktop screenshots inspected. Local evidence, private fixtures, browser downloads and recordings remain ignored and are not publication files.
- New frontend test dependencies and website dependencies audit with zero reported vulnerabilities at verification time.

## Publishing and remaining hosting limit

Software publishes to apnagalla53-alt/apnagalla-app; website publishes to apnagalla53-alt/apnagalla-website. Use ordinary pushes to main, with [skip netlify] on both commits and [skip render] on software. Production rollout remains held until the prior activation_campaigns and item_unit_selling_price migrations are confirmed. No production data or credentials are changed in this pass.

A sleeping free API host or database still needs to wake before an authenticated screen can load. These code changes reduce browser downloads, code waterfalls and repeat reads; they do not remove provider cold-start time or enable a paid hosting plan.

The earlier feature summary remains in APNA_GALLA_RELEASE_SUMMARY_20261016.md in the software repository and RELEASE_20261016.md in the website repository.
