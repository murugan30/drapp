# Production Release Plan (DrApp)

This plan brings DrApp from the current development-ready state to a production-ready PWA by locking down configuration/security, completing core flows (documents + staff patient mgmt + SMS OTP), and finishing mobile UI verification.

## Scope (what we will deliver)
- A production-deployable **web PWA** and **API** with correct environment configuration.
- **Secure authentication** (staff password login + patient OTP) with production secrets and correct CORS/cookies.
- Complete **Documents** workflow end-to-end (upload/list/download) with role-based access.
- Complete **Staff patient management** flows (create/search + view).
- Confirmed **mobile UX**: fixed headers/bottom tabs, no horizontal scroll, stable viewport.

## Non-goals (explicitly out of scope for first release)
- Full-feature EHR / billing / payments.
- Complex availability rules (weekly patterns, exceptions) unless required immediately.
- Deep offline-first guarantees beyond existing cached list views.

---

## Milestones

### M1 — Freeze release topology + environment strategy (Must-have)
**Outcome:** the app works when hosted on real domains and on phones (no localhost assumptions).
- Choose deployment topology:
- Use same-domain hosting (web + api behind the same domain) with the web calling the API via relative `/api`.
- Recommended routing: reverse proxy (Nginx/Caddy/etc) routes `/api/*` to NestJS and `/` to Next.js.
- Define production values:
  - `NEXT_PUBLIC_API_URL` should be `/api` (or unset and default to `/api` once implemented)
  - `WEB_ORIGIN` (comma-separated allowlist)
  - `NODE_ENV=production`
- Validate cookie strategy:
  - `drapp_token` httpOnly cookie works with same-domain requests; ensure `Secure` is enabled in production.

**Acceptance:** can login from a real phone browser against the deployed URLs.

#### Deployment notes (Option A: reverse proxy)
- Production is HTTPS (TLS terminated at the reverse proxy).
- Reverse proxy routes:
  - `/api` -> NestJS (port 3000)
  - `/` -> Next.js (port 4200)
- Reverse proxy must forward:
  - `X-Forwarded-Proto: https`
  - `X-Forwarded-Host`
  - `X-Forwarded-For`
- Verify:
  - `https://<domain>/api/auth/me` returns 401 when logged out and 200 when logged in
  - web can call `/api/*` with `credentials: 'include'` and cookies persist
  - API trusts proxy headers so `req.protocol` resolves to `https` behind TLS termination (e.g. `X-Forwarded-Proto`)
  - request size limits support local FS uploads (adjust proxy/body limits as needed)

Implementation note (API): enable Express trust proxy in Nest bootstrap so protocol/host are derived from forwarded headers.

#### Implementation steps (M1)
- Web API base URL defaulting:
  - File: `web/src/lib/api.ts`
  - Change default behavior so when `NEXT_PUBLIC_API_URL` is not set:
    - Production (`NODE_ENV=production`) uses relative `'/api'`
    - Development uses `'http://localhost:3000/api'`
- API trust proxy:
  - File: `api/src/main.ts`
  - Enable Express trust proxy (e.g. `app.set('trust proxy', 1)` or equivalent) before using `req.protocol`-dependent logic.

### M2 — Security + bootstrap controls (Must-have)
**Outcome:** production secrets and admin bootstrap cannot be abused.
- Rotate and enforce:
  - `JWT_SECRET` (strong value)
  - `BOOTSTRAP_ADMIN_SECRET` (required if bootstrap endpoint is used)
- Decide admin provisioning approach:
  - Prefer a one-time admin creation flow (bootstrap endpoint protected by secret) OR seed script in controlled environment.
- Production OTP safety:
  - Ensure `RETURN_OTP_IN_RESPONSE` is not enabled in prod.

**Acceptance:** no default secrets; admin creation path documented and locked down.

### M3 — Core feature completion: Documents end-to-end (Must-have)
**Outcome:** users can actually upload and retrieve documents.
- Web:
  - List documents per patient/member.
  - Upload UI integrated with `/documents/upload`.
  - Download action integrated with `/documents/download`.
  - Handle patient ownership restrictions (patient can only see own members).
  - Basic states: loading/empty/error.
- API:
  - Use local filesystem storage for v1 (via `UPLOAD_DIR` + `local-upload`/`local-download` as needed).
  - Confirm MIME/fileName handling and size limits.

**Follow-up (post v1):** migrate documents storage to S3 (keep API contract stable).

**Acceptance:** admin/doctor/assistant/patient can upload and download within their permissions.

### M4 — Core feature completion: Staff patient management (Must-have)
**Outcome:** staff can create/find patients and navigate to profiles without placeholders.
- Web:
  - Implement staff “Add patient” flow (use `/patients/by-mobile`).
  - Optional: staff patient search/list (if needed for day-1 usability).
- Permissions:
  - Confirm assistants/admins can create; doctors can view.

**Acceptance:** staff can register a patient and open their profile reliably.

### M5 — Mobile UX verification pass (Must-have)
**Outcome:** consistent PWA-like UI on real devices.
- Verify on real iOS Safari + Android Chrome:
  - headers fixed
  - back headers fixed
  - bottom tabs fixed
  - no horizontal scroll
- Patch any remaining overflow offenders page-by-page.
- Confirm PWA caching behavior doesn’t block updates (document cache clearing/reinstall steps).

**Acceptance:** no screens show X-scroll; headers/tabs do not move during scroll.

### M6 — Defer staff-side scheduling (Must-have for v1 clarity)
**Outcome:** there are no placeholder or non-functional staff scheduling actions in production.
- Hide/disable the staff “Schedule” action/button until the staff scheduling flow is implemented.

**Acceptance:** staff users do not see non-functional scheduling UI.

### M7 — PWA polish + install readiness (Should-have)
**Outcome:** installable PWA with proper assets.
- Add PNG icons (192/512 + maskable) and ensure manifest completeness.
- Confirm `start_url` and locale routing behavior.
- Optional: “new version available” prompt strategy.

### M8 — Operational readiness (Should-have)
**Outcome:** deployable with basic observability and recovery.
- Add health endpoint, basic structured logging.
- Backup/restore plan for Mongo and documents (S3).
- Minimal runbook: env vars, ports, admin bootstrap, smoke test steps.

---

## Release checklist (go/no-go)
- [ ] Production URLs configured (no `localhost` in runtime configs)
- [ ] `JWT_SECRET` rotated, `BOOTSTRAP_ADMIN_SECRET` set (if used)
- [ ] Documents upload/download verified with permissions
- [ ] Staff patient create flow implemented
- [ ] Staff scheduling placeholders removed/hidden
- [ ] iOS + Android manual test pass complete (no X-scroll, fixed chrome)
- [ ] Basic monitoring/logging present

## Deferred (post v1)
- SMS provider integration (keep `SMS_PROVIDER=log` during early rollout/testing; implement real provider last).
- S3 documents storage migration.
