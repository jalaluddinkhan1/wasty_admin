# Wasty Admin — Production Architecture

Shared Firebase project for:
- `Application_mvp` (user app)
- `Partner_Mvp` (partner app)
- `wasty_admin` (this admin console)

Public site: **wastey.in** (landing + login CTA)  
Admin console: **admin.wastey.in** or your deploy URL

---

## Architecture (senior view)

```
                    ┌─────────────────┐
   wastey.in ──────►│  CDN / Edge     │  static + ISR pages
                    │  (Vercel/CF)    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        Next.js App    /api/health     Server Actions
        (standalone)   (LB probe)      (RBAC + cache)
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                    Firebase Admin SDK
                    (Firestore, Auth, Storage)
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
           jobs          partners      opsReports
         users/...     bagsRegistry    config/...
```

### Load balancing & scaling
- **Vercel**: Edge network + automatic horizontal scaling. Point health checks to `GET /api/health`.
- **Docker / Cloud Run / ECS**: Use the included `Dockerfile` (`output: "standalone"`). Run **2+ instances** behind an ALB/Cloud Load Balancer; configure target group health check on `/api/health` (expect HTTP 200).
- **Session stickiness**: Not required — sessions are stateless httpOnly Firebase session cookies.

### Caching strategy
| Layer | What | TTL |
|-------|------|-----|
| Next.js `unstable_cache` | Command center stats, analytics aggregates | 30–60s |
| `revalidateTag` | Bust cache on job assign/cancel/force status | immediate |
| CDN | Static assets, security headers | long-lived |
| Firestore | Source of truth | n/a |

Analytics and ops dashboards are **read-heavy**; server-side cache avoids full collection scans on every page view. Mutations call `revalidateTag` for `wasty:ops` and `wasty:analytics`.

### Security
- **RBAC**: 4 admin types (`owner`, `government`, `ops_manager`, `support`) enforced in proxy, layout, and every server action.
- **Auth**: Firebase session cookies (httpOnly, secure in prod). Login rate-limited (12 attempts / minute / IP).
- **Production guards**: `WASTY_AUTH_BYPASS` and SQLite provider blocked in production (`src/lib/env/production.ts`, `/api/health`).
- **Headers**: CSP, HSTS, X-Frame-Options via `next.config.mjs`.

### Data flow (core loop)
1. User schedules pickup → `createPickup` → `users/{uid}/pickups/{id}` + `jobs/{id}`
2. Admin assigns partner → `assignJob` → `jobs.assignedPartnerId`
3. Partner completes → wallet points updated
4. User cancels → pickup + job cancelled
5. Partner SOS → `opsReports` → Admin ack/close
6. Bags → `bagsRegistry` → user activates QR

---

## Before go-live

### Credentials
- [ ] `NEXT_PUBLIC_FIREBASE_*` matches user/partner apps
- [ ] `FIREBASE_ADMIN_SDK_PATH` or `FIREBASE_ADMIN_SDK_JSON` (never commit JSON)
- [ ] `WASTY_DATA_PROVIDER=firebase`
- [ ] **Remove** `WASTY_AUTH_BYPASS=1`
- [ ] Rotate any service-account JSON ever committed to git
- [ ] Create Auth user + admin claim: `{ "role": "admin", "adminType": "owner" }`

### Grant admin (with role type)
```bash
node scripts/set-admin-claim.mjs you@example.com --type owner
# types: owner | government | ops_manager | support
node scripts/list-admins.mjs
```

### Deploy Cloud Functions + rules (from Application_mvp)
```bash
cd D:\Wasty\Application_mvp\functions && npm run build
cd D:\Wasty\Application_mvp
firebase deploy --only functions,firestore:rules,firestore:indexes,storage
```

### Deploy admin
```bash
cd D:\Wasty\Admin_mvp\wasty_admin
npm ci
npm run build

# Vercel: connect repo, set env vars, deploy
# Docker:
docker build -t wasty-admin .
docker run -p 3000:3000 --env-file .env.production wasty-admin
```

### Smoke test
1. `curl https://your-admin/api/health` → `{ "ok": true, "misconfig": [] }`
2. Login as each admin type → sidebar + search show only allowed routes
3. Issue bag QR → activate in user app
4. Schedule pickup → appears in Admin Jobs
5. Assign partner → partner sees job
6. Complete pickup → user points increase
7. SOS → Ops Reports → ack/close
8. Government login → Compliance + Analytics only

### Environment reference
| Variable | Required (prod) | Notes |
|----------|-----------------|-------|
| `NEXT_PUBLIC_FIREBASE_*` | yes | Web SDK config |
| `FIREBASE_ADMIN_SDK_PATH` | yes* | Or `FIREBASE_ADMIN_SDK_JSON` |
| `WASTY_DATA_PROVIDER` | yes | `firebase` |
| `WASTY_AUTH_BYPASS` | must be unset | Dev only |
| `WASTY_DEV_ADMIN_TYPE` | dev only | SQLite local RBAC testing |

### Deferred (not blockers for core loop)
- Real UPI/card payments & subscription billing
- Live AI inference (queue is Firestore-backed; overrides persist)
- P2P escrow / payment rails
- Partner demo shells (team, promos, surge, training)
- ~~Continuous live GPS tracking~~ → partner app now publishes `partners/{uid}.lat/lng` every 60s (foreground)
- Redis/Upstash (Next.js cache sufficient at current scale; add when >50k DAU on admin)

### Cross-app sync (implemented)
| Flow | Status |
|------|--------|
| Jobs: schedule → assign → accept → arrive → complete | Partner app uses `on_the_way` / `arrived` on `jobs` (aligned with Cloud Functions) |
| Admin push → user activity + device | Admin writes `notifications/{uid}/items` + `users/{uid}/activity`; `deliverAdminPush` Cloud Function sends Expo push |
| Admin push → partner inbox + device | Admin writes `partners/{uid}/notifications`; partner registers `pushToken` |
| Partner SOS → admin ops | Partner creates `opsReports` (type `sos`) |
| Live map | Reads real Firestore jobs/partners/bins (partner GPS heartbeat) |
| Sell waste requests | Admin mapper accepts app schema (`wasteType`, `quantityKg`, `pending`) |

Deploy updated Functions + rules after pulling these changes:
```bash
cd D:\Wasty\Application_mvp\functions && npm run build
cd D:\Wasty\Application_mvp
firebase deploy --only functions,firestore:rules,firestore:indexes
```

### Admin Phase-3 collections (created on first write)
`mrfFacilities`, `mrfInbound`, `aiSegregationJobs`, `materialLots`, `p2pListings`, `buyers`, `config/ai`, `admins`
