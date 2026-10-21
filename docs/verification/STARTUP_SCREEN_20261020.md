# Startup and account waves preview — 20 October 2026

Local preview only; no Git commit, push or production deployment for this change.

The previous account-check screen relied on login-container/login-card CSS imported by lazy account pages. Until those downloads completed it could appear as a plain text line. Added a dedicated eagerly imported AppStartup component and small stylesheet for the bootstrap and route Suspense states. It uses the existing app icon, a mint background, an indeterminate progress line, feedback after eight seconds and an accessible retry state. Authentication, cookie restoration, expiry handling, native/platform skip behavior and the existing timeout are unchanged. No user/shop content mounts before session verification.

The sign-in/create-account page now has two decorative SVG water-wave layers using the logo green palette. Only transforms animate, with no canvas, video, animation library or separate asset request. The form stays stationary above the waves. Decorations ignore pointer input and are hidden from screen readers. Reduced-motion mode disables animation. No paid services or backend configuration changes.

Validation: production frontend build passed; existing frontend unit suite passed. Real local Edge checks exercised pending session blocking, eager style availability, slow feedback, 503 recovery and retry to an anonymous 401 sign-in page; checked 320/390/1440 widths and dark startup. Wave checks verified changing transforms, reduced-motion behavior, no overflow, sign-in field usability and signup layout. Preview screenshots are under output/playwright/startup-screen-20261020. Network statuses were intercepted locally for deterministic startup checks; no production account, login submission or database mutation was used.

This improves the visible startup state, not the underlying hosting wake-up time. Free-instance/network delays remain a separate concern.
