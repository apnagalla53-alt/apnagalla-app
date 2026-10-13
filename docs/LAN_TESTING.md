# Preview EVOLIX on another PC or phone

Current local setup, verified 9 October 2026:

- PC Ethernet address: `192.168.31.178` (router `192.168.31.1`).
- Main PC: `http://localhost:5175/login`.
- Other devices on the same router: `http://192.168.31.178:5175/login`.
- If a phone connects to this PC's Windows Mobile Hotspot instead: `http://192.168.137.1:5175/login`.
- Platform login uses `/platform/login` on the same origin.

The PC must stay on and both the backend and preview server must keep running. The LAN preview now uses the existing Haidery plywood demo database (`evolix_phase8_browser_20261007_test`) through a separate backend on 8012. The tenant's public number is 138, code EVX-19634672. The separate development backend 8010 and frontend 5173 remain unchanged. Use the app's existing credentials or create a demo tenant through Platform administration. The addresses can change after reconnecting; run `ipconfig` again if necessary. Router guest/client isolation may prevent devices reaching each other. These LAN addresses cannot be reached from a different external network.

## Start the preview again

With the Haidery demo API already running on port 8012, run in PowerShell:

```powershell
cd D:\evolix-trade-erp\frontend
$env:VITE_API_URL=''
$env:VITE_API_BASE_URL=''
$env:DEV_API_TARGET='http://localhost:8012'
npm run dev -- --host 0.0.0.0 --port 5175 --strictPort
```

The development-only Vite proxy forwards `/api` to the local backend. A phone therefore uses its current app origin rather than trying to contact `localhost` on the phone. The main localhost preview on 5173 remains available separately. Backend CORS/authentication rules were not loosened for this preview.

## Windows Firewall

Automatic creation of the inbound rule returned **Access is denied** in this session. If another device cannot open the preview, open **PowerShell as Administrator** on this PC and run:

```powershell
New-NetFirewallRule -DisplayName "EVOLIX LAN Preview 5175" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5175 -RemoteAddress LocalSubnet -Profile Any
```

This allows only devices in locally connected subnets to use port 5175. Keep the firewall enabled. Remove the temporary rule when no longer needed:

```powershell
Remove-NetFirewallRule -DisplayName "EVOLIX LAN Preview 5175"
```

## Verified browser behavior

The initial LAN login failed because HTTP IP addresses do not expose the same Web Crypto interfaces as localhost/HTTPS. Shared browser helpers now generate RFC 4122 version 4 UUIDs with `crypto.getRandomValues` when `crypto.randomUUID` is unavailable. SHA-256 retry fingerprints use the same hash algorithm, with the native digest on supported origins and the maintained [noble-hashes SHA-256 implementation](https://github.com/paulmillr/noble-hashes) otherwise. No `Math.random` or weaker retry fingerprint was introduced.

The current 5175 LAN page and proxied API readiness returned HTTP 200 on 9 October. The existing Super Admin login also returned HTTP 200 through the router LAN URL after connecting this preview to the Haidery demo API. Both router and Windows-hotspot IP page URLs responded on this PC. A second physical device still needs to confirm connectivity through the router/firewall. The separate 5174 commercial QA preview is not the Haidery sharing link.

Previously completed LAN Chromium checks (8 October):

- Page and proxied API readiness returned HTTP 200 / `ready`.
- Both existing headed Retail tests passed: full lifecycle (fresh Platform tenant, login, stock, billing/payment modes, khata, returns, purchases, expenses, needs and reports) and cart/held-bill recovery after a failed sale.
- On the actual HTTP LAN origin, native `randomUUID` and `subtle` were unavailable; the fallback passed two standard SHA-256 vectors and generated 1,000 unique valid version 4 UUIDs.
- Frontend `npx tsc --noEmit` and `npm run build` exited 0.

Evidence is in ignored local files `output/playwright/lan-results.json`, `output/playwright/lan-regression/` and `scratchpad/lan-crypto-check.log`. A physical phone/second-PC connection has not been verified from this session. This is a local development preview; public production deployment and Google sign-in require the separately documented HTTPS/domain/provider setup.
