# NARGITO — Technical Design

Companion to `design.md` (requirements and AC numbers referenced as AC-n). Greenfield repo at `e:\nargito`. All paths below are relative to it.

## 1. Overview and locked decisions

NARGITO is a **modular monolith**: one Next.js (App Router) application, one PostgreSQL database, plus one Node **worker** process built from the same codebase. The worker runs queued and scheduled jobs. Domain logic lives in server-only modules under `src/modules/*`. UI, route handlers and server actions are thin adapters over those modules. There are no microservices.

**The stack is locked on approval.**

| Concern | Decision | Reason |
|---|---|---|
| Runtime | Node.js ≥ 22 LTS (dev machine has 24). npm with `package-lock.json`, `.npmrc: save-exact=true`. | npm is installed already. Exact pins give reproducible builds. |
| Framework | Next.js 15.x (App Router, React 19, `output: 'standalone'`, `middleware.ts`). | Stable and widely documented. We use no Next 16-only APIs. |
| Language | TypeScript 5.x, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. | Brief requires strict. |
| Styling | Tailwind CSS v4 (CSS-first `@theme inline` bound to CSS variables), `class-variance-authority`, `tailwind-merge`, `clsx`. | Tokens map 1:1 to CSS vars, so theming is trivial. |
| UI primitives | Radix UI primitives, shadcn-style source components in `src/components/ui`, `lucide-react`, `sonner` (toasts). | Accessible primitives, owned source. |
| Client data | TanStack Query (infinite feeds and realtime merge), `react-hook-form` + `@hookform/resolvers/zod`. Server Components fetch directly through module queries. | |
| **ORM** | **Drizzle ORM** (`drizzle-orm`, `drizzle-kit`) with `pg` (node-postgres) driver. **Not Prisma.** | Partial and expression indexes, generated tsvector columns, `CHECK` constraints and SQL-first migrations are first-class. Prisma needs raw SQL for most of these. |
| Database | PostgreSQL 16+. No extensions required (no PostGIS, citext or pg_trgm). | Keeps the schema portable, including on managed hosts and ephemeral test DBs. |
| IDs | UUIDv7 generated in the app (`uuidv7` package). | Time-ordered, so `ORDER BY id` equals creation order. This makes the pagination cursor trivial. |
| Auth | **Better Auth** (core + `emailOTP`, `phoneNumber`, `twoFactor` plugins, Drizzle adapter). Not its `admin` plugin. | Native Postgres/Drizzle support, social, OTP, TOTP and cookie sessions. Tables map to our `users`, `sessions`, `auth_accounts`, `verification_tokens`. |
| Validation | Zod (the major line Better Auth's peer range requires, pinned). | One schema serves client forms and server. |
| Rate limiting / cache / pub-sub | Redis 7 via `ioredis` and `rate-limiter-flexible`. | One service covers limiting, SSE fan-out and short caches. |
| Jobs | `pg-boss` (queues in Postgres, own `pgboss` schema) in the worker. | No extra infrastructure. Cron and retries built in. |
| Realtime | Server-Sent Events (`/api/realtime/stream`) plus Redis pub/sub. | One-way push fits messages and notifications. Works behind standard proxies on a long-running Node host. |
| Object storage | Any S3-compatible store through `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`. MinIO for dev. | |
| Media processing | `sharp` (images), `file-type` (magic bytes). | |
| Email | `nodemailer` over SMTP, `@react-email/components` templates. | Works with any SMTP provider (SES, Postmark, Brevo, Mailpit in dev). |
| SMS/OTP | Twilio Messaging REST API (plain `fetch`, no SDK) behind an `SmsProvider` interface. | |
| Payments | Razorpay adapter behind a `PaymentProvider` interface. | India-first, UPI/INR. |
| Push | Web Push (VAPID) via `web-push`. | |
| i18n | `next-intl` (locale-prefixed routing, `as-needed`) with DB overrides. | |
| Monitoring | `@sentry/nextjs`, `pino` structured logs. | |
| Testing | Vitest, Testing Library, `embedded-postgres` fallback, Playwright (+ `@axe-core/playwright`). | |
| Charts | `recharts` (admin only, client-loaded dynamically). | |
| Markdown (CMS) | `react-markdown` + `rehype-sanitize`. No raw HTML. | |
| Deploy | Multi-stage `Dockerfile`; `docker-compose.yml` for dev (postgres, redis, minio, mailpit) and a production reference (web, worker). | |

**Versions:** pin exact versions at scaffold from the current stable release of each major line, committed in the lockfile. Better Auth plugin option names are verified in the scaffold step against the pinned version's docs. Section 6 states the required *behaviour*, and the contract tests in §20 enforce it.

**Resolved-by-choice decisions (never left to the implementer):**
- Offset pagination is not used anywhere (§5.3).
- A site-wide CSP nonce makes every HTML response dynamic. Performance comes from data-level caching with `unstable_cache` and tag revalidation, not from static HTML. A CDN does not cache HTML.
- Locale routing is a URL prefix (`/hi/...`) so Hindi pages have crawlable URLs and `hreflang`. English has no prefix.
- Notification, message and OTP sends are never faked. See §17 for the test-transport rule.

## 2. Repository layout

```
e:\nargito
├─ Assets/nargito_logo.png                 # source of truth, never modified
├─ brand.lock.json                         # sha256 + dimensions of the source logo
├─ src/
│  ├─ app/
│  │  ├─ (site)/[locale]/...               # public + auth + member + business routes (root layout #1, <html lang>)
│  │  ├─ admin/...                         # admin panel (root layout #2, noindex, no-store)
│  │  ├─ api/...                           # route handlers (no locale)
│  │  ├─ manifest.webmanifest/route.ts
│  │  ├─ robots.ts  sitemap.ts
│  │  ├─ [...rest]/page.tsx                # catch-all: redirect table lookup, else notFound()
│  │  └─ icon.png apple-icon.png favicon.ico
│  ├─ modules/<domain>/                    # see §3
│  ├─ db/ {client.ts, schema/*.ts, migrations-meta, seed/*.ts, helpers.ts}
│  ├─ server/ {action.ts, route.ts, errors.ts, result.ts, auth-context.ts, csrf.ts, rate-limit/, redis.ts, storage/, mail/, sms/, payments/, push/, ai/, logger.ts}
│  ├─ config/ {env.ts, integrations.ts, tokens.ts}
│  ├─ components/ {ui/, shell/, feed/, forms/, admin/}
│  ├─ i18n/ {routing.ts, request.ts, messages/en.json, messages/hi.json}
│  ├─ styles/globals.css                   # tokens + @theme inline
│  ├─ worker/ {index.ts, jobs/*.ts}
│  └─ middleware.ts                        # locale routing, CSP nonce, request-id, headers (no DB access)
├─ drizzle/                                # committed SQL migrations
├─ public/ {sw.js, brand/*, offline.html?}
├─ scripts/ {generate-brand-assets.mjs, check-brand-asset.mjs, bootstrap-admin.ts, i18n-sync.ts, backup/*}
├─ tests/ {unit/, integration/, e2e/, setup/}
├─ docs/ {DEPLOYMENT.md, OPERATIONS.md, INTEGRATIONS.md, SECURITY.md}
├─ Dockerfile  docker-compose.yml  .env.example  drizzle.config.ts  next.config.ts  vitest.config.ts  playwright.config.ts
└─ .github/workflows/ci.yml
```

`/offline` is a normal localized page (precached by the service worker). `public/offline.html` is not used.

## 3. Domain modules and boundary rules

Each module is `src/modules/<name>/` with:
- `index.ts` — the only public surface (types, query functions, service functions meant for other modules).
- `service.ts` — business logic. `import 'server-only'`. Takes an explicit `ctx` and a `tx` or `db`.
- `queries.ts` — read models for pages and APIs, including viewer-aware visibility filters.
- `policy.ts` — pure resource-level authorization (`canEdit(ctx, row)`). Unit-testable without a DB.
- `schemas.ts` — Zod input schemas, shared by forms and actions.
- `actions.ts` — `'use server'` mutations, declared with `defineAction` (§7).
- `events.ts` — domain events emitted after commit (§3.2).

Table definitions live in `src/db/schema/<domain>.ts` so that `drizzle-kit` sees one schema. A module imports only its own tables. To use another domain's data it calls that module's `index.ts`. Boundaries are enforced by `eslint-plugin-boundaries` (or `import/no-restricted-paths`) in CI. `components/` and `app/` may import only `modules/*/index.ts`, `queries`, `schemas` and `actions`, never `service.ts` or `db/`.

| Module | Owns tables | Responsibility |
|---|---|---|
| `identity` | users, user_profiles, user_blocks | Profile CRUD, username rules, privacy settings, account status (active/suspended/banned/pending_deletion/deleted). |
| `auth` | auth_accounts, sessions, verification_tokens, two_factor | Better Auth configuration, OTP and SMS/email senders, MFA, step-up, session listing and revocation. |
| `rbac` | roles, permissions, role_permissions, user_roles, user_permission_overrides | Permission catalogue, effective-permission computation, role administration, `requirePermission`. |
| `graph` | user_connections, user_follows | Follow, connect, suggestions, mutuals. Block effects are applied by calling `identity`. |
| `media` | media_assets | Upload signing, completion, magic-byte validation, processing, public/restricted visibility, signed URLs. |
| `content` | posts, post_media, post_reactions, comments, comment_reactions, post_bookmarks, post_shares, content_categories | Posts, feed assembly, comments, reactions, bookmarks, shares. |
| `moderation` | content_reports | Reports, auto-hide thresholds, moderator decisions, optional AI triage suggestion. |
| `business` | companies, company_members, shops, shop_members, business_verification_requests | Pages, membership, verification. |
| `marketplace` | products, services, listing_media, listing_categories, listing_status_history, listing_enquiries | Listings, lifecycle, enquiry creation (delegates conversation to `messaging`). |
| `trips` | trips, trip_itinerary_items, trip_media, trip_participants | Trips, itinerary, join flow, auto status. |
| `messaging` | conversations, conversation_participants, messages, message_attachments | Conversations (with reuse), messages, read state, realtime publish. |
| `notifications` | notifications, notification_preferences, push_subscriptions | Create/aggregate, fan-out to in-app, email and push. |
| `groups` | groups, group_members | Communities. |
| `promotions` | advertisements, promotion_campaigns, promotion_events | Campaign lifecycle, serving, event capture, analytics. |
| `billing` | subscription_plans, subscriptions, payments, refunds, billing_events | Plans, checkout, webhooks, entitlements, refunds. |
| `search` | recent_searches | Global search queries, typeahead, recents. |
| `location` | — | Geohash utilities, neighbour expansion, bucketed distance. Pure functions. |
| `settings` | site_settings, feature_flags | Typed registry, cached reads, flag evaluation, `assertFeature`. |
| `i18n` | languages, translation_keys | Catalogue merge, admin edits, parity report. |
| `cms` | cms_pages, cms_page_revisions, redirects | Pages, revisions, publish/rollback, redirect resolution. |
| `audit` | admin_audit_logs, security_events, system_logs, admin_action_approvals | Append-only logs, approvals workflow. |
| `jobs` | scheduled_jobs | Registry mirror, enable/disable, run-now. |
| `privacy` | data_export_jobs, deletion_requests | Exports, deletion/anonymisation. |
| `admin` | — | Read-model aggregation for admin dashboards (calls other modules' queries). It owns no tables. |

### 3.1 Dependency direction
`app/components → modules (actions/queries) → modules' index → server/* infra`. Allowed cross-module edges (anything else fails lint):
- `content`, `marketplace`, `trips`, `groups`, `messaging`, `promotions`, `billing`, `business` → `identity`, `rbac`, `graph` (visibility), `media`, `audit`, `notifications`, `settings`, `location`.
- `marketplace` → `messaging` (open or reuse conversation).
- `moderation` → `content`, `marketplace`, `trips`, `groups`, `business`, `identity` (via a `ModerationTarget` adapter registry, §10.9).
- `privacy` → every module that owns user data through a `PersonalDataProvider` registration (`export(userId)`, `erase(userId, tx)`).
- `identity`, `rbac`, `settings`, `audit`, `location` depend on no other domain module.

### 3.2 Domain events
After commit, services call `emit(event)`. An in-process dispatcher handles it. Handlers enqueue pg-boss jobs (`notification.fanout`, `email.send`, `push.send`, `media.reconcile`) or publish to Redis. Events are not a correctness mechanism. State changes and audit rows are in the same DB transaction. If a handler fails, the job retries (5 attempts, exponential backoff). The `notifications.fanout` job is idempotent through `notifications.dedupe_key`.

## 4. Configuration, environment and integrations

`src/config/env.ts` parses `process.env` once with Zod. This is the only file that reads `process.env`, enforced by lint (`no-restricted-properties`). Server-only values never get a `NEXT_PUBLIC_` prefix. Client-visible values are in a separate `publicEnv` object. Startup fails fast with a readable error if a **core** variable is missing or invalid.

`src/config/integrations.ts` defines each integration as `{ id, requiredEnv[], optional, featureFlags[] }`. `getIntegrationStatus()` returns `{ id, configured, missing[], lastCheck? }`. `lastCheck` comes from `site_settings` key `integrations.check.<id>` (written by "Test connection"). The status feeds the UI: a dependent feature renders the `<ConfigurationRequired integration="…" />` component and its actions throw `CONFIGURATION_REQUIRED`. The result is "configured" only when all env vars are present, and "verified" only after a successful admin test. The UI wording is "Configured, not yet tested" until then. This applies to Google/Facebook, SMTP, SMS, object storage, payments, AI, Sentry and Web Push.

### 4.1 Core variables (required, startup fails without them)

| Var | Purpose |
|---|---|
| `NODE_ENV` | `development` / `test` / `production`. |
| `APP_URL` | Canonical origin, e.g. `https://nargito.example`. Used for CSRF allow-list, absolute links, OAuth callbacks, emails. |
| `DATABASE_URL` | Runtime DB URL (role `nargito_app`: DML only). |
| `DATABASE_MIGRATE_URL` | Migration DB URL (role `nargito_migrator`: DDL). Used only by `db:migrate`. |
| `BETTER_AUTH_SECRET` | ≥ 32 random bytes. Signs cookies and tokens. |
| `REDIS_URL` | Required in production. In development/test it falls back to the in-memory adapter. Production refuses to boot without it. |
| `APP_SECRET` | ≥ 32 bytes. HMAC for promotion serve tokens, IP/session hashing and signed cursors if any. |
| `TRUSTED_PROXY_HOPS` | Integer ≥ 0. How many `X-Forwarded-For` hops to trust when deriving the client IP. |
| `ALLOWED_ORIGINS` | Optional CSV of extra origins allowed for mutations. |
| `LOG_LEVEL` | `info` by default. |

### 4.2 Integrations requiring external credentials

| Integration | Env vars (all required unless noted) | When absent | Used for |
|---|---|---|---|
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | "Continue with Google" shows disabled with "configuration required". | Social login. Callback `${APP_URL}/api/auth/callback/google`. |
| Facebook OAuth | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | Same. | Social login. Callback `${APP_URL}/api/auth/callback/facebook`. |
| Email (SMTP) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` (`true`/`false`), `MAIL_FROM` | Email/password sign-up is disabled in production (no verification is possible). Email-based flows show "configuration required". | Verification, reset, email OTP, notification mail. |
| SMS / OTP (Twilio) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and one of `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_NUMBER` | Phone login hidden/disabled with "configuration required". OTP endpoint returns `CONFIGURATION_REQUIRED`. | Phone OTP. |
| Object storage (S3-compatible) | `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_PUBLIC`, `S3_BUCKET_PRIVATE`, `S3_FORCE_PATH_STYLE` (optional, `true` for MinIO) | All upload UI disabled with "configuration required". Text-only content still works. | Media. |
| CDN (optional) | `CDN_BASE_URL` | Public media is served from the public bucket origin. | Public media base URL. |
| Payments (Razorpay) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`; client `NEXT_PUBLIC_RAZORPAY_KEY_ID` (public by design) | Pro and Promote checkout disabled. Plans and campaigns can be drafted but not paid. | Subscriptions, promotions, refunds. |
| Web Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:`), client `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Push toggle hidden. In-app and email are unaffected. | Push notifications. |
| AI assist | `AI_PROVIDER` (`anthropic`), `ANTHROPIC_API_KEY`, `AI_MODEL` | "Improve with AI" and report-triage hints hidden (`ai_assist` flag forced off). | Optional writing assist and advisory moderation triage. Output is never auto-applied. |
| Sentry | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, and for source-map upload at build `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Errors go to structured logs and `system_logs` only. Admin health shows "Sentry not configured". | Error monitoring. |

Non-secret deployment variables: `S3_PUBLIC_BASE_URL` (optional override), `NEXT_PUBLIC_APP_URL` (equals `APP_URL`), and test-only `MAIL_TRANSPORT=file`, `SMS_TRANSPORT=file`, `STORAGE_TRANSPORT=memory` (§17). `.env.example` lists all variables with comments. `docs/INTEGRATIONS.md` explains how to create each credential and test it.

### 4.3 Honesty rules
1. No code path logs "sent" or returns success without a provider response. Provider failures surface as `PROVIDER_ERROR` (HTTP 502) and are logged at `error` with the provider's non-secret error code.
2. Test transports (`file`, `memory`) are refused when `NODE_ENV=production` (env validation error). They are labelled "test transport" in the admin integration page.
3. Nothing in the repository's docs or UI claims an integration is verified unless a stored admin test result says so.

## 5. Database conventions

### 5.1 Conventions
- `id uuid primary key`, UUIDv7 from the app. Timestamps are `timestamptz` (`created_at default now()`, `updated_at` maintained by the service layer plus a shared `set_updated_at()` trigger created in migration 0000).
- Money: `*_minor bigint` plus `currency char(3)` (ISO 4217, upper-case `CHECK`). Never floats.
- Closed state sets use `pgEnum`. Open registries (permission keys, notification types, setting keys) are `text` validated against code catalogues.
- Case-insensitive uniqueness uses a unique index on `lower(col)` (no citext). Application code always writes lower-cased email and username.
- Naming: tables snake_case plural. FK constraints `fk_<table>_<col>`, indexes `ix_<table>_<cols>`, unique `ux_<table>_<cols>`.
- Default FK actions: `ON DELETE CASCADE` for owned child rows (e.g. `post_media`), `RESTRICT` for references that must outlive actions (e.g. payments), and `SET NULL` for optional attribution (e.g. `deleted_by`).
- Free-text columns have `CHECK (char_length(col) <= N)` that mirror the Zod limit, so the DB enforces the invariant even if a code path skips validation.
- The shorthand `[std]` means `id, created_at, updated_at`. `[sd]` means `[std]` + `deleted_at timestamptz null, deleted_by uuid null → users(id) ON DELETE SET NULL`.

### 5.2 Soft-delete rules
1. Soft delete (`deleted_at`) applies to user-generated, user-visible entities: users (via status + anonymisation, see below), posts, comments, companies, shops, products, services, trips, groups, messages. Tables without `deleted_at` are either join rows (hard-deleted), logs (append-only), or financial records (never deleted).
2. Every read goes through `notDeleted(table)` in `db/helpers.ts`, and viewer-aware queries use `visibleTo(viewer)`. Direct `db.select().from(posts)` outside `queries.ts`/`service.ts` is flagged by lint. Soft-deleted rows return 404 to everyone except holders of the relevant moderation permission, who see them in admin only.
3. Unique slugs and usernames are **partial unique indexes** `WHERE deleted_at IS NULL`, so a slug can be re-used after delete. Usernames are released only when the user is anonymised.
4. Child counters (`comment_count`, etc.) exclude soft-deleted children. Soft delete decrements in the same transaction.
5. Purge: the `retention.purge` job hard-deletes rows with `deleted_at < now() - retention_days` (setting `privacy.soft_delete_retention_days`, default 30) in dependency order, and deletes their media objects. Rows under moderation or legal hold (`content_reports.status in (open, in_review)` referencing them) are skipped.
6. Never hard-deleted: `payments`, `refunds`, `billing_events`, `subscriptions`, `admin_audit_logs`, `security_events`.
7. A deleted user is **anonymised**, not removed: `status='deleted'`, `email/phone/username` replaced by tombstone values (`deleted-<id>`), profile, accounts and sessions deleted, and personal content soft-deleted then purged. Their financial and audit rows keep the `user_id`.
8. `messages`: "delete for everyone" sets `deleted_at` and nulls `body`. The row stays so that ordering and reply references remain valid.

### 5.3 Cursor (keyset) pagination
- Default list order is **`id DESC`** (UUIDv7 = creation order). Cursor = opaque base64url of `{"id":"<uuid>"}`. Query: `WHERE id < :cursor ORDER BY id DESC LIMIT :limit+1`. If `limit+1` rows come back, `nextCursor` is the id of the last row kept. Otherwise it is `null`.
- Lists ordered by another column (inbox by `last_activity_at`, search by rank, admin lists by `updated_at`) use a composite cursor `{"v":"<value as text>","id":"<uuid>"}`. `v` is the column value cast `::text` in SQL, so microseconds are not lost. The predicate is `(col, id) < ($v::timestamptz, $id)`. Rank-ordered search uses `(rank::text, id)`, with a hard cap of 200 results deep.
- `limit` default 20, max 50 (admin tables 25, max 100). Responses: `{ items: T[], nextCursor: string | null }`.
- Cursor parsing is in `server/pagination.ts` (Zod-validated). A malformed cursor returns `VALIDATION` (`cursor`).
- Every paginated query must have an index whose leading columns are its filter columns followed by the order column. Each table's index list below gives them.
- Admin total counts use `count(*)` only on filtered, indexed subsets. Otherwise they show "N+" using a capped count (`LIMIT 10001`).

### 5.4 Full-text search
`search_tsv tsvector GENERATED ALWAYS AS (…) STORED` on posts, products, services, trips, companies, shops, groups, user_profiles. It uses the `'simple'` configuration, which is language-neutral and works for Devanagari tokens without a stemmer. A GIN index is on each. Queries use `websearch_to_tsquery('simple', :q)`. Typeahead on names uses `lower(col) text_pattern_ops` btree indexes with `LIKE :prefix || '%'`. Query strings are capped at 100 characters.

### 5.5 Location columns
Wherever a location is stored: `geohash5 char(5) null` plus `geohash4 char(4) GENERATED ALWAYS AS (left(geohash5,4)) STORED`, with `city`, `region`, `country_code char(2)` as plain text. There is **no latitude/longitude column anywhere**. `CHECK (geohash5 ~ '^[0-9b-hjkmnp-z]{5}$')`. Indexes: `(geohash5, id DESC)` and `(geohash4, id DESC)` (partial on non-null).

## 6. Authentication and sessions

### 6.1 Better Auth wiring (`src/modules/auth/auth.ts`)
Better Auth is mounted at `/api/auth/[...all]`. The Drizzle adapter maps Better Auth's `user/session/account/verification` models to our tables `users/sessions/auth_accounts/verification_tokens` through `modelName` and `fields`. The Drizzle property names are camelCase and the columns are snake_case (§8.1). Required behaviour (the contract the tests in §20 assert):

- **Email + password.** Minimum 10, maximum 128 characters. A bundled deny-list of the 10k most common passwords is checked. `requireEmailVerification` is true. Passwords are hashed with scrypt (Better Auth default) and stored in `auth_accounts.password`. Reset-password token lifetime 60 minutes, single use. A successful reset revokes all other sessions (AC-5).
- **Email OTP** (`emailOTP` plugin) is used for email verification and "sign in with a code". 6 digits, 10-minute expiry, 5 attempts.
- **Phone OTP** (`phoneNumber` plugin). E.164 numbers are normalised, 6-digit OTP, 5-minute expiry, 3 attempts, 60-second resend cooldown (AC-2). SMS is sent through `SmsProvider`. Adds `users.phone_number` and `users.phone_number_verified`.
- **Google and Facebook** social providers. Registered only when their env vars exist. Scopes: `openid email profile` (Google), `email public_profile` (Facebook). **Account linking:** automatic only for Google, which returns a verified email (`trustedProviders: ['google']`). A Facebook sign-in whose email matches an existing account does **not** auto-link. The user must sign in and link from Settings → Security. This prevents account takeover through an unverified provider email.
- **TOTP MFA** (`twoFactor` plugin, issuer `Nargito`): TOTP secret encrypted at rest by the plugin, 10 single-use backup codes. Adds `users.two_factor_enabled` and the `two_factor` table.
- **Sessions.** Database sessions (no JWT) in `sessions`. 30-day expiry, sliding refresh once per 24 h (`updateAge`). Cookie name `nargito.session_token` (`__Secure-` prefix in production), `HttpOnly`, `Secure` (production), `SameSite=Lax`, `Path=/`. The cookie is not used for any cross-site purpose. No session data is stored in `localStorage`. A session row stores `ip_address`, `user_agent`, `device_label`, and the custom column `step_up_at`.
- **Sign-in rate limits** are in §7.4. Failed attempts also write `security_events`.
- **Status gate.** After resolving a session, `getAuthContext()` rejects (and revokes the session of) users whose `status` is `suspended`, `banned` or `deleted`. `pending_deletion` users can sign in only to cancel deletion.

### 6.2 `getAuthContext()` (`server/auth-context.ts`)
Wrapped in `React.cache` so it runs once per request. It returns `null` or:
```ts
type AuthContext = {
  user: { id: string; username: string; locale: string; status: UserStatus; twoFactorEnabled: boolean };
  session: { id: string; createdAt: Date; stepUpAt: Date | null };
  permissions: ReadonlySet<PermissionKey>;   // effective, server-computed (§8.2)
  entitlements: Entitlements;                // from active subscription (billing)
  has(p: PermissionKey): boolean;
  stepUpFresh(maxAgeMin: number): boolean;
};
```
It is the only source of identity for actions, route handlers and server components. Client code receives only a trimmed `viewer` DTO (id, username, avatar, locale, and a boolean-map of UI-relevant capabilities). The DTO is for rendering. It is never an authorization input.

### 6.3 Admin access, MFA and step-up
`requireAdmin(permission)` runs in `app/admin/layout.tsx` and again in every page, action and route handler:
1. Not signed in → redirect to `/login?next=…`.
2. `!permissions.has('admin.access')` → `notFound()` (404, so the existence of /admin is not leaked). It writes a `permission_denied` security event when the user is signed in.
3. `!user.twoFactorEnabled` → redirect to `/admin/security/enroll`. Only the enrolment and step-up pages render in this state (AC-6).
4. `session.stepUpAt` null, or older than 12 hours → redirect to `/admin/security/step-up`. The absolute admin session age is capped at 12 hours (`auth.admin_session_hours` setting, max 12). Idle timeout is 30 minutes using `sessions.updated_at`, and the admin layout does not slide the session.
5. The page-specific permission → `notFound()` if missing.
6. Sensitive permissions (`permissions.is_sensitive`) additionally require `stepUpFresh(15)` for actions, otherwise `STEP_UP_REQUIRED`.

Step-up: the user submits a TOTP or backup code to the `verifyStepUp` action. It calls the Better Auth TOTP verify API, then sets `sessions.step_up_at = now()` and writes `security_events('mfa_step_up')`. Three failures in 5 minutes revoke the session.

Bootstrap: `npm run admin:bootstrap -- --email you@example.com` runs with direct DB access (migrator URL). It assigns the `super_admin` role to an existing verified user and writes an audit row (actor `null`, action `bootstrap`). There is no web route that creates an admin from nothing.

## 7. Server contracts

### 7.1 Mutation contract: `defineAction` (`server/action.ts`)
Every mutation (Server Action) and every mutating Route Handler is declared with one of these factories. They fix the order of steps, so an author cannot reorder or skip one. `defineAdminAction` additionally requires `permission`, `audit` and forbids `public: true` at the type level.

```ts
defineAction({
  name: 'content.createPost',           // unique; appears in logs, rate-limit keys, the action registry
  auth: 'required' | 'optional' | 'none',
  permission?: PermissionKey,           // checked against effective permissions
  feature?: FeatureKey,                 // feature flag required to be on
  stepUp?: 'recent',                    // forces fresh TOTP (admin sensitive)
  input: ZodSchema,
  rateLimit: RateLimitPolicyKey,        // from the policy table (§7.4)
  authorize?: (ctx, input) => Promise<Resource>,   // ownership/state/visibility checks
  approval?: ApprovalRule,              // four-eyes (§8.4)
  run: (ctx, input, resource, tx) => Promise<Output>,
  audit?: (ctx, input, output) => AuditEntry,      // required for admin actions
  after?: (ctx, output) => void,        // events, revalidateTag; runs post-commit
}): (rawInput: unknown) => Promise<Result<Output>>
```

**Order of execution (fixed):**
0. *Pre-step:* `Origin`/`Sec-Fetch-Site` check (§14.2), maintenance-mode check (non-admin mutations → `MAINTENANCE`, 503), and the coarse per-IP limiter (`ip.mutations`, 300/min). The coarse limiter is not the policy step below. Its job is to cap floods before any DB work.
1. **Authenticate.** `getAuthContext()`. `auth:'required'` and no ctx → `UNAUTHENTICATED`.
2. **Authorize (capability).** `feature` enabled, else `FEATURE_DISABLED`. `permission` present, else `FORBIDDEN` (admin actions: 404-equivalent `NOT_FOUND` for a non-admin). `stepUp` fresh, else `STEP_UP_REQUIRED`.
3. **Validate.** `input.safeParse`. Failure → `VALIDATION` with `fieldErrors: Record<path, i18nKey>`.
4. **Verify ownership and state.** `authorize()` loads the target (`SELECT … FOR UPDATE` when `run` will mutate it), applies the policy (owner/member/role in the resource, block lists, visibility, allowed state transition). A resource the caller may not even see → `NOT_FOUND`. Visible but not permitted → `FORBIDDEN`. Invalid state → `CONFLICT`.
5. **Rate limit.** Policy-keyed limiter (user id, or IP when anonymous). Exceeded → `RATE_LIMITED` with `retryAfterSec`.
6. **Approval gate** (if `approval` rule matches): create `admin_action_approvals(pending)` and return `APPROVAL_REQUIRED` with the approval id. The approved execution re-enters at step 7 with the stored payload (§8.4).
7. **Transaction.** `db.transaction(tx => run(...))`. Isolation `READ COMMITTED`, except flows needing serialisation use `FOR UPDATE` row locks or advisory locks (named in each flow). Retries only on `40001/40P01`, up to 3 times.
8. **Audit.** `audit()` runs inside the same transaction and inserts `admin_audit_logs` (admin actions: mandatory; member actions: only for security-relevant ones such as password change, MFA, email change, blocks of staff).
9. **Respond.** `{ ok: true, data }` and post-commit `after()` (events, `revalidateTag`).

```ts
type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };
type AppError = { code: ErrorCode; message: string /* i18n key */; fieldErrors?: Record<string,string>;
                  retryAfterSec?: number; approvalId?: string };
type ErrorCode = 'UNAUTHENTICATED'|'FORBIDDEN'|'NOT_FOUND'|'VALIDATION'|'CONFLICT'|'RATE_LIMITED'|'FEATURE_DISABLED'
  |'STEP_UP_REQUIRED'|'APPROVAL_REQUIRED'|'CONFIGURATION_REQUIRED'|'PROVIDER_ERROR'|'MAINTENANCE'|'INTERNAL';
```

### 7.2 Error handling matrix

| Condition | Code / HTTP | Recoverable | Caller receives | Logging |
|---|---|---|---|---|
| No session | `UNAUTHENTICATED` 401 | yes (sign in) | message key, UI redirects to login | none |
| Missing permission, member action | `FORBIDDEN` 403 | no | message key | none |
| Missing permission, admin surface | `NOT_FOUND` 404 | no | 404 page | `security_events: permission_denied` (warn) |
| Feature flag off / integration not configured | `FEATURE_DISABLED` 403 / `CONFIGURATION_REQUIRED` 503 | yes (admin config) | message key + integration id | none (config state is visible in admin) |
| Zod failure | `VALIDATION` 422 | yes | `fieldErrors` | none |
| Missing/hidden resource | `NOT_FOUND` 404 | no | message key | none |
| Illegal state, unique-violation (`23505`) mapped by constraint name, optimistic conflict | `CONFLICT` 409 | maybe | message key | none |
| Rate limit | `RATE_LIMITED` 429 + `Retry-After` | yes (wait) | `retryAfterSec` | `security_events: rate_limited` sampled 1 in 10 per key per minute (info) |
| Origin/CSRF failure | `FORBIDDEN` 403 | no | message key | `security_events: csrf_failed` (warn) |
| Step-up needed | `STEP_UP_REQUIRED` 403 | yes | UI opens step-up dialog | none |
| Approval needed | `APPROVAL_REQUIRED` 202 | yes (wait) | approval id | `admin_audit_logs` row `approval.requested` |
| External provider failure (SMTP, SMS, S3, Razorpay, AI) | `PROVIDER_ERROR` 502 | usually, retry | generic message key (provider detail not leaked) | `error` log + Sentry + `system_logs` |
| Redis unavailable | rate limit fails **closed** for auth, OTP, upload-sign and admin policies (`PROVIDER_ERROR`), and **open with a warning** for read-ish policies | yes | | `error` + Sentry |
| DB deadlock/serialisation | retried; if still failing `INTERNAL` | yes | | `warn` on retry, `error` on final |
| Unhandled exception | `INTERNAL` 500 | no | generic message + `requestId` | `error` + Sentry + `system_logs` |

Messages shown to users are i18n keys. Raw error messages never leave the server.

### 7.3 Route Handlers (`server/route.ts`: `defineRoute`)
Used for reads consumed by client components (cursor lists), uploads, SSE, webhooks and Better Auth. It provides the same steps as actions for 1–5 and returns JSON `{ items, nextCursor }` or `{ error: AppError }` with the mapped HTTP status. GET handlers set `Cache-Control: private, no-store` when authenticated. Public GETs set explicit `s-maxage` values. Webhook routes use `csrf: 'signature'` and verify the HMAC before parsing JSON.

### 7.4 Rate-limit policies (`server/rate-limit/policies.ts`)
Sliding window in Redis, key = `policy:<subject>`. Subject is the user id, else the client IP (derived using `TRUSTED_PROXY_HOPS`). Admin can scale all policies by a multiplier through `rate_limit.multiplier` (min 0.25, max 4).

| Policy | Limit | Subject |
|---|---|---|
| `auth.signin` | 10 / 10 min | IP + normalised identifier (both enforced) |
| `auth.signup` | 5 / hour | IP |
| `auth.otp.send` | 3 / 10 min per phone/email, 10 / hour per IP | identifier + IP |
| `auth.otp.verify` | 5 / 10 min | identifier |
| `auth.reset` | 3 / hour | identifier + IP |
| `auth.stepup` | 5 / 5 min | user |
| `content.post` | 30 / hour | user |
| `content.comment` | 60 / hour | user |
| `content.react` | 300 / hour | user |
| `graph.follow` | 100 / hour | user |
| `graph.connect` | 50 / day | user |
| `message.send` | 120 / 10 min | user |
| `enquiry.create` | 20 / day | user |
| `listing.write` | 40 / hour | user |
| `upload.sign` | 60 / hour | user |
| `report.create` | 20 / day | user |
| `search.query` | 60 / min | user or IP |
| `promo.event` | 600 / min | IP |
| `ai.assist` | 20 / hour | user |
| `admin.mutate` | 120 / min | user |
| `ip.mutations` (pre-step) | 300 / min | IP |

## 8. Authorization: RBAC model

### 8.1 Auth-owned tables vs ours
See §11.2 for column details. Better Auth reads and writes `users`, `sessions`, `auth_accounts`, `verification_tokens`, `two_factor`. No Better Auth role field is used. Better Auth's own `admin` plugin is **not installed**, and `users` has no role column.

### 8.2 Effective permissions
```
roles(id, key, name, is_system)                 permissions(id, key, group, is_sensitive, description)
role_permissions(role_id, permission_id)        user_roles(user_id, role_id, expires_at?, granted_by)
user_permission_overrides(user_id, permission_id, effect allow|deny, expires_at?, reason, granted_by)
```
`computeEffectivePermissions(userId, tx|db)` runs a single SQL statement:
```
granted = ⋃ role_permissions of user_roles where (expires_at is null or expires_at > now())
        ∪ permission_ids of overrides where effect='allow' and (expires_at is null or > now())
denied  = permission_ids of overrides where effect='deny'  and (expires_at is null or > now())
effective = granted − denied
```
**Deny always wins.** Users with a non-`active` account status get the empty set. The result is cached per request in `React.cache` only, with no cross-request cache. This means a revoked role or permission takes effect on the next request. Every member gets the system role `member` at sign-up (assigned in the same transaction as user creation), which carries the baseline permissions. Restrictions such as muting a user from posting are `deny` overrides on baseline permissions (e.g. `post.create`).

Guard helpers: `requirePermission(ctx, 'key')`, `can(ctx, 'key')`. No code anywhere compares a role key (`role.key === 'admin'`) to decide access. A lint rule (`no-restricted-syntax` on identifiers `isAdmin`, `role === ` patterns in `src/**`, excluding `rbac/catalog.ts` and seed) and a test that scans the source enforce this (AC-7).

Resource-scoped rights are **not** global permissions: they are policies in each module's `policy.ts` (e.g. `company_members.role in (owner, admin)` may edit). A global permission such as `businesses.manage` lets staff act on any business through admin routes, still audited.

### 8.3 Permission catalogue (source of truth: `src/modules/rbac/catalog.ts`; seeded and synced by `rbac:sync`)
`S` = `is_sensitive` (requires MFA step-up ≤ 15 min). `A` = also requires four-eyes approval (§8.4) above its threshold.

| Group | Keys |
|---|---|
| Access | `admin.access` |
| Dashboard | `dashboard.view`, `analytics.view` |
| Users | `users.read`, `users.update`, `users.suspend` S, `users.ban` S, `users.delete` S A, `users.export` S, `deletions.process` S |
| RBAC | `rbac.read`, `rbac.manage` S A (granting `super_admin` or any `*.manage` permission requires approval) |
| Content | `content.read`, `content.moderate`, `content.restore`, `content.feature`, `categories.manage` |
| Reports | `reports.read`, `reports.resolve` |
| Listings | `listings.read`, `listings.moderate` |
| Businesses | `businesses.read`, `businesses.manage`, `businesses.verify` |
| Trips / Groups | `trips.moderate`, `groups.moderate` |
| Messages | `messages.review_reported` S A (only conversations attached to an open report; opening one is audited) |
| Communication | `notifications.broadcast` S |
| Monetization | `promotions.read`, `promotions.manage`, `ads.manage`, `plans.manage` S, `subscriptions.read`, `subscriptions.manage` S, `payments.read`, `refunds.issue` S A |
| Configuration | `settings.read`, `settings.write` S, `flags.manage` S, `i18n.manage`, `cms.read`, `cms.write`, `cms.publish`, `seo.manage`, `redirects.manage`, `integrations.read`, `integrations.test` S |
| Operations | `jobs.read`, `jobs.manage` S, `system.health`, `logs.read`, `approvals.review` |
| Security | `audit.read`, `security.read`, `security.manage` S (revoke other users' sessions, force MFA reset A) |
| Member baseline (role `member`) | `post.create`, `comment.create`, `reaction.create`, `message.send`, `listing.create`, `company.create`, `shop.create`, `trip.create`, `group.create`, `upload.create`, `report.create`, `connection.request`, `follow.create`, `promotion.purchase`, `subscription.purchase`, `ai.use` |

### 8.4 Role → permission matrix (seeded system roles; admins can create custom roles)
`✓` = all keys of that group. Individual keys are listed when the grant is partial. All staff roles also hold the `member` baseline.

| Group / keys | super_admin | admin | moderator | support | content_manager | finance | analyst | member |
|---|---|---|---|---|---|---|---|---|
| admin.access | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| dashboard.view, analytics.view | ✓ | ✓ | dashboard.view | dashboard.view | dashboard.view | ✓ | ✓ | – |
| users.read | ✓ | ✓ | ✓ | ✓ | – | – | – | – |
| users.update | ✓ | ✓ | – | ✓ | – | – | – | – |
| users.suspend, users.ban | ✓ | ✓ | ✓ | – | – | – | – | – |
| users.delete, users.export, deletions.process | ✓ | ✓ | – | deletions.process, users.export | – | – | – | – |
| rbac.read | ✓ | ✓ | – | – | – | – | – | – |
| rbac.manage | ✓ | – | – | – | – | – | – | – |
| content.* / categories.manage | ✓ | ✓ | content.read, content.moderate, content.restore | content.read | ✓ | – | content.read | – |
| reports.* | ✓ | ✓ | ✓ | reports.read | – | – | – | – |
| listings.*, trips.moderate, groups.moderate | ✓ | ✓ | ✓ | listings.read | listings.read | – | – | – |
| businesses.read, businesses.manage | ✓ | ✓ | read | read | read | – | – | – |
| businesses.verify | ✓ | ✓ | ✓ | – | – | – | – | – |
| messages.review_reported | ✓ | ✓ | – | – | – | – | – | – |
| notifications.broadcast | ✓ | ✓ | – | – | ✓ | – | – | – |
| promotions.*, ads.manage | ✓ | ✓ | promotions.read | – | ✓ | promotions.read | promotions.read | – |
| plans.manage, subscriptions.* , payments.read | ✓ | plans.manage, subscriptions.read, payments.read | – | subscriptions.read | – | ✓ | subscriptions.read | – |
| refunds.issue | ✓ | – | – | – | – | ✓ | – | – |
| settings.read | ✓ | ✓ | – | – | settings.read | settings.read | – | – |
| settings.write, flags.manage | ✓ | ✓ | – | – | – | – | – | – |
| i18n.manage, cms.*, seo.manage, redirects.manage | ✓ | ✓ | – | – | ✓ | – | – | – |
| integrations.read, integrations.test | ✓ | ✓ | – | – | – | integrations.read | – | – |
| jobs.read, system.health, logs.read | ✓ | ✓ | – | system.health | – | – | system.health | – |
| jobs.manage | ✓ | ✓ | – | – | – | – | – | – |
| approvals.review | ✓ | ✓ | – | – | – | ✓ | – | – |
| audit.read, security.read | ✓ | ✓ | security.read | – | – | audit.read | – | – |
| security.manage | ✓ | – | – | – | – | – | – | – |
| member baseline | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

`super_admin` receives every permission key through `rbac:sync`. Any newly added key is auto-granted and flagged in the sync output. `rbac:sync` never removes or alters custom roles, or user overrides.

**Four-eyes approval** (`admin_action_approvals`): actions with `approval` rules — `users.delete`, `refunds.issue` where `amount_minor` > setting `approvals.refund_threshold_minor` (default 0, i.e. all refunds), `rbac.manage` when granting `super_admin` or any `*.manage` permission, `messages.review_reported`, force-MFA-reset. The requester's action stores `{ actionName, input, requestedBy, expiresAt = +24h }`. Another admin holding `approvals.review` plus the action's own permission approves or rejects. **Reviewer ≠ requester, enforced in SQL by `CHECK (reviewed_by <> requested_by)`.** On approval, the registry re-runs the action through steps 1–9 with the stored input, as the *requester's* identity, which is re-validated, and its permission re-checked. The reviewer is recorded in the audit row. Expired approvals can't execute.


## 9. Route map

Locale prefix: `/hi/...` for Hindi, none for English (`localePrefix: 'as-needed'`). The map below omits the prefix. "Dynamic" is the default because of the CSP nonce (§14.1). `Gate` is checked server-side in the page *and* in the data function it calls.

### 9.1 Public (no session required)

| Path | Content | Gate / notes |
|---|---|---|
| `/` | Logged-out marketing landing. Signed-in users are redirected to `/feed`. | Landing copy comes from i18n keys. |
| `/p/[slug]` | CMS pages (about, terms, privacy, help, …) | `cms_pages.status='published'`, else 404. JSON-LD `WebPage`. |
| `/u/[username]` | Public profile | Per `profile_visibility`. Blocked viewers get 404. JSON-LD `Person` (public fields only). |
| `/c/[slug]` | Company page (tabs: about, posts, listings, people) | Suspended/deleted → 404. JSON-LD `Organization`. |
| `/s/[slug]` | Shop page (tabs: products, services, about) | JSON-LD `LocalBusiness` with city only (no street geo). |
| `/marketplace` | Browse and search listings. Filters: type, category, price, condition, location cell | Flag `marketplace`. |
| `/marketplace/products/[slug]`, `/marketplace/services/[slug]` | Listing detail, enquire CTA | Only `status='active'` is public. The owner and moderators can preview other states. JSON-LD `Product` / `Service` with `Offer` (price) when `price_minor` is present. |
| `/trips`, `/trips/[slug]` | Trip discovery and detail | Flag `trips`. Visibility applies. JSON-LD `TouristTrip`. |
| `/groups`, `/groups/[slug]` | Group directory and detail | Private groups: header only, feed hidden to non-members. |
| `/posts/[id]` | Single post permalink | Visibility applies. JSON-LD `SocialMediaPosting`. |
| `/search` | Global search results (`?q=&type=`) | Public content only when signed out. |
| `/offline` | Offline fallback | Precached by SW. |
| `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest` | Generated (§15, §16) | Sitemap index split per entity type (max 5,000 URLs per file), only public + indexable rows. |
| `/[...rest]` | Redirect-table lookup, else 404 | Lowest-specificity route. |

### 9.2 Authentication

| Path | Purpose |
|---|---|
| `/login`, `/signup` | Email/password, phone OTP, email code, Google, Facebook (each provider shown only if configured). |
| `/verify-email`, `/verify-phone` | Enter code / follow link. |
| `/forgot-password`, `/reset-password` | Request and complete reset (token in query, consumed once). |
| `/login/mfa` | TOTP / backup code challenge after the first factor. |
| `/onboarding` | Username, name, headline, language, interests, optional location cell. A signed-in user without a username is redirected here by the shell layout. |

### 9.3 Authenticated member app (shell layout: header + 3 columns; session required)

| Path | Purpose |
|---|---|
| `/feed` | Tabs: Following, Discover, Nearby. Composer: Post / Trip / List item. |
| `/network`, `/network/invitations`, `/network/following`, `/network/discover` | Connections, requests, followed entities, suggestions. |
| `/messaging`, `/messaging/[conversationId]` | Inbox (filter: all, enquiries, unread, archived) and thread. |
| `/notifications` | Notification list with mark-read. |
| `/saved` | Bookmarked posts. |
| `/nearby` | Nearby people, businesses, listings, trips, posts (cell-based). |
| `/compose` | Full-page composer (mobile “Create” sheet target). |
| `/trips/new`, `/trips/[slug]/edit`, `/trips/mine` | Trip authoring and my trips and join requests. |
| `/marketplace/new/product`, `/marketplace/new/service`, `/marketplace/[type]/[slug]/edit`, `/marketplace/mine` | Listing authoring and management with status history. |
| `/groups/new`, `/groups/[slug]/manage` | Group creation and moderation. |
| `/promote/[targetType]/[targetId]`, `/promotions`, `/promotions/[id]` | Create and pay for a campaign, list, analytics. |
| `/pro` | Plans, subscribe, invoices (when payments configured). |
| `/settings` (index) → `/settings/profile`, `/settings/account`, `/settings/security`, `/settings/privacy`, `/settings/notifications`, `/settings/appearance` (theme, language), `/settings/blocked`, `/settings/data` (export, delete), `/settings/billing` | Member settings. |

### 9.4 Business workspace (`/business/*`; session + company/shop membership)

| Path | Purpose |
|---|---|
| `/business` | Workspace switcher: my companies and shops, “Create” buttons. |
| `/business/companies/new`, `/business/shops/new` | Create page. |
| `/business/companies/[slug]` (overview) · `/edit` · `/members` · `/posts` · `/listings` · `/enquiries` · `/analytics` · `/promotions` · `/verification` | Company workspace. |
| `/business/shops/[slug]` (same sub-pages, plus `/catalogue` for products and services) | Shop workspace. |

Membership roles gate sub-pages: owner (everything, plus transfer/delete), admin (everything except transfer/delete), editor (posts and listings, enquiries). Policies are in `business/policy.ts`.

### 9.5 Admin (`/admin/*`; no locale prefix; `X-Robots-Tag: noindex`; `Cache-Control: no-store`)

Every page requires `admin.access` + MFA + the permission shown. All lists are server-rendered, URL-state filtered, cursor-paginated. Data comes from the named tables.

| Group | Path | Permission | Data source / actions |
|---|---|---|---|
| **Overview** | `/admin` | `dashboard.view` | Real KPI cards: users total / new 7d / new 30d, active sessions 24h, posts, active listings by type, open reports, pending verifications, pending approvals, revenue (succeeded payments − refunds, per currency), active campaigns, failed jobs 24h, queue depth. Sparkline: signups and posts per day (30 d). |
| | `/admin/analytics` | `analytics.view` | Growth, content, marketplace, promotions funnels (aggregates over live tables, cached 5 min in Redis). |
| **Content** | `/admin/posts`, `/admin/posts/[id]` | `content.read` · actions `content.moderate`, `content.restore`, `content.feature` | posts (+ media, reports, author). Hide/remove/restore, feature. |
| | `/admin/reports`, `/admin/reports/[id]` | `reports.read` · `reports.resolve` | content_reports queue, target snapshot, decision with note, AI triage hint (if configured). |
| | `/admin/categories` | `categories.manage` | content_categories, listing_categories CRUD with en/hi names. |
| | `/admin/listings` (tabs products/services) | `listings.read` · `listings.moderate` | Review queue (`pending_review`), approve/reject with reason, status history. |
| | `/admin/trips` | `trips.moderate` | Trips list, hide/remove. |
| | `/admin/groups` | `groups.moderate` | Groups list, suspend/remove. |
| | `/admin/businesses` | `businesses.read` · `businesses.manage` | companies/shops, suspend, edit. |
| | `/admin/verifications` | `businesses.verify` | business_verification_requests queue, view private documents (signed URL, audited), approve/reject/needs-info. |
| **Users** | `/admin/users`, `/admin/users/[id]` | `users.read` · `users.update/suspend/ban/delete` | Search by name/email/phone/username, status, sessions, roles, overrides, content counts, security events. |
| | `/admin/roles`, `/admin/roles/[id]` | `rbac.read` · `rbac.manage` | roles, role_permissions editor (system roles' permission sets are editable but `super_admin` is locked). |
| | `/admin/permissions` | `rbac.read` | Catalogue + matrix (read-only; the catalogue is code). |
| | `/admin/deletion-requests` | `deletions.process` | deletion_requests queue. |
| | `/admin/exports` | `users.export` | data_export_jobs status. |
| **Communication** | `/admin/broadcasts` | `notifications.broadcast` | Create an announcement: audience (all / language / role-less filters: country, has-business), channels (in-app, push, email). Recipient count preview, step-up on send. Creates notification rows through a job. |
| | `/admin/conversation-review/[id]` | `messages.review_reported` | Opens only a conversation tied to an open report, after approval. Audited. |
| **Monetization** | `/admin/plans` | `plans.manage` | subscription_plans CRUD, entitlements JSON editor (Zod-validated), provider price refs. |
| | `/admin/subscriptions` | `subscriptions.read` | subscriptions list, cancel (`subscriptions.manage`). |
| | `/admin/payments`, `/admin/refunds` | `payments.read` · `refunds.issue` | Ledger, refund request/approval. |
| | `/admin/promotions` | `promotions.read` · `promotions.manage` | campaigns, review queue, pause/stop, event analytics. |
| | `/admin/ads` | `ads.manage` | advertisements incl. house ads. |
| | `/admin/billing-events` | `payments.read` | Webhook inbox, signature validity, replay (re-process) action `subscriptions.manage`. |
| **Configuration** | `/admin/settings` (tabs by category) | `settings.read` · `settings.write` | General, Branding (read-only brand block; name/tagline editable), SEO, PWA, Auth, Uploads, Moderation, Promotions, Privacy, Limits. Forms generated from the settings registry (§16.1). |
| | `/admin/feature-flags` | `flags.manage` | feature_flags CRUD, rollout %, allow-list. |
| | `/admin/languages`, `/admin/translations` | `i18n.manage` | languages enable/disable/default. Translation table with filter “missing”, inline edit. |
| | `/admin/cms`, `/admin/cms/[id]` | `cms.read` · `cms.write` · `cms.publish` | Pages, editor, revisions diff, publish, rollback. |
| | `/admin/seo` | `seo.manage` | Defaults, indexing toggle, sitemap preview, structured-data preview. |
| | `/admin/redirects` | `redirects.manage` | redirects CRUD, hit counts, loop detection on save. |
| | `/admin/integrations` | `integrations.read` · `integrations.test` | Per integration: env var names, present/missing (never values), last test result, “Test connection”. |
| **Operations** | `/admin/jobs` | `jobs.read` · `jobs.manage` | scheduled_jobs + pg-boss queue stats, enable/disable, run now. |
| | `/admin/system-health` | `system.health` | DB latency, Redis, storage, SMTP, queue depth, worker heartbeat, build id, version. |
| | `/admin/logs` | `logs.read` | system_logs viewer (level, source, request id). |
| | `/admin/approvals` | `approvals.review` | admin_action_approvals inbox. |
| **Security** | `/admin/audit-logs` | `audit.read` | admin_audit_logs filter by actor/action/target/date, diff view. Export CSV (audited). |
| | `/admin/security-events` | `security.read` | security_events. |
| | `/admin/security/sessions` | `security.read` · `security.manage` | Active sessions per user/all, revoke. |
| | `/admin/security/enroll`, `/admin/security/step-up` | (any signed-in user holding `admin.access`) | TOTP enrolment with QR + backup codes, step-up. |

The sidebar is generated from a static `adminNav` array filtered by `ctx.has(permission)`, with the same permission keys as the pages. A test asserts every nav item's permission equals its page guard.

### 9.6 API route handlers (`/api`)

| Route | Method | Purpose | Auth / limits |
|---|---|---|---|
| `/api/auth/[...all]` | * | Better Auth endpoints | Plugin rate limits plus §7.4 |
| `/api/feed` | GET | `?tab=following|discover|nearby&cursor&limit&geohash5` | session (discover public) |
| `/api/posts/[id]/comments` | GET | cursor list (top-level; `?parent=` for replies) | visibility of post |
| `/api/notifications` | GET | cursor list, `?unread=1` | session |
| `/api/conversations` | GET | inbox cursor list | session |
| `/api/conversations/[id]/messages` | GET | cursor list (older) | participant |
| `/api/search` , `/api/search/suggest` | GET | results; typeahead (max 8) | `search.query` |
| `/api/uploads/sign` | POST | Create `media_assets` row (`pending`) and presigned PUT (§10.1) | session, `upload.sign` |
| `/api/uploads/complete` | POST | Verify and enqueue processing | session |
| `/api/media/[id]/[variant]` | GET | Authorise and 302 to a signed URL (restricted media) | per media rules |
| `/api/realtime/stream` | GET | SSE | session, max 5 streams/user |
| `/api/push/subscribe`, `/api/push/unsubscribe` | POST | Store/remove push subscription | session |
| `/api/promotions/event` | POST | Impression/click beacon with serve token | `promo.event` |
| `/api/webhooks/razorpay` | POST | Payment/subscription/refund events | HMAC signature |
| `/api/exports/[id]/download` | GET | Authorise and redirect to a signed URL | owner, not expired |
| `/api/health` | GET | `{status}` for liveness (no secrets); `?deep=1` requires `system.health` | public (shallow) |

All state-changing member operations other than these are Server Actions.

## 10. Domain flows and invariants

### 10.1 Media upload pipeline (`media`)
Inputs for `POST /api/uploads/sign`: `purpose` (enum: avatar, cover, post, listing, trip, message, document, verification, company_logo, company_cover), `filename` (1–200), `mime` (must be in the purpose's allow-list), `size` (int, 1 ≤ size ≤ max for the kind from settings; defaults: image 10 MB, video 100 MB, document 20 MB). Failure → `VALIDATION`.
1. `sign` inserts `media_assets(status='pending', storage_key='quarantine/<yyyy>/<mm>/<id>')` in the **private** bucket and returns a presigned PUT URL (expires 10 min, `Content-Type` and `Content-Length` bound in the signature). Nothing public is created.
2. The browser uploads straight to storage. `complete` is called with the asset id: the server checks ownership and `HeadObject` (size equals the declared size), then fetches the first 4,100 bytes and runs `file-type`. **The detected MIME must be in the allow-list and equal the declared MIME family.** On mismatch it deletes the object, sets `status='rejected'`, writes `security_events('upload_rejected')` and returns `VALIDATION`.
3. A valid asset becomes `status='processing'` and a `media.process` job is queued. Images: sharp decode (limits: 40 MP, `limitInputPixels`), auto-orient, strip EXIF/GPS, output WebP variants (`thumb` 320, `md` 800, `lg` 1600 wide) plus an original-format `orig` for documents and videos. The worker computes `width/height/blurhash/sha256`. Videos: stored as-is (mp4/webm only; h264/vp9 not verified beyond container). PDF/DOCX/XLSX documents: stored as-is and always served with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.
4. Processed objects go to the public bucket under `m/<id>/<variant>.webp` if `visibility='public'`, else to the private bucket. The asset becomes `ready`. A processing failure leaves it `failed` (retry 3×, then the owner sees “upload failed”). Orphans: assets still `pending` after 24 h or never attached after 48 h are purged by `media.gc`.
5. Visibility is derived at attach time. Avatars, covers, logos, public posts, active public listings and public trips → `public`. Everything else (connections-only posts, messages, documents, verification files, exports) → `restricted`. When a parent’s visibility changes, or it is hidden/removed, the `media.reconcile` job moves objects between buckets. Restricted objects are served by `/api/media/[id]/[variant]`, which re-authorises on each request and 302s to a signed URL (expiry 5 min).
6. SVG is never accepted. Animated GIFs are accepted as images and flattened to the first frame in the variants (original not served).

### 10.2 Feed (`content`)
- **Following tab:** candidates are posts where `(author_id = viewer OR author_id IN follows/connections OR company_id IN followed companies OR shop_id IN followed shops OR group_id IN joined groups)` AND `status='published'` AND `deleted_at IS NULL` AND visibility passes (`public`, or `connections` and the author is a connection, or `group` and the viewer is a member, or own) AND neither side has blocked the other. Order `id DESC`, keyset cursor. This is fan-out-on-read, supported by `ix_posts_author_id_id` and `ix_posts_group_id_id`. If the viewer follows more than 2,000 entities, the query falls back to the 2,000 most recently followed. (A fan-out-on-write path is explicitly not built.)
- **Discover tab:** `visibility='public'` and published, optional `category_id`, `id DESC`, via `ix_posts_public_id`.
- **Nearby tab:** public posts whose `geohash5` is in the viewer’s cell plus its 8 neighbours (default) or `geohash4` prefix (“wider area” toggle). The viewer’s cell comes from the client (§10.12), only as a geohash.
- **Promoted slot:** after assembling a page, the server asks `promotions.select({viewer, placement:'feed_inline', geohash4})` for at most one eligible campaign per 5 organic items. It inserts the item, labelled “Promoted”, with a signed serve token. See §10.10.
- The response contains viewer-specific flags (`reacted`, `bookmarked`) computed with a single batched query (`WHERE post_id = ANY($ids) AND user_id = $viewer`). It never does N+1 queries.

### 10.3 Posts, reactions, comments
- Post body: required unless the post has media, a trip, or a shared post; max 3,000 chars. Max 10 media items (images/videos mixed up to 10, documents up to 3). Hashtags are not first-class. Editing sets `edited_at`.
- Reactions: `INSERT … ON CONFLICT (post_id,user_id) DO UPDATE SET type` and the counter is adjusted only if the insert created a row (`xmax=0`), all in one transaction. Removing a reaction deletes the row and decrements. Counter columns are denormalised caches. The `counts.reconcile` job recomputes them nightly and logs drift.
- Comments: depth ≤ 1 (a reply’s parent must have `parent_id IS NULL`, enforced by service and by the trigger-free check: `parent_id` references `comments(id)` and a `CHECK (id <> parent_id)`. The depth rule is a service invariant tested by integration test). Max 2,000 chars. A comment with replies that is deleted becomes a tombstone (body hidden, row kept) while a childless one is soft-deleted normally.
- Blocked users cannot react to or comment on each other’s posts.
- Shares: `repost` creates a new post with `shared_post_id` (visibility ≤ the original’s, so it cannot widen it), `message` creates a message with a post card, and `external` only records the copy-link event. All three insert into `post_shares`. A repost of a non-public post is refused.

### 10.4 Graph
- Connection requests: unique per unordered pair. `INSERT … ON CONFLICT DO NOTHING`. Reverse pending request (B → A exists when A requests B) auto-accepts. A declined request can be re-sent after 30 days (checked in service). Accepting sets `status='accepted'` and `responded_at`. Both users get a follow edge implicitly via the connection (not duplicated).
- Follow: users, companies and shops. Counters (`follower_count`) are denormalised on the target’s profile/company/shop row.
- Block (`user_blocks`): in one transaction, delete follows and connections both ways, cancel pending requests, and hide the pair’s conversation from the inbox (the conversation row stays). All queries use `excludeBlocked(viewerId)` (`NOT EXISTS (select 1 from user_blocks …)` in both directions).
- Suggestions: people = mutual connections ≥ 1 or same `geohash4` or same company, excluding existing edges/blocks, ordered by mutual count then `id DESC`, limit 10. Businesses = same location cell or category.

### 10.5 Marketplace lifecycle (`marketplace`)
State machine for `listing_status` (allowed transitions; anything else → `CONFLICT`). Moderator hide/remove is **not** a status. It is `moderation_state` (`under_review`/`removed`), which hides the listing from every public query regardless of status and is reversed by a restore action:
```
draft → pending_review | active*      (*directly active if setting moderation.require_listing_review=false)
pending_review → active | rejected      (admin/moderator)
rejected → draft
active → sold | archived | expired | pending_review (after material edit when review required)
sold → active (relist) | archived
expired → active (renew) | archived
archived → draft | active*
```
- Each transition runs in a transaction that `SELECT … FOR UPDATE`s the listing, validates the transition, updates `status`, sets `published_at`/`expires_at` (default +60 days, setting `listings.default_expiry_days`), inserts `listing_status_history(from,to,actor,reason)`, and emits a notification to the owner for admin-driven transitions.
- Creation validation: title 3–120; description 0–5,000; `price_minor` ≥ 0 and ≤ 10^12, required unless `price_type` in (`free`, `contact`); `currency` in the allowed set (default INR); media 0–10 images, at least 1 required for `active`; category must be active and of the matching kind; max active listings per member from entitlements (free default 10, Pro default higher).
- Listing owner may be the member (`seller_id`) *or* a shop/company they manage; `seller_id` always stores the acting member. Business ownership is `shop_id`/`company_id`.
- Slug = `slugify(title)` + `-` + 6-char base36 suffix, unique among non-deleted rows.
- The `listing.expire` job runs hourly: `active` with `expires_at < now()` → `expired` + history row `actor=null`.

### 10.6 Enquiries and conversation reuse (`marketplace` → `messaging`)
Action `marketplace.enquire({ listingType: 'product'|'service'|'trip', listingId, message })`; `message` is required, 1–2,000 chars.
1. Authorize: viewer ≠ owner; listing visible/active to the viewer; neither side has blocked the other; the owner’s `message_policy` allows the viewer (`everyone`, or `connections` and connected).
2. In one transaction:
   - Build `context_key = '<type>:<listingId>'` and `pair_key = least(a,b) || ':' || greatest(a,b)`.
   - `INSERT INTO conversations (kind, context_key, pair_key, context_type, context_id, context_title, context_image_media_id, …) VALUES (…) ON CONFLICT (context_key, pair_key) WHERE kind='direct' DO NOTHING RETURNING id`. If no row is returned, `SELECT` the existing one. The unique index makes this race-free; two concurrent requests converge on one row (AC-18).
   - Insert both `conversation_participants` rows (`ON CONFLICT DO NOTHING`).
   - Insert the message (idempotent through `client_msg_id`).
   - `INSERT INTO listing_enquiries (…) ON CONFLICT (listing_type, listing_id, enquirer_id) DO UPDATE SET last_enquired_at = now(), conversation_id = listing_enquiries.conversation_id RETURNING (xmax = 0) AS inserted`. If `inserted`, increment the listing’s `enquiry_count`.
   - Update `conversations.last_message_id/last_message_at` and both participants’ `last_activity_at`.
3. After commit, publish `message.created` to Redis for both users and create an `enquiry_received` notification for the owner (aggregated).
The title and image are **snapshotted** on the conversation (`context_title`, `context_image_media_id`) and the enquiry (`listing_title_snapshot`, `listing_image_media_id`, `listing_price_snapshot`). The media asset is kept alive while referenced (purge skips assets referenced by a conversation). The listing card in the thread links to the listing if it is still visible, and otherwise shows “Listing no longer available”.
A plain DM uses `context_key='direct'`. A DM between the same two users is reused the same way. An enquiry about listing X by the same pair always reuses the X conversation, and a different listing creates a new one.
Enquiries on promoted items also insert a `promotion_events('enquiry')` row when the click token is present in the session.

### 10.7 Trips (`trips`)
- Create: title 3–120, summary ≤ 280, description ≤ 10,000, `start_date ≤ end_date`, dates within ±5 years, `max_participants` null or 2–200, tags ≤ 10 (each ≤ 30 chars), budget `min ≤ max`.
- Status: `draft → planned` (published). `planned → ongoing → completed` is set by the `trip.status` job (every 15 min), comparing dates against `now() at time zone trips.timezone` (IANA text, default `Asia/Kolkata`). `cancelled` is by the owner. `completed` trips remain as travel experiences and accept media and a post-trip summary.
- Itinerary items: ordered by `(day_number, position)`. Max 60 days, 20 items per day. `day_number` must be within the trip length. Reordering is one action that rewrites positions in a transaction (positions are deferred-unique, so use `DEFERRABLE INITIALLY DEFERRED` on the unique constraint).
- Join: `requestJoin` inserts `trip_participants(status='requested')`. The owner `respond(accepted|declined)`. The accept transaction does `SELECT … FROM trips WHERE id = $1 FOR UPDATE`, counts accepted participants, rejects with `CONFLICT` when full, then sets `accepted`. The owner counts as a participant, so the cap includes them (AC-20). Participants can leave. A removed participant cannot re-request for 30 days.
- Visibility: `public`, `connections`, `private`. Participants-only itinerary details (`itinerary_visibility = 'participants'`) hide place details from non-participants. The trip card, summary and destination remain visible.
- Trip enquiry (ask the organiser) uses §10.6 with `listing_type='trip'`.

### 10.8 Messaging and realtime (`messaging`)
- Send: validate body 1–4,000 chars (or attachments only, max 10), `clientMsgId` UUID required. Insert with `ON CONFLICT (conversation_id, sender_id, client_msg_id) DO NOTHING RETURNING` (duplicate → return the existing message). Update `last_message_*` and the recipient’s unread state, all in the same transaction. After commit, `PUBLISH user:<recipientId> {type:'message.created', conversationId, messageId}`.
- Read: `markRead(conversationId, upToMessageId)` sets `last_read_message_id/at` (monotonic: never moves backwards). Unread count = count of messages with `id > last_read_message_id` and `sender_id <> me`, bounded at 99+.
- Authorization: only participants can read or send. Blocked → send returns `FORBIDDEN`. `message_policy` is evaluated at conversation creation, and a muted/archived conversation does not suppress delivery (only push).
- SSE stream (`/api/realtime/stream`): `runtime='nodejs'`, `dynamic='force-dynamic'`. On connect, it authenticates by cookie, subscribes to `user:<id>`, and sends `retry: 3000` plus a heartbeat comment every 25 s. Events are tiny pointers (ids and counts), never message bodies. The client fetches content through the cursor APIs, so authorization is re-applied. Reconnect makes the client refetch the inbox and badge counts. The server caps 5 concurrent streams per user and closes streams when the session is revoked (a revoke publishes `session.revoked`). Response headers: `Cache-Control: no-store`, `X-Accel-Buffering: no`.

### 10.9 Moderation (`moderation`)
- `report.create({ targetType, targetId, reason, details? })`: reason is an enum, details ≤ 1,000. The target must be visible to the reporter. A snapshot (title/body excerpt/author, 500 chars) is stored. Unique open report per (reporter, target) → a duplicate returns `CONFLICT`. Reporting your own content is refused.
- A `ModerationTarget` adapter per target type (`post, comment, product, service, trip, group, company, shop, user, message`) provides `snapshot()`, `ownerId()`, `hide()`, `restore()`, `remove()`. The moderation module never touches other modules’ tables.
- Auto-hide: when distinct reporters with `status='open'` on one target ≥ `moderation.auto_hide_threshold` (default 3), the adapter’s `hide()` sets the content to `under_review` (excluded from feeds/search, visible to the owner with a notice) and the reports move to `in_review`. Messages are never auto-hidden.
- Decision (`reports.resolve`): `actioned` (with `remove` / `hide` / `warn` / `suspend_user`) or `dismissed` (restores `under_review` content). Both write audit rows and notify the reporter (generic outcome) and the owner (reason key).
- AI triage (optional): if `ai_assist` is on and configured, opening a report calls `ai.classifyReport(snapshot)` and shows a *suggested* category and a one-line rationale labelled “AI suggestion”. A failure is silent (`warn` log). The suggestion never triggers action.

### 10.10 Promotions (`promotions`)
- Eligibility: only the owner (or a manager of the owning company/shop) can promote their own `active`/public target. Targets that are hidden/removed are refused. Prohibited-content check = same moderation state.
- Campaign create (`promotions.create`): `targetType`, `targetId`, `objective` (reach|clicks|enquiries), `startAt` ≥ now + 15 min, `days` 1–30, `targeting` (`geohash4[]` ≤ 20, `languages[]` ⊂ enabled, `categoryIds[]` ≤ 10 — all optional), optional `advertisementId` (custom creative) otherwise an auto-card from the target. Price = `days × promotions.price_per_day_minor` (setting), currency from settings. Status `draft`.
- Pay: `promotions.checkout` creates a Razorpay order (server-side) and a `payments(status='pending')` row. The campaign moves to `pending_payment`. On verified webhook `payment.captured`, the campaign → `pending_review` (if `promotions.require_review`) or `scheduled`. A review rejection triggers a refund request (full amount). Without payments configured, the checkout action returns `CONFIGURATION_REQUIRED`. Admin “house credit” can activate a campaign without payment (`payments` row absent, `campaign.funded_by='house'`, requires `promotions.manage` plus audit).
- Lifecycle job (`promotion.lifecycle`, every 5 min): `scheduled → active` when `start_at ≤ now`, `active → completed` when `end_at ≤ now` or `impression_cap` reached. Paused/rejected/canceled never serve.
- Serving: `select()` returns active campaigns whose targeting matches, excluding the viewer’s own, blocked owners, and any shown to this viewer in the last hour (Redis set). Order = least delivered relative to the elapsed time (pacing), tie-break `id`. The result includes `serveToken = HMAC(APP_SECRET, campaignId|placement|viewerHash|issuedAt)` (TTL 30 min).
- Events: `POST /api/promotions/event { token, type: 'impression'|'click' }`. The server verifies the HMAC and TTL, dedupes impressions per (campaign, viewerHash) per hour in Redis, requires an `impression` before a `click` for the same token, and inserts the row. `viewer_hash = HMAC(APP_SECRET, userId or ip|daystamp)`, so no raw IP or stable cross-day identifier is stored. Enquiries are attributed from §10.6. Analytics queries aggregate real rows (AC-26).

### 10.11 Billing (`billing`)
- `PaymentProvider` interface: `createOrder`, `createSubscription`, `cancelSubscription`, `refund`, `verifyWebhook(rawBody, signature)`, `parseEvent`. Only `RazorpayProvider` is implemented. The module is never imported when env is missing; a `NullProvider` returns `CONFIGURATION_REQUIRED`.
- Webhook handler: read the **raw** body, verify `X-Razorpay-Signature` (HMAC-SHA256 with `RAZORPAY_WEBHOOK_SECRET`, `timingSafeEqual`). Invalid → 400 and a `billing_events` row `signature_valid=false` (payload truncated to 64 KB, no processing). Valid → `INSERT … ON CONFLICT (provider, provider_event_id) DO NOTHING`. If the row existed and `processed_at` is set → 200 (already processed). Otherwise process in a transaction (update payments/subscriptions/refunds, set `processed_at`). Processing errors set `processing_error`, return 500 so the provider retries, and are replayable from admin.
- Entitlements: `getEntitlements(userId)` merges plan `features` of the active subscription(s) (status `active|trialing|past_due` inside the period or grace) over free defaults from settings. Gates read these (listing limits, promotion discount, Pro badge).
- Refunds: `refunds.request` (finance) creates a `refunds` row `pending` + approval if required. On approval it calls the provider. `refunds.status` becomes `succeeded` only from the provider webhook (`refund.processed`), never optimistically.
- Invoices: `payments.invoice_number` is allocated from a Postgres sequence `invoice_seq` (format `NRG-YYYY-000001`) at success. A printable invoice page is rendered from stored data. GST/tax fields are stored (`tax_minor`) but tax computation rules are configuration of the plan price (inclusive), because legal tax logic is out of scope.

### 10.12 Location (`location`)
- The only accepted location input is a **geohash string** (`^[0-9b-hjkmnp-z]{4,5}$`). The browser calls `navigator.geolocation.getCurrentPosition` (only on a user gesture, after an in-app explainer), computes the 5-char geohash locally with a bundled 40-line encoder, discards the coordinates and sends the hash. The server cannot receive precise coordinates, because no endpoint accepts them, and request-body logging is disabled for these routes. (AC-22)
- A 5-char geohash cell is about 4.9 × 4.9 km. `neighbors(geohash5)` returns 9 cells. “Wider area” uses `geohash4` (about 39 × 20 km) with its neighbours.
- Displayed distance: cell-centre to cell-centre distance, rounded up to the next 5 km bucket (“within 5 km”, “within 10 km” …). Capped at “50+ km”. Never numeric with finer granularity.
- Members opt in: `location_sharing` ∈ `off` (default: no cell stored or used) | `city` (only city text shown) | `area` (cell used for discovery; the cell is never shown, only the bucketed distance). Listings, trips and companies show their own city text and may carry a cell for filtering. This is set by their owner.
- The cell is sent per request (query param or body) for the Nearby tab and is not stored unless the user saves it to their profile.

### 10.13 Notifications (`notifications`)
- `notify({ userId, type, actorId?, entityType?, entityId?, data, dedupeKey? })`. Skips when the recipient has blocked the actor, or the type+channel is disabled in preferences (security alerts and legal notices cannot be disabled).
- Aggregation: if `dedupeKey` matches an unread row, update it in place (increment `data.count`, keep the 3 latest actor ids, bump `updated_at`) instead of inserting.
- Channels: **in-app** (row + SSE pointer), **email** (queued; only for types flagged `email: true` such as connection request, enquiry, trip join, listing decision, payment, security, broadcast; immediate, no digest), **push** (only for message, enquiry, connection request, trip, security, broadcast; payload carries a generic localized title and a URL, never message text). A `410 Gone` from the push service deletes the subscription.
- Email/push rendering uses the recipient’s `users.locale`.

### 10.14 Search (`search`)
`search.query({ q, type?, cursor })`. `q` is 1–100 chars after trim, with a minimum of 2 characters. Result types and sources: people (`user_profiles.search_tsv` / name prefix, honouring visibility and `discoverable`), companies, shops, products, services, trips, groups, posts (public only). Without `type` the response returns the top 5 per type (no cursor). With `type` it is a keyset list ordered by `(rank, id)`. Signed-out users search public content only. Blocked and hidden content are excluded. Recent searches: `recordSearch` upserts `(user_id, scope, lower(query))` bumping `created_at` and trims to the newest 20 in the same transaction. Never recorded for anonymous users or when the member disabled history.

### 10.15 Privacy: export and deletion (`privacy`)
- **Export:** `privacy.requestExport` (limit: 1 per 24 h, `CONFLICT` if one is running). A `export.build` job calls every registered `PersonalDataProvider.export(userId)`, streams JSON files and media into a ZIP to the private bucket (`exports/<id>.zip`), sets `ready`, `expires_at = +7 days` and emails a link to `/api/exports/[id]/download` (owner-only; signed URL 5 min; re-authentication required if the session is older than 1 hour). Expiry purge deletes the object.
- **Deletion:** `privacy.requestDeletion` requires password or OTP re-auth. It sets `users.status='pending_deletion'`, creates `deletion_requests(scheduled_for = now + privacy.deletion_grace_days)`, revokes all sessions except the current one, and emails confirmation. The user may cancel on sign-in during the grace period. The `deletion.process` job calls each provider’s `erase(userId, tx)`, anonymises the user (§5.2.7), deletes S3 objects, and sets the request `completed`. Users with an owned company/shop with other members must transfer ownership first (else `CONFLICT`). Sole-owner businesses are soft-deleted. Active subscriptions are cancelled with the provider before processing. Payment records are retained.


## 11. PostgreSQL schema (Drizzle, `src/db/schema/*.ts`)

All 69 tables from the entity list are used. Two are added and justified: `media_assets` (the four media-join tables need one shared record for the upload pipeline, status and storage keys; without it each join table would duplicate those columns) and `two_factor` (required by the Better Auth TOTP plugin). No other tables exist. Notation: `[std]` and `[sd]` as in §5.1. FKs are `RESTRICT` unless marked `(c)` = `ON DELETE CASCADE` or `(n)` = `SET NULL`. `✱` = NOT NULL is the default. Nullable columns say `null`. `UQ` = unique index, `IX` = index, `CK` = check constraint. `desc` indexes on `id` support the §5.3 cursor.

### 11.1 Enums (pgEnum)
`user_status`(active, suspended, banned, pending_deletion, deleted) · `profile_visibility`(public, connections, private) · `message_policy`(everyone, connections, nobody) · `location_sharing`(off, city, area) · `connection_status`(pending, accepted, declined, withdrawn) · `override_effect`(allow, deny) · `post_visibility`(public, connections, group, private) · `moderation_state`(visible, under_review, removed) · `reaction_type`(like, celebrate, support, insightful) · `share_kind`(repost, message, external) · `report_reason`(spam, harassment, hate, violence, sexual, scam, misinformation, ip_violation, other) · `report_status`(open, in_review, actioned, dismissed) · `target_type`(post, comment, product, service, trip, group, company, shop, user, message) · `verification_status`(none, pending, verified, rejected) · `biz_role`(owner, admin, editor) · `listing_status`(draft, pending_review, active, rejected, sold, expired, archived) · `listing_type`(product, service, trip) · `product_condition`(new, like_new, used, refurbished) · `price_type`(fixed, negotiable, free, contact) · `service_pricing`(fixed, hourly, starting_at, quote) · `service_mode`(on_site, remote, both) · `enquiry_status`(open, replied, closed, spam) · `vr_status`(pending, approved, rejected, needs_info) · `trip_status`(draft, planned, ongoing, completed, cancelled) · `trip_type`(leisure, adventure, business, pilgrimage, road_trip, cultural, other) · `trip_visibility`(public, connections, private) · `itinerary_kind`(transport, stay, activity, food, other) · `participant_status`(requested, accepted, declined, removed, left) · `group_privacy`(public, private) · `group_role`(owner, moderator, member) · `group_member_status`(active, pending, banned) · `media_purpose`(avatar, cover, post, listing, trip, message, document, verification, company_logo, company_cover) · `media_kind`(image, video, document) · `media_status`(pending, processing, ready, rejected, failed) · `media_visibility`(public, restricted) · `message_kind`(text, attachment, system, post_share) · `notif_channel`(in_app, email, push) · `ad_placement`(feed_inline, sidebar, marketplace_top, search_top) · `ad_status`(draft, pending_review, approved, rejected, archived) · `campaign_status`(draft, pending_payment, pending_review, scheduled, active, paused, completed, rejected, canceled) · `promo_target`(post, product, service, shop, company, trip) · `promo_objective`(reach, clicks, enquiries) · `promo_event`(impression, click, enquiry) · `plan_audience`(user, business) · `plan_interval`(month, year) · `sub_status`(incomplete, trialing, active, past_due, canceled, expired) · `payment_purpose`(subscription, promotion) · `payment_status`(pending, succeeded, failed, refunded, partially_refunded) · `refund_status`(pending_approval, pending, succeeded, failed, rejected) · `approval_status`(pending, approved, rejected, expired, executed, failed) · `job_status`(queued, processing, ready, failed, expired) · `deletion_status`(pending, canceled, processing, completed, blocked) · `search_scope`(all, people, companies, shops, products, services, trips, groups, posts) · `log_level`(debug, info, warn, error, fatal) · `severity`(info, warning, critical) · `cms_status`(draft, published, archived) · `cms_kind`(legal, help, about, landing, custom).

Custom Drizzle types: `tsvector` (generated columns), `inet`. Helper `idPk()` returns `uuid('id').primaryKey().$defaultFn(() => uuidv7())`.

### 11.2 Identity and auth

**users** `[std]` + `deleted_at`
- `email text null` (lower-cased), `email_verified bool` default false, `phone_number text null` (E.164, `CK ~ '^\+[1-9][0-9]{7,14}$'`), `phone_number_verified bool` default false.
- `name text` (1–80), `username text` (`CK ~ '^[a-z0-9_.]{3,30}$'`), `image text null` (unused; Better Auth requires it; avatar lives in `user_profiles`).
- `status user_status` default active, `status_reason text null` (≤300), `suspended_until timestamptz null`, `locale text` default 'en' → languages(code), `theme text` default 'system' `CK in (light,dark,system)`, `two_factor_enabled bool` default false, `last_login_at timestamptz null`, `anonymized_at timestamptz null`.
- `CK (email IS NOT NULL OR phone_number IS NOT NULL OR status='deleted')`.
- `UQ ux_users_email_lower (lower(email)) WHERE email IS NOT NULL`, `UQ ux_users_phone (phone_number) WHERE NOT NULL`, `UQ ux_users_username_lower (lower(username))`.
- `IX (status, id desc)`, `IX (lower(name) text_pattern_ops)`, `IX (lower(username) text_pattern_ops)`.

**user_profiles** `[std-no-id]`: `user_id uuid PK → users (c)`
- `headline text null` (≤120), `bio text null` (≤500), `about text null` (≤5000), `avatar_media_id → media_assets (n)`, `cover_media_id → media_assets (n)`, `website text null` (https URL ≤200).
- `city, region text null`, `country_code char(2) null`, `geohash5 char(5) null` (+ generated `geohash4`, `CK` per §5.5), `location_sharing` default off.
- `profile_visibility` default public, `message_policy` default everyone, `discoverable bool` default true, `discoverable_by_phone bool` default false.
- `experience jsonb` default '[]' (`CK jsonb_typeof='array'`; Zod: ≤20 items {title, org, start, end, description≤500}), `education jsonb` default '[]' (≤10), `skills text[]` default '{}' (≤50 items, each ≤40), `interest_category_ids uuid[]` default '{}' (≤10).
- `connection_count, follower_count, following_count int` default 0 (`CK ≥ 0`), `onboarding_completed_at timestamptz null`, `search_tsv` generated from `headline || bio || array_to_string(skills,' ')`.
- `IX gin(search_tsv)`, `IX (geohash5, user_id) WHERE location_sharing='area'`.

**auth_accounts** (Better Auth `account`): `id`, `user_id → users (c)`, `account_id text` (provider's id), `provider_id text` (credential, google, facebook, phone), `access_token, refresh_token, id_token, scope text null`, `access_token_expires_at, refresh_token_expires_at null`, `password text null` (scrypt hash, credential only), `created_at, updated_at`. OAuth tokens are cleared right after sign-in by a `databaseHooks.account` hook because the app never calls provider APIs. `UQ (provider_id, account_id)`, `IX (user_id)`.

**sessions** (Better Auth `session`): `id`, `user_id → users (c)`, `token text UQ`, `expires_at ✱`, `ip_address text null`, `user_agent text null` (≤300), `device_label text null`, `step_up_at timestamptz null` (additional field), `created_at, updated_at`. `IX (user_id, expires_at)`, `IX (expires_at)`. Expired sessions are purged hourly.

**verification_tokens** (Better Auth `verification`): `id`, `identifier text`, `value text`, `expires_at ✱`, `created_at, updated_at`. `IX (identifier)`, `IX (expires_at)`. Purged hourly.

**two_factor** (added): `id`, `user_id → users (c) UQ`, `secret text` (encrypted by the plugin), `backup_codes text` (encrypted), `created_at, updated_at`.

**user_blocks**: `blocker_id → users (c)`, `blocked_id → users (c)`, `created_at`. PK `(blocker_id, blocked_id)`. `CK blocker_id <> blocked_id`. `IX (blocked_id)`.

### 11.3 Graph

**user_connections** `[std]`: `requester_id → users (c)`, `addressee_id → users (c)`, `status` default pending, `message text null` (≤300), `responded_at null`. `CK requester_id <> addressee_id`. `UQ ux_user_connections_pair (least(requester_id,addressee_id), greatest(requester_id,addressee_id))`. `IX (addressee_id, status, id desc)`, `IX (requester_id, status, id desc)`, `IX (requester_id) WHERE status='accepted'`, `IX (addressee_id) WHERE status='accepted'`.

**user_follows**: `id`, `follower_id → users (c)`, `followee_user_id → users (c) null`, `followee_company_id → companies (c) null`, `followee_shop_id → shops (c) null`, `created_at`. `CK num_nonnulls(followee_user_id, followee_company_id, followee_shop_id) = 1`, `CK follower_id <> followee_user_id`. Three partial `UQ (follower_id, followee_*_id) WHERE followee_*_id IS NOT NULL`. `IX (followee_user_id, id desc)` (+ company, shop variants, partial NOT NULL), `IX (follower_id, id desc)`.

### 11.4 RBAC

**roles** `[std]`: `key text UQ` (`CK ~ '^[a-z][a-z0-9_]{1,40}$'`), `name`, `description null`, `is_system bool`. · **permissions**: `id`, `key text UQ`, `group_key text`, `description`, `is_sensitive bool`, `requires_approval bool`, `created_at`. · **role_permissions**: `role_id → roles (c)`, `permission_id → permissions (c)`, PK both, `IX (permission_id)`. · **user_roles**: `user_id → users (c)`, `role_id → roles (c)`, `granted_by → users (n)`, `granted_at`, `expires_at null`, PK `(user_id, role_id)`, `IX (role_id)`. · **user_permission_overrides**: `user_id → users (c)`, `permission_id → permissions (c)`, `effect`, `reason text` (✱ ≤300), `granted_by → users (n)`, `created_at`, `expires_at null`, PK `(user_id, permission_id)`.

### 11.5 Media

**media_assets** (added) `[std]`: `owner_id → users`, `purpose media_purpose`, `kind media_kind`, `status` default pending, `visibility` default restricted, `bucket text CK in (public,private)`, `storage_key text UQ`, `declared_mime text`, `mime text null` (detected), `size_bytes bigint CK >0`, `width, height int null`, `blurhash text null`, `sha256 char(64) null`, `variants jsonb` default '[]', `original_filename text` (≤200), `rejection_reason text null`, `attached_at timestamptz null`. `IX (owner_id, id desc)`, `IX (status, created_at)`, `IX (created_at) WHERE attached_at IS NULL`.

Attachment rule: every `attach()` call verifies `owner_id = actor` (or the actor manages the business that owns the target), `status='ready'`, and the purpose/kind fit, then sets `attached_at`. This prevents attaching another user's media by guessing an id.

### 11.6 Content

**content_categories** `[std]`: `kind text CK in (post, group, business)`, `slug`, `parent_id → self (n)`, `names jsonb` (`CK names ? 'en'`), `sort_order int`, `is_active bool`. `UQ (kind, slug)`.

**posts** `[sd]`
- `author_id → users`, `company_id → companies null`, `shop_id → shops null`, `group_id → groups null`, `trip_id → trips (n)`, `shared_post_id → posts (n)`, `body text null` (≤3000), `lang text null`.
- `visibility` default public, `category_id → content_categories (n)`, `city, region, country_code, geohash5` (as §5.5), `moderation_state` default visible, `like_count, comment_count, share_count, bookmark_count int` default 0, `edited_at null`, `search_tsv` generated from `body`.
- `CK (visibility='group') = (group_id IS NOT NULL)`, `CK num_nonnulls(company_id, shop_id) <= 1`, counters `≥ 0`.
- `IX (author_id, id desc) WHERE deleted_at IS NULL`, `IX (company_id, id desc)`, `IX (shop_id, id desc)`, `IX (group_id, id desc) WHERE group_id IS NOT NULL AND deleted_at IS NULL`, `IX ix_posts_public_id (id desc) WHERE visibility='public' AND moderation_state='visible' AND deleted_at IS NULL`, `IX (geohash5, id desc)` and `IX (geohash4, id desc)` (same predicate), `IX (category_id, id desc)` (same predicate), `IX (shared_post_id)`, `GIN (search_tsv)`.

**post_media**: `post_id → posts (c)`, `media_id → media_assets`, `position smallint`, `alt_text null` (≤200). PK `(post_id, media_id)`, `UQ (post_id, position) DEFERRABLE INITIALLY DEFERRED`, `IX (media_id)`.

**post_reactions**: `post_id → posts (c)`, `user_id → users (c)`, `type reaction_type`, `created_at`. PK `(post_id, user_id)`, `IX (post_id, type)`, `IX (user_id, created_at desc)`.

**comments** `[sd]`: `post_id → posts (c)`, `author_id → users`, `parent_id → comments (c) null`, `body text` (1–2000), `like_count, reply_count int` default 0, `moderation_state`, `edited_at null`. `CK id <> parent_id`. `IX (post_id, id desc) WHERE parent_id IS NULL`, `IX (parent_id, id asc) WHERE parent_id IS NOT NULL`, `IX (author_id, id desc)`.

**comment_reactions**: `comment_id → comments (c)`, `user_id → users (c)`, `created_at`, PK `(comment_id, user_id)`.

**post_bookmarks**: `id`, `user_id → users (c)`, `post_id → posts (c)`, `created_at`. `UQ (user_id, post_id)`, `IX (user_id, id desc)`.

**post_shares**: `id`, `post_id → posts (c)`, `user_id → users`, `kind share_kind`, `repost_post_id → posts (n)`, `message_id → messages (n)`, `created_at`. `IX (post_id, kind)`, `IX (user_id, id desc)`.

**content_reports**
- `id`, `reporter_id → users`, `target_type`, `target_id uuid` (no FK so the report survives purge), `target_owner_id → users (n)`, `reason`, `details null` (≤1000), `snapshot jsonb ✱`.
- `status` default open, `priority smallint` default 0, `assigned_to → users (n)`, `resolution text null CK in (removed, hidden, warned, user_suspended, no_action, dismissed)`, `resolution_note null` (≤1000), `resolved_by → users (n)`, `resolved_at null`, `ai_suggestion jsonb null`, `created_at, updated_at`.
- `UQ (reporter_id, target_type, target_id) WHERE status IN ('open','in_review')`, `IX (status, id desc)`, `IX (target_type, target_id, status)`, `IX (target_owner_id)`, `IX (assigned_to, status)`.

### 11.7 Business and marketplace

**companies** `[sd]`
- `slug` (`CK ~ '^[a-z0-9-]{3,60}$'`), `name` (2–100), `tagline null` (≤140), `about null` (≤5000), `industry_category_id → content_categories (n)`, `size_range text null CK in (1, 2-10, 11-50, 51-200, 201-1000, 1000+)`, `website, contact_email, contact_phone null`, `address_line null` (≤200, optional and owner-published), `city, region, country_code, geohash5`.
- `logo_media_id`, `cover_media_id → media_assets (n)`, `verification_status` default none, `verified_at null`, `created_by → users`, `moderation_state`, `follower_count, member_count int`, `search_tsv` (name, tagline, about).
- `UQ ux_companies_slug (lower(slug)) WHERE deleted_at IS NULL`, `IX (geohash5, id desc)`, `IX (industry_category_id, id desc)`, `IX (created_by)`, `GIN (search_tsv)`, `IX (lower(name) text_pattern_ops)`.

**company_members**: `company_id → companies (c)`, `user_id → users (c)`, `role biz_role`, `invited_by → users (n)`, `created_at, updated_at`. PK `(company_id, user_id)`, **`UQ (company_id) WHERE role='owner'`** (exactly one owner at most; transfer = one transaction swapping roles), `IX (user_id)`.

**shops** `[sd]`: same columns as companies except no `industry`, plus `company_id → companies (n)`, `description null` (≤5000), `policies null` (≤2000), `category_id → listing_categories (n)`. Same indexes. · **shop_members**: same shape and indexes as `company_members` against `shops`.

**listing_categories** `[std]`: `kind text CK in (product, service)`, `slug`, `parent_id → self (n)`, `names jsonb` (`CK names ? 'en'`), `icon text null`, `sort_order`, `is_active`. `UQ (kind, slug)`.

**products** `[sd]`
- `seller_id → users`, `shop_id → shops null`, `company_id → companies null` (`CK num_nonnulls(shop_id, company_id) <= 1`), `title` (3–120), `slug`, `description null` (≤5000), `category_id → listing_categories`, `condition`, `price_type`, `price_minor bigint null`, `currency char(3) null`, `quantity int null CK ≥ 0`.
- `CK (price_type IN ('free','contact') OR (price_minor IS NOT NULL AND price_minor >= 0 AND currency IS NOT NULL))`.
- `status listing_status` default draft, `moderation_state`, `published_at, expires_at, sold_at null`, `city, region, country_code, geohash5`, `view_count, enquiry_count int`, `search_tsv` (title, description).
- `UQ ux_products_slug (lower(slug)) WHERE deleted_at IS NULL`. Partial on `status='active' AND moderation_state='visible' AND deleted_at IS NULL`: `IX (id desc)`, `IX (category_id, id desc)`, `IX (geohash5, id desc)`, `IX (geohash4, id desc)`, `GIN (search_tsv)`. Plus `IX (seller_id, id desc)`, `IX (shop_id, id desc)`, `IX (company_id, id desc)`, `IX (expires_at) WHERE status='active'`, `IX (status, id desc)` (admin queue).

**services** `[sd]`: as products but `provider_id → users` (in place of `seller_id`), no `condition`/`quantity`, `pricing_type service_pricing`, `mode service_mode`, `service_radius_km smallint null CK 0..500`, `availability_note null` (≤300). Same indexes.

**listing_media**: `id`, `product_id → products (c) null`, `service_id → services (c) null`, `media_id → media_assets`, `position smallint`, `alt_text null`. `CK num_nonnulls(product_id, service_id) = 1`. `IX (product_id, position)`, `IX (service_id, position)`, `IX (media_id)`. Reordering rewrites all positions in one transaction (no unique constraint on position, so no intermediate collisions).

**listing_status_history**: `id`, `listing_type text CK in (product, service)`, `listing_id uuid`, `from_status listing_status null`, `to_status`, `actor_id → users (n)`, `reason null` (≤500), `created_at`. `IX (listing_type, listing_id, id desc)`.

**listing_enquiries** `[std]`: `listing_type listing_type`, `listing_id uuid` (no FK, because the type is polymorphic and the snapshot must outlive the listing), `owner_id → users`, `enquirer_id → users`, `conversation_id → conversations UQ`, `listing_title_snapshot text`, `listing_price_snapshot jsonb null`, `listing_image_media_id → media_assets (n)`, `status enquiry_status` default open, `enquiry_count int` default 1, `first_enquired_at, last_enquired_at`, `promotion_campaign_id → promotion_campaigns (n)`. `CK owner_id <> enquirer_id`. **`UQ (listing_type, listing_id, enquirer_id)`**, `IX (owner_id, last_enquired_at desc, id desc)`, `IX (enquirer_id, id desc)`, `IX (listing_type, listing_id)`.

**business_verification_requests** `[std]`: `company_id → companies (c) null`, `shop_id → shops (c) null` (`CK num_nonnulls = 1`), `requested_by → users`, `legal_name` (≤200), `registration_number null` (≤60), `tax_id null` (≤40), `website null`, `document_media_ids uuid[]` (`CK cardinality BETWEEN 1 AND 5`; each id must be the requester's `restricted` document asset, verified in service), `status vr_status` default pending, `reviewed_by → users (n)`, `reviewed_at null`, `review_note null` (≤1000). `UQ (company_id) WHERE status='pending' AND company_id IS NOT NULL` (and shop), `IX (status, id desc)`.

### 11.8 Trips

**trips** `[sd]`
- `owner_id → users`, `slug`, `title` (3–120), `summary null` (≤280), `description null` (≤10000), `trip_type`, `status` default draft, `visibility trip_visibility` default public, `itinerary_visibility text CK in (public, participants)` default public, `moderation_state`.
- `origin_label, destination_label text null` (≤120), `country_code char(2) null`, `destination_geohash5 char(5) null`, `start_date date`, `end_date date`, `timezone text` default 'Asia/Kolkata', `budget_min_minor, budget_max_minor bigint null`, `currency char(3) null`.
- `max_participants smallint null CK BETWEEN 2 AND 200`, `participant_count smallint` default 1, `is_open_to_join bool`, `tags text[]` (≤10), `cover_media_id → media_assets (n)`, `view_count, enquiry_count int`, `search_tsv` (title, summary, description, destination_label).
- `CK end_date >= start_date`, `CK budget_min_minor <= budget_max_minor`, `CK participant_count <= COALESCE(max_participants, 32767)`.
- `UQ ux_trips_slug (lower(slug)) WHERE deleted_at IS NULL`; `IX (id desc) WHERE visibility='public' AND status IN ('planned','ongoing','completed') AND moderation_state='visible' AND deleted_at IS NULL`; `IX (owner_id, id desc)`; `IX (start_date) WHERE status='planned'`; `IX (destination_geohash5, id desc)` (same predicate as public); `GIN (tags)`; `GIN (search_tsv)`.

**trip_itinerary_items** `[std]`: `trip_id → trips (c)`, `day_number smallint CK 1..60`, `position smallint CK 0..19`, `kind itinerary_kind`, `title` (≤120), `description null` (≤1000), `place_label null` (≤120), `place_geohash5 null`, `start_time, end_time time null`. `UQ (trip_id, day_number, position) DEFERRABLE INITIALLY DEFERRED`.

**trip_media**: `id`, `trip_id → trips (c)`, `media_id → media_assets`, `itinerary_item_id → trip_itinerary_items (n)`, `position smallint`, `caption null` (≤200). `UQ (trip_id, media_id)`, `IX (trip_id, position)`.

**trip_participants** `[std-no-id]`: `trip_id → trips (c)`, `user_id → users (c)`, `status participant_status`, `message null` (≤300), `responded_at null`, `created_at, updated_at`. PK `(trip_id, user_id)`, `IX (user_id, status)`, `IX (trip_id, status)`. The owner has an `accepted` row from creation.

### 11.9 Messaging, notifications

**conversations** `[std]`
- `kind text CK = 'direct'`, `context_key text` (`'direct'` or `'<type>:<uuid>'`), `pair_key text` (`least(a,b)||':'||greatest(a,b)`), `context_type listing_type null`, `context_id uuid null`, `context_title text null` (≤120), `context_image_media_id → media_assets (n)`, `last_message_id → messages (n)` (circular FK, declared with `AnyPgColumn`), `last_message_at timestamptz null`, `created_by → users`.
- `CK (context_type IS NULL AND context_key = 'direct') OR (context_key = context_type::text || ':' || context_id::text)`.
- **`UQ ux_conversations_pair_context (context_key, pair_key) WHERE kind='direct'`** (this is the conversation-reuse constraint). `IX (last_message_at desc)`.

**conversation_participants**: `conversation_id → conversations (c)`, `user_id → users (c)`, `last_read_message_id → messages (n)`, `last_read_at null`, `muted_until null`, `archived_at null`, `last_activity_at timestamptz` default now(), `unread_count int` default 0, `left_at null`. PK `(conversation_id, user_id)`. `IX (user_id, last_activity_at desc, conversation_id) WHERE archived_at IS NULL`, `IX (user_id) WHERE unread_count > 0`.

**messages**: `id`, `conversation_id → conversations (c)`, `sender_id → users`, `kind message_kind`, `body text null` (≤4000), `reply_to_id → messages (n)`, `shared_post_id → posts (n)`, `client_msg_id uuid ✱`, `edited_at null`, `deleted_at null`, `created_at`. `CK (kind <> 'text' OR body IS NOT NULL OR deleted_at IS NOT NULL)`. `UQ (conversation_id, sender_id, client_msg_id)`, `IX (conversation_id, id desc)`.

**message_attachments**: `id`, `message_id → messages (c)`, `media_id → media_assets`, `position smallint`. `UQ (message_id, media_id)`, `IX (media_id)`.

**notifications**: `id`, `user_id → users (c)`, `type text`, `actor_id → users (n)`, `entity_type text null`, `entity_id uuid null`, `data jsonb` default '{}' (≤2 KB), `dedupe_key text null`, `seen_at null`, `read_at null`, `created_at, updated_at`. `UQ (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL AND read_at IS NULL`, `IX (user_id, id desc)`, `IX (user_id, id desc) WHERE read_at IS NULL`. Retention: 180 days.

**notification_preferences**: `user_id → users (c)`, `category text`, `channel notif_channel`, `enabled bool`, `updated_at`. PK `(user_id, category, channel)`. Categories (code catalogue): social, messages, marketplace, trips, groups, business, billing, system.

**push_subscriptions**: `id`, `user_id → users (c)`, `endpoint text UQ` (≤1000), `p256dh text`, `auth_secret text`, `user_agent null`, `created_at`, `last_used_at null`, `expires_at null`. `IX (user_id)`.

### 11.10 Groups

**groups** `[sd]`: `slug`, `name` (3–80), `description null` (≤2000), `rules null` (≤2000), `privacy` default public, `category_id → content_categories (n)`, `cover_media_id → media_assets (n)`, `created_by → users`, `require_approval bool`, `member_count, post_count int`, `moderation_state`, `search_tsv`. `UQ (lower(slug)) WHERE deleted_at IS NULL`, `IX (id desc) WHERE privacy='public' AND moderation_state='visible' AND deleted_at IS NULL`, `IX (category_id, id desc)`, `GIN (search_tsv)`.
**group_members**: `group_id → groups (c)`, `user_id → users (c)`, `role`, `status`, `created_at, updated_at`. PK `(group_id, user_id)`, `UQ (group_id) WHERE role='owner'`, `IX (user_id, status)`, `IX (group_id, status, role)`.

### 11.11 Promotions and monetization

**advertisements** `[std]`: `advertiser_id → users (n) null`, `company_id → companies (n)`, `is_house bool` (`CK is_house OR advertiser_id IS NOT NULL`), `placement`, `headline` (≤80), `body null` (≤200), `image_media_id → media_assets (n)`, `cta_label text CK in (learn_more, shop_now, contact, view_trip, sign_up)`, `target_type promo_target null`, `target_id uuid null`, `external_url text null` (https, ≤500), `CK (target_id IS NOT NULL) <> (external_url IS NOT NULL)`, `status ad_status` default draft, `reviewed_by → users (n)`, `reviewed_at null`, `review_note null`. `IX (advertiser_id, id desc)`, `IX (status, id desc)`, `IX (placement, status)`.

**promotion_campaigns** `[std]`: `owner_id → users`, `company_id → companies (n)`, `target_type promo_target`, `target_id uuid` (polymorphic, validated in service), `advertisement_id → advertisements (n)`, `objective`, `status` default draft, `funded_by text CK in (payment, house)`, `start_at, end_at timestamptz` (`CK end_at > start_at`), `days smallint CK 1..30`, `price_minor bigint CK >= 0`, `currency char(3)`, `impression_cap int null`, `impressions_count, clicks_count, enquiries_count int` default 0 (cached; recomputed from events by `counts.reconcile`), `targeting jsonb` default '{}', `reviewed_by → users (n)`, `reviewed_at null`, `review_note null`. `IX (status, start_at)`, `IX (status, end_at)`, `IX (owner_id, id desc)`, `IX (target_type, target_id)`, `IX (status, id desc)`.

**promotion_events**: `id bigint GENERATED ALWAYS AS IDENTITY`, `campaign_id → promotion_campaigns (c)`, `type promo_event`, `placement ad_placement null`, `viewer_hash text` (HMAC, rotates daily), `created_at`. `IX (campaign_id, type, created_at)`, `BRIN (created_at)`. Append-only by convention (no UPDATE grants). Retention 400 days.

**subscription_plans** `[std]`: `key text UQ`, `name jsonb`, `description jsonb`, `audience`, `interval`, `price_minor bigint CK >= 0`, `currency`, `provider text null` (razorpay), `provider_plan_id text null`, `features jsonb` (Zod `EntitlementsSchema`), `trial_days smallint` default 0, `is_active bool` default false, `sort_order`. `CK (NOT is_active OR price_minor = 0 OR provider_plan_id IS NOT NULL)`.

**subscriptions** `[std]`: `user_id → users`, `company_id → companies (n)`, `plan_id → subscription_plans`, `status`, `provider`, `provider_subscription_id text`, `current_period_start, current_period_end null`, `cancel_at_period_end bool`, `canceled_at null`, `trial_ends_at null`. `UQ (provider, provider_subscription_id)`, `UQ (user_id) WHERE company_id IS NULL AND status IN ('active','trialing','past_due')`, `UQ (company_id) WHERE company_id IS NOT NULL AND status IN (…same)`, `IX (user_id, status)`, `IX (status, current_period_end)`.

**payments** `[std]`: `user_id → users`, `purpose`, `subscription_id → subscriptions (n)`, `campaign_id → promotion_campaigns (n)` (`CK num_nonnulls(subscription_id, campaign_id) = 1`), `provider text`, `provider_order_id text`, `provider_payment_id text null`, `amount_minor bigint CK > 0`, `tax_minor bigint` default 0, `currency`, `status`, `failure_code null`, `failure_reason null` (≤200), `invoice_number text null UQ`, `paid_at null`, `refunded_minor bigint` default 0 (`CK refunded_minor <= amount_minor`). `UQ (provider, provider_order_id)`, `UQ (provider, provider_payment_id) WHERE NOT NULL`, `IX (user_id, id desc)`, `IX (status, id desc)`, `IX (created_at)`.

**refunds** `[std]`: `payment_id → payments`, `amount_minor bigint CK > 0`, `reason` (≤300), `status`, `requested_by → users`, `approval_id → admin_action_approvals (n)`, `provider_refund_id text null`, `processed_at null`, `failure_reason null`. `UQ (provider_refund_id) WHERE NOT NULL`, `IX (payment_id)`, `IX (status, id desc)`. Service invariant: sum of non-failed refunds ≤ payment amount (checked under `FOR UPDATE` on the payment row).

**billing_events**: `id`, `provider`, `provider_event_id text null`, `type text`, `signature_valid bool`, `payload jsonb` (≤64 KB), `received_at`, `processed_at null`, `processing_error text null`, `attempts smallint` default 0. **`UQ (provider, provider_event_id) WHERE signature_valid`**, `IX (received_at desc)`, `IX (id) WHERE processed_at IS NULL AND signature_valid`.

### 11.12 Configuration and content

**site_settings**: `key text PK`, `value jsonb ✱`, `version int` default 1, `updated_by → users (n)`, `created_at, updated_at`. Values are validated against the registry (§16.1) on write and on read (invalid stored values fall back to the default with a `warn` log). Secrets are never stored here.

**feature_flags**: `key text PK`, `enabled bool`, `rollout_percent smallint CK 0..100` default 100, `allow_user_ids uuid[]` (≤100), `description`, `updated_by → users (n)`, `created_at, updated_at`.

**languages**: `code text PK` (`CK ~ '^[a-z]{2,3}(-[A-Z]{2})?$'`), `name`, `native_name`, `direction text CK in (ltr, rtl)`, `is_enabled bool`, `is_default bool`, `fallback_code → languages (n)`, `sort_order`, `created_at, updated_at`. `UQ (is_default) WHERE is_default`. A trigger-free service invariant ensures the default language is always enabled.

**translation_keys** `[std]`: `namespace text`, `key text`, `description null`, `values jsonb` (locale → string overrides), `source text CK in (code, admin)`, `is_orphan bool`, `updated_by → users (n)`. `UQ (namespace, key)`, `IX (namespace)`.

**cms_pages** `[std]`: `slug text UQ` (`CK ~ '^[a-z0-9-]{1,80}$'`; reserved: admin, api, login, …), `kind cms_kind`, `status cms_status`, `title jsonb`, `body jsonb` (locale → markdown ≤ 100 KB), `seo_title jsonb`, `seo_description jsonb`, `og_media_id → media_assets (n)`, `noindex bool`, `show_in_footer bool`, `footer_order int`, `published_revision_id → cms_page_revisions (n)`, `published_at null`, `created_by`, `updated_by → users (n)`. `IX (status, kind)`.
**cms_page_revisions**: `id`, `page_id → cms_pages (c)`, `revision_no int`, `title, body, seo_title, seo_description jsonb`, `change_note null` (≤200), `created_by → users (n)`, `created_at`. `UQ (page_id, revision_no)`.

**redirects** `[std]`: `from_path text UQ` (starts with `/`, no query, ≤300, normalised without trailing slash), `to_path text` (`/…` or `https://…`, ≤500), `status_code smallint CK in (301,302,307,308)`, `is_active bool`, `hit_count bigint`, `last_hit_at null`, `note null`, `created_by → users (n)`. `CK from_path <> to_path`.

**recent_searches**: `id`, `user_id → users (c)`, `scope search_scope`, `query text` (1–100), `created_at` (bumped on repeat). `UQ (user_id, scope, lower(query))`, `IX (user_id, created_at desc)`.

### 11.13 Operations and security

**admin_audit_logs**: `id bigint identity`, `actor_id → users (n) null`, `actor_label text` (username snapshot), `action text` (e.g. `users.suspend`), `target_type text null`, `target_id text null`, `summary text`, `before jsonb null`, `after jsonb null` (both pass through `redact()`: keys matching `/pass|secret|token|totp|otp|key|hash/i` are replaced by `"[redacted]"`, strings >2 KB are truncated), `ip inet null`, `user_agent text null`, `request_id text null`, `approval_id uuid null`, `created_at`. `IX (created_at desc)`, `IX (actor_id, id desc)`, `IX (target_type, target_id, id desc)`, `IX (action, id desc)`.
**security_events**: `id bigint identity`, `user_id → users (n)`, `type text`, `severity`, `ip inet null`, `user_agent null`, `metadata jsonb`, `created_at`. `IX (created_at desc)`, `IX (user_id, id desc)`, `IX (type, id desc)`.
**Immutability** (both tables): migration adds `BEFORE UPDATE OR DELETE` triggers that `RAISE EXCEPTION` unless `current_setting('nargito.purge', true) = 'on'`; `REVOKE UPDATE, DELETE, TRUNCATE` from `nargito_app`. Retention (`privacy.audit_retention_days`, default 730; security events 365) is executed by `SECURITY DEFINER` function `purge_append_only(retention_days int)` owned by the migrator role; it sets `nargito.purge` locally and deletes. `nargito_app` only has `EXECUTE` on it. AC-29 is tested by attempting UPDATE and DELETE as `nargito_app`.

**system_logs**: `id bigint identity`, `level log_level`, `source text`, `message` (≤2000), `context jsonb`, `request_id null`, `created_at`. `IX (created_at desc)`, `IX (level, id desc)`. Only level ≥ warn is persisted (info goes to stdout). Retention 30 days.
**scheduled_jobs**: `key text PK`, `description`, `cron text`, `is_enabled bool`, `last_run_at null`, `last_status text null CK in (success, failed, running)`, `last_error null` (≤1000), `last_duration_ms int null`, `next_run_at null`, `run_count bigint`, `updated_by → users (n)`, `updated_at`.
**admin_action_approvals** `[std]`: `action_name text`, `payload jsonb`, `summary text`, `status` default pending, `requested_by → users`, `reviewed_by → users (n)`, `reviewed_at null`, `review_note null`, `expires_at`, `executed_at null`, `failure_reason null`. `CK reviewed_by IS NULL OR reviewed_by <> requested_by`. `IX (status, id desc)`, `IX (requested_by)`.
**data_export_jobs** `[std]`: `user_id → users (c)`, `status job_status`, `storage_key null`, `size_bytes bigint null`, `completed_at null`, `expires_at null`, `download_count int`, `error null`. `IX (user_id, id desc)`, `IX (status, expires_at)`.
**deletion_requests** `[std]`: `user_id → users`, `status deletion_status`, `scheduled_for timestamptz`, `canceled_at null`, `processed_at null`, `processed_by → users (n)`, `blocked_reason null`, `reason null` (≤500). `UQ (user_id) WHERE status IN ('pending','processing','blocked')`, `IX (status, scheduled_for)`.

### 11.14 Drizzle conventions (example)
```ts
export const posts = pgTable('posts', {
  id: idPk(),
  authorId: uuid('author_id').notNull().references(() => users.id),
  groupId: uuid('group_id').references(() => groups.id),
  body: text('body'),
  visibility: postVisibility('visibility').notNull().default('public'),
  searchTsv: tsvector('search_tsv').generatedAlwaysAs(sql`to_tsvector('simple', coalesce(body,''))`),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index('ix_posts_author_id_id').on(t.authorId, desc(t.id)).where(sql`${t.deletedAt} is null`),
  index('ix_posts_public_id').on(desc(t.id)).where(sql`${t.visibility} = 'public' and ${t.deletedAt} is null`),
  index('ix_posts_search').using('gin', t.searchTsv),
  check('ck_posts_group_vis', sql`(${t.visibility} = 'group') = (${t.groupId} is not null)`),
]);
```
Constructs Drizzle can't express (expression-based unique indexes such as `lower(email)`/`least()/greatest()`, deferrable constraints, triggers, `SECURITY DEFINER` function, sequence `invoice_seq`, `BRIN`) are written in hand-authored SQL migrations (`drizzle-kit generate --custom`) and kept next to the generated files. A schema-drift test (§20) runs `drizzle-kit generate` in CI and fails when it would produce a diff.

### 11.15 Migration and seed workflow
- `npm run db:generate` → SQL into `drizzle/` (committed, reviewed). `npm run db:migrate` runs `drizzle-orm/node-postgres/migrator` with `DATABASE_MIGRATE_URL`. It is a deployment release step run before the new containers start. Migrations are forward-only. Destructive changes use expand → backfill → contract across two releases.
- Roles are created by migration `0001_roles.sql` (idempotent `DO $$` blocks): `nargito_migrator` owns the schema, `nargito_app` gets `SELECT, INSERT, UPDATE, DELETE` on all tables except the append-only ones (see §11.13) and `USAGE` on sequences. Passwords are set by the operator out of band.
- `npm run db:seed` (idempotent, safe in production, upserts only): permissions and system roles from `rbac/catalog.ts` (`rbac:sync` is the same function), languages (en default, hi), `site_settings` defaults (insert-if-missing), `feature_flags` defaults, `content_categories` (post / group / business starter sets, en+hi names), `listing_categories` (starter set), `subscription_plans` (two inactive example plans with null provider ids), `cms_pages` (about, terms, privacy, help as **drafts** marked “needs legal review”), `scheduled_jobs`, and `translation_keys` via `i18n:sync`.
- `npm run db:seed:demo` creates demo members, posts, listings, trips and conversations. It refuses to run unless `NODE_ENV !== 'production'`.
- `npm run admin:bootstrap -- --email <email>` is described in §6.3.


## 12. Design tokens, typography and brand

### 12.1 Token system (`src/styles/globals.css`)
Tokens are CSS variables, and Tailwind v4 reads them through `@theme inline`. Components use only semantic utilities (`bg-surface`, `text-muted-foreground`, `border-border`, `bg-primary`). A lint script (`scripts/lint-colors.mjs`) fails CI on hex/rgb/hsl literals or Tailwind palette classes (`bg-blue-500`, `text-gray-600`) anywhere in `src/` except `src/styles/globals.css` and `src/config/tokens.ts`.

```css
:root {
  --background: #F7F9FC;      --surface: #FFFFFF;        --surface-muted: #F1F4FA;
  --foreground: #111827;      --muted-foreground: #667085;
  --border: #E5EAF2;          --input: #D5DCE8;
  --primary: #315EFB;         --primary-hover: #2448CC;  --primary-tint: #EAF0FF;
  --primary-foreground: #FFFFFF;
  --primary-text: #2448CC;    /* links/active text on surface or tint (6.4:1 on tint) */
  --ring: #315EFB;
  --wordmark: #0B1240;        /* from the typography reference sheet */
  --success: #067647; --success-bg: #ECFDF3;
  --warning: #B54708; --warning-bg: #FFFAEB;
  --danger:  #B42318; --danger-bg:  #FEF3F2;
  --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px;
  --shadow-card: 0 1px 2px rgb(16 24 40 / 0.06);
  --shadow-popover: 0 8px 24px rgb(16 24 40 / 0.12);
}
.dark {
  --background: #0B1120;      --surface: #151E30;        --surface-muted: #1B2740;
  --foreground: #F3F6FC;      --muted-foreground: #98A2B3;
  --border: #263349;          --input: #33415C;
  --primary: #315EFB;         --primary-hover: #2448CC;  --primary-tint: #1B2A52;
  --primary-foreground: #FFFFFF;
  --primary-text: #7C9CFF;    --ring: #7C9CFF;
  --wordmark: #F3F6FC;
  --success: #47CD89; --success-bg: #0F2A1F;
  --warning: #FDB022; --warning-bg: #2E2208;
  --danger:  #F97066; --danger-bg:  #34130F;
  --shadow-card: 0 1px 2px rgb(0 0 0 / 0.4);
  --shadow-popover: 0 8px 24px rgb(0 0 0 / 0.5);
}
@theme inline {
  --color-background: var(--background); --color-surface: var(--surface); --color-surface-muted: var(--surface-muted);
  --color-foreground: var(--foreground);  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border); --color-input: var(--input); --color-ring: var(--ring);
  --color-primary: var(--primary); --color-primary-hover: var(--primary-hover);
  --color-primary-tint: var(--primary-tint); --color-primary-foreground: var(--primary-foreground);
  --color-primary-text: var(--primary-text); --color-wordmark: var(--wordmark);
  --color-success: var(--success); --color-success-bg: var(--success-bg);
  --color-warning: var(--warning); --color-warning-bg: var(--warning-bg);
  --color-danger: var(--danger);   --color-danger-bg: var(--danger-bg);
  --radius-sm: var(--radius-sm); --radius-md: var(--radius-md); --radius-lg: var(--radius-lg);
  --font-sans: var(--font-poppins), var(--font-devanagari), system-ui, sans-serif;
}
html[lang='hi'] { --font-sans: var(--font-devanagari), var(--font-poppins), system-ui, sans-serif; }
```

The values given in the brief are used exactly (primary, hover, tint, backgrounds, surfaces, text, secondary text, borders, dark bg/surface/text). Everything else (`surface-muted`, `input`, dark `muted-foreground`/`border`, `primary-text`, semantic colours) is **derived by this design**, because the brief gave no value for them. Derived values are marked here so that review can challenge them.

Contrast facts that drove the derived tokens (WCAG relative luminance, computed):
- White on `#315EFB` = 5.1:1 (button text OK).
- `#315EFB` text on `#EAF0FF` = 4.46:1, which **fails AA for normal text**, so text on the tint and links use `--primary-text` (`#2448CC`, 6.4:1 on the tint). `--primary` is a fill colour only (buttons, indicators, toggles).
- `#667085` secondary text on white = 4.97:1 and on `#F7F9FC` = 4.69:1 (OK) but 4.36:1 on the tint, so secondary text is never placed on the tint.
- Dark mode: white on `#315EFB` stays 5.1:1. Links on dark surfaces use `#7C9CFF` (6.4:1 on `#151E30`).

`tests/unit/contrast.test.ts` parses the token file and asserts ≥ 4.5:1 for every declared text/background pair in both themes (≥ 3:1 for ring and border-on-surface UI pairs). Semantic colours (success/warning/danger) are used only for status badges, form errors and toasts.

Scale: spacing on the 4 px grid. Radius: controls 8 px, cards 12 px, avatars/badges full, with no other pill buttons. Shadow: a single `shadow-card` and `shadow-popover`. Icons: lucide at 16/20/24 px, `strokeWidth 1.75`. Type scale (size/line-height): 12/16, 14/20 (default UI), 16/24 (body), 18/28, 20/28, 24/32, 30/36 (largest, for page titles only). Weights 400/500/600/700. Max reading width 65ch. Motion: ≤ 150 ms opacity/transform transitions, nothing else, all wrapped in `motion-safe:`. No gradients, glow, glass or blobs in the UI chrome (the logo keeps its own artwork).

Theme: `next-themes` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`. The root layout reads the theme preference cookie (`theme`) server-side, so the initial HTML has the correct class and there is no flash (AC-40). When signed in, changes are written to `users.theme` and `users.locale` and mirrored into cookies. `<meta name="theme-color">` has light/dark variants using `media` queries.

### 12.2 Fonts (`next/font/google`, self-hosted at build)
```ts
const poppins = Poppins({ subsets: ['latin'], weight: ['400','500','600','700'], display: 'swap', variable: '--font-poppins' });
const devanagari = Noto_Sans_Devanagari({ subsets: ['devanagari'], weight: ['400','500','600','700'], display: 'swap', variable: '--font-devanagari' });
```
Both variables are set on `<html>`. English pages put Poppins first, and `html[lang=hi]` puts Noto Sans Devanagari first (CSS above). The build requires network access to Google Fonts once; CI caches `.next/cache`. The `Nargito` wordmark always uses Poppins explicitly (`font-[family-name:var(--font-poppins)] font-semibold`), regardless of locale.

### 12.3 Brand assets
**Source facts (verified):** `Assets/nargito_logo.png` is 1489×1481, RGBA, rounded-square artwork with transparent corners and **no wordmark**. Therefore the UI shows **icon + the text “Nargito”** side by side. This is not a duplicate wordmark. The reference sheet confirms the wordmark is Poppins SemiBold/Bold in dark navy (`--wordmark`).

**`<BrandLogo size variant>`** (`src/components/brand/brand-logo.tsx`) renders `<Image src="/brand/logo-192.png">` at 32 px (header), 48 px (auth), 64 px (loading) with `alt=""` plus the visible text “Nargito” (so the link’s accessible name is “Nargito”). Variant `icon-only` is for the mobile top bar and favicon contexts. It never draws the symbol with CSS or SVG.

**Derivatives** are produced by `scripts/generate-brand-assets.mjs` (sharp; `npm run brand:generate`, outputs are committed so builds don't depend on regeneration):
| Output | Spec |
|---|---|
| `public/brand/logo-{32,64,96,192,512}.png` | Fit inside a square transparent canvas (`fit: 'contain'`, transparent background), centred. The source is 1489×1481, so the padding is ≈4 px at 1489 px scale. Aspect ratio is never stretched; alpha is preserved. |
| `src/app/icon.png` (512) and `public/favicon.ico` (16/32/48 PNG-in-ICO via `png-to-ico`) | From the same contained canvas. |
| `src/app/apple-icon.png` (180) | Composited on solid `#315EFB`, because iOS fills transparency with black. This is the single documented background exception. |
| `public/brand/maskable-512.png` | Artwork scaled to 80% of the canvas and centred on `#315EFB` (inside the maskable safe zone). |
| `public/brand/email-logo-96.png`, `email-logo-192.png` (192 used with `width=48` for 2× screens) | Same as logo, hosted at `${APP_URL}/brand/…` for emails (no data URIs or SVG, because mail clients block them). |
| `/opengraph-image` | Runtime `ImageResponse` (1200×630): logo + “Nargito” in Poppins 600 (font file read from the `next/font` asset) on `--background`. Per-entity OG images are used where a public cover exists. |

`scripts/check-brand-asset.mjs` (runs in `prebuild` and CI) verifies that `Assets/nargito_logo.png` exists, matches the sha256 and dimensions stored in `brand.lock.json`, and that every derivative exists. A mismatch fails the build with a message to either restore the file or deliberately run `npm run brand:lock`. This implements “locate the actual asset rather than silently replacing it”.

**Placement:** header (desktop and mobile), `/login` `/signup` etc., the root `loading.tsx` (logo with a 1.2 s opacity pulse under `motion-safe`), the app shell footer and mobile drawer, the PWA splash (manifest icons + `background_color`), all emails (header block with the 48 px logo and “Nargito” text in Poppins-fallback bold: `Poppins, Arial, sans-serif`, since webfonts are unreliable in mail), and the offline page. The “Glossy Blue Nargito Connection Icon.png” (no alpha) and the typography sheet are not shipped.

## 13. Layout and responsive shell

`src/components/shell/*`. The shell layout (`(site)/[locale]/(app)/layout.tsx`) wraps all member routes. Public pages use a lighter `PublicShell` (header + footer, single column) built from the same header component.

| Viewport | Layout |
|---|---|
| ≥ 1024 px (`lg`) | **Header** (56 px, sticky): brand link, search (typeahead), icon+label nav: Home, Network, Marketplace, Trips, Messaging (badge), Notifications (badge); at right: Create (menu: Post, Trip, Product, Service), Business (workspace switcher), Me (avatar menu: profile, settings, theme, language, sign out), “Try Pro” when plans are active. **Three columns** `grid-cols-[200px_minmax(0,1fr)_280px]` at `lg`, `[225px_minmax(0,1fr)_300px]` at `xl`, container max 1128 px, gap 24 px. Left: profile summary card (avatar, name, headline, connections/followers counts) and shortcuts (Saved, Groups, My trips, My listings, Nearby). Centre: composer (Post / Trip / List) and tabs (Following, Discover, Nearby), then the feed (max 600 px). Right: People you may know, Nearby now, Open trips, a Sponsored slot (labelled), CMS footer links and copyright. |
| 768–1023 px (`md`) | Header with icon-only nav (tooltips and `aria-label`). **Two columns**: centre + right rail (280 px). Left content moves into the Me menu / sheet. |
| < 768 px | **One column.** Top bar: icon-only logo, search icon (opens full-screen search), notifications bell. **Bottom navigation** (fixed, 56 px + `env(safe-area-inset-bottom)`): Home, Network, Create (opens a bottom sheet with Post/Trip/Product/Service), Messages (badge), Menu (drawer: profile, saved, nearby, trips, marketplace, groups, business, settings, theme, language). Main content has matching bottom padding. |

Differences from LinkedIn that give NARGITO its own identity: tinted rounded-rectangle active nav states (no underline bar), Trips and Nearby as top-level destinations, a “List item” composer action, a Nearby right-rail module, and the NARGITO icon/colour system. No LinkedIn icons, wording, colours or layout measurements are copied.

Accessibility of the shell: a “Skip to content” link, landmarks (`header`, `nav aria-label`, `main`, `aside`), visible focus rings (2 px `--ring`, 2 px offset), minimum 44×44 px touch targets in the bottom nav, nav badges have text alternatives (“3 unread”), dialogs and sheets use Radix (focus trap, Esc, return focus). Every page works to 320 px without horizontal scroll (AC-39).

Page-state conventions: every list has loading skeletons (`<Skeleton>`; no spinners over content), empty states with a primary action, and error boundaries (`error.tsx` per segment) that show a localized message and the `requestId`. The mutation UI maps `Result` errors to toasts and field errors (`react-hook-form` `setError` from `fieldErrors`). `CONFIGURATION_REQUIRED` renders `<ConfigurationRequired/>` (explains which integration and, for admins, a link to `/admin/integrations`).

## 14. Security design

### 14.1 Headers and CSP (`middleware.ts`)
Middleware generates a per-request nonce (`crypto.randomUUID()` base64) and sets request header `x-nonce`, response `Content-Security-Policy`, plus:
```
default-src 'self'; script-src 'self' 'nonce-{n}' 'strict-dynamic'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: {CDN_ORIGIN|S3_PUBLIC_ORIGIN}; media-src 'self' blob: {CDN_ORIGIN|S3_PUBLIC_ORIGIN};
font-src 'self'; connect-src 'self' {S3_ORIGIN} {SENTRY_INGEST_ORIGIN}; worker-src 'self'; manifest-src 'self';
frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests
```
`style-src 'unsafe-inline'` is kept because React/Radix inject inline `style` attributes (positioning), and this is a recorded, accepted trade-off. `script-src` has no `unsafe-inline`/`unsafe-eval` in production (dev adds `unsafe-eval` for React refresh). Also: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (production only), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=(self), interest-cohort=()`, `Cross-Origin-Opener-Policy: same-origin`. `/admin/*` and `/api/*` additionally get `Cache-Control: no-store`; `/admin` gets `X-Robots-Tag: noindex, nofollow`. Middleware reads no DB and does not make authorization decisions, because it only does routing, locale, headers and a cheap session-cookie presence check to redirect unauthenticated users early. The real checks are in pages, actions and handlers.

### 14.2 CSRF and origin
- Cookies are `SameSite=Lax`, so cross-site POSTs don't carry them. This is the first layer.
- Server Actions use Next's built-in Origin/Host comparison, with `serverActions.allowedOrigins` set to the hosts in `APP_URL` and `ALLOWED_ORIGINS`.
- Route Handlers with a non-safe method go through `assertSameOrigin()` in `defineRoute`: `Origin` must equal an allowed origin, or when `Origin` is absent `Sec-Fetch-Site` must be `same-origin`; otherwise `FORBIDDEN` + `security_events('csrf_failed')`. Webhooks opt out with `csrf:'signature'` and must verify an HMAC.
- Better Auth is configured with `trustedOrigins` = the same allow-list.

### 14.3 Other controls
- **XSS:** React escapes by default. The only `dangerouslySetInnerHTML` is JSON-LD, serialised by `safeJsonLd()` (escapes `<`, `>`, `&`, U+2028/9) and given the nonce. CMS markdown goes through `rehype-sanitize` with a strict schema (no raw HTML, links get `rel="noopener noreferrer nofollow ugc"` for user content). User URLs are limited to `https:` (and `mailto:` where explicitly allowed).
- **Open redirect:** `next`/`redirect` parameters must match `^/(?!/)` after decoding. Anything else becomes `/feed`. Redirect-table targets are admin-controlled.
- **SQL injection:** Drizzle parameterises. `sql.raw` is banned by lint. Raw `sql` templates take only parameter placeholders or whitelisted identifiers.
- **IDOR:** all object access goes through `queries`/`policy` with the viewer context. The authorization test (AC-44) iterates the action registry.
- **Enumeration:** login, reset and OTP responses are uniform (“If an account exists, we sent…”). Timing differences are reduced by hashing a dummy password on unknown emails. Usernames/emails are checked by availability endpoints only on sign-up with the `auth.signup` limiter.
- **Brute force:** §7.4 limits. TOTP and OTP attempts are counted per identifier, and OTPs are invalidated after the attempt cap.
- **Uploads:** §10.1 (magic bytes, quarantine, size limits, EXIF stripping, no SVG, `nosniff`, documents as attachments, there is no malware scanning in this design, and the product does not claim any. Restricted documents are download-only and never rendered inline).
- **Secrets:** server env only; Sentry and loggers scrub `authorization`, `cookie`, `password`, `token`, `secret`, `otp`, `code` keys; `next.config` `env` is not used. A CI grep test fails if a server-only env name appears in `src/components` or client files (`'use client'`). `import 'server-only'` guards the service modules.
- **Dependency hygiene:** `npm audit --omit=dev --audit-level=high` in CI; Dependabot weekly; lockfile committed.
- **Admin hardening:** optional `ADMIN_ALLOWED_CIDRS` env (CSV). When set, `/admin` and admin actions return 404 for other source IPs. MFA, 12-hour cap, idle timeout (§6.3).
- **Privacy in logs:** IPs stored only in `sessions`, `security_events` and `admin_audit_logs`. Request bodies are never logged. Location routes log nothing but the route and status.
- **Account takeover:** changing email or phone requires a code to the *new* address and a notification to the old one. Password change revokes other sessions. Linking providers requires an active session.

## 15. PWA

- **Manifest:** `src/app/manifest.webmanifest/route.ts` builds JSON from `site_settings` (`pwa.name`, `pwa.short_name`, `pwa.theme_color`, `pwa.background_color`, `pwa.display`, `general.default_locale`), with `id: "/"`, `start_url: "/?source=pwa"`, `scope: "/"`, `icons` (192, 512 `any`; 512 `maskable`), and `shortcuts` for New post, Messages and Nearby. `Cache-Control: public, max-age=0, s-maxage=300`, so admin edits show within 5 minutes (AC-31). Colour values are validated as 6-digit hex at write time.
- **Service worker** `public/sw.js` (hand-written, ~150 lines, no Workbox), registered by `<PwaRegister/>` only when `NODE_ENV==='production'` and `pwa.enabled`. Scope `/`. `Service-Worker-Allowed` not needed.
  - **Precache** on install: `/offline` (localized HTML fetched at install for each enabled locale from `/offline`, `/hi/offline`), `/brand/logo-192.png`, `/brand/logo-512.png`, and the fonts used by the offline page.
  - **Runtime caching allow-list** (cache-first or stale-while-revalidate, `GET` only, `response.ok`, same-origin or `CDN_ORIGIN`): `/_next/static/*` (immutable), `/brand/*`, and public-bucket media under `/m/*` on the CDN origin (SWR, max 200 entries, LRU eviction). Nothing else is ever put in a cache.
  - **Never cached, by construction:** navigations (`request.mode==='navigate'`: network-first, on failure serve the cached `/offline`, and the navigation response itself is *not* stored), anything under `/api/`, `/admin`, `/login`, `/signup`, `/settings`, `/messaging`, `/notifications`, `/business`, `/_next/data`, RSC requests (`RSC` header, `_rsc` query), non-GET, any response with `Cache-Control` containing `private` or `no-store`, or with `Set-Cookie`, and anything on a restricted-media URL (`/api/media/*`). Because the cache is allow-list based, a new private route is safe by default.
  - **Logout:** the app posts `{type:'CLEAR_CACHES'}` to the SW, which deletes runtime caches (static assets only, but cleared for hygiene).
  - **Update:** `skipWaiting` is not automatic; the app shows a localized “New version available — reload” toast when a new SW is `waiting`.
  - **Push:** `push` event parses `{title, body, url, tag}` (all server-localized, generic text), shows a notification, `notificationclick` focuses an existing window or opens `url` after verifying it is same-origin.
- **Install UX:** `beforeinstallprompt` captured in a client hook; an “Install app” item appears in the Me menu/settings when available. iOS Safari shows instructions (“Share → Add to Home Screen”). Push subscription happens only from an explicit button in Settings → Notifications.
- **Test (AC-41):** a Playwright test signs in as admin, browses `/admin`, `/messaging`, `/settings`, then enumerates `caches.keys()` in the page and asserts that no cached request URL matches the deny-list and that all match the allow-list.

## 16. Configuration, i18n, CMS, SEO

### 16.1 Settings registry (`src/modules/settings/registry.ts`)
Each setting: `{ key, category, type, schema (Zod), default, public (exposed to the client bundle via a server-resolved prop), sensitive (needs step-up), description-key }`. The admin form is generated from it. Reads are cached in-process for 60 s plus Redis pub/sub invalidation on write, so they are effective across instances within seconds. `getSetting(key)` is the only way to read. Writes go through `settings.update` (permission `settings.write`, audited with before/after).

| Category | Keys (type, default) |
|---|---|
| general | `general.site_name` (string, "Nargito"), `general.tagline`, `general.support_email`, `general.default_locale` (en), `general.maintenance_mode` (bool, false), `general.maintenance_message` (i18n map) |
| seo | `seo.indexing_enabled` (true), `seo.title_template` ("%s · Nargito"), `seo.default_description` (i18n map), `seo.default_og_media_id` |
| pwa | `pwa.enabled` (true), `pwa.name`, `pwa.short_name`, `pwa.theme_color` (#315EFB), `pwa.background_color` (#F7F9FC), `pwa.display` (standalone) |
| auth | `auth.signup_enabled` (true), `auth.admin_session_hours` (≤12, 12), `auth.password_min_length` (≥10, 10) |
| uploads | `uploads.max_image_mb` (10), `uploads.max_video_mb` (100), `uploads.max_document_mb` (20), `uploads.max_post_media` (10) |
| moderation | `moderation.auto_hide_threshold` (3), `moderation.require_listing_review` (true), `listings.default_expiry_days` (60) |
| promotions | `promotions.price_per_day_minor` (20000 = ₹200), `promotions.currency` (INR), `promotions.require_review` (true) |
| billing | `approvals.refund_threshold_minor` (0) |
| privacy | `privacy.deletion_grace_days` (14), `privacy.soft_delete_retention_days` (30), `privacy.audit_retention_days` (730), `privacy.security_event_retention_days` (365) |
| limits | `rate_limit.multiplier` (1, 0.25–4), `limits.free_active_listings` (10), `limits.free_trips` (20) |
| integrations | `integrations.check.<id>` (written by “Test connection”: `{ok, at, detail}`) |

**Enforcement examples (server-side):** `maintenance_mode` → `defineAction` pre-step returns `MAINTENANCE` for non-admin mutations, and pages show a banner. `auth.signup_enabled=false` → the sign-up action and OAuth first-time sign-up are rejected by an `databaseHooks.user.create.before` hook. `uploads.*` → read in `sign` and `complete`, bounded above by hard code ceilings (e.g. image ≤ 25 MB). `moderation.*` → §10.5/§10.9. `promotions.*` → §10.10. `seo.indexing_enabled` → `robots.ts` and `generateMetadata` robots. `pwa.*` → manifest.

### 16.2 Feature flags (`feature_flags`)
Keys: `marketplace`, `trips`, `groups`, `messaging`, `nearby`, `promotions`, `pro_subscriptions`, `push_notifications`, `phone_login`, `social_login_google`, `social_login_facebook`, `business_verification`, `ai_assist`. Evaluation `isEnabled(key, viewer?)`: false if the row is disabled, or the integration the flag depends on is unconfigured (e.g. `phone_login` needs SMS, `ai_assist` needs AI keys); true if `viewer.id ∈ allow_user_ids`; otherwise `rollout_percent = 100` → true, else `hash32(userId + ':' + key) % 100 < rollout_percent` (anonymous viewers only see a flag when rollout is 100). Enforcement points: `defineAction({ feature })`, `defineRoute({ feature })`, route-segment layouts (`notFound()`), nav rendering, and job handlers. UI hiding alone is not relied on (AC-30).

### 16.3 Internationalisation (`next-intl`)
- Locales from `languages` (seeded en, hi; `i18n/routing.ts` reads the enabled list at build/start, with a 60 s refresh for adding a language without redeploy being limited to **messages** — adding a locale to the URL space needs a restart, which the admin page notes).
- Routing: `localePrefix: 'as-needed'` (English unprefixed). `NEXT_LOCALE` cookie and `users.locale` give the preferred locale; Accept-Language is used only for first visit redirects on `/`.
- Messages: `src/i18n/messages/{en,hi}.json`, namespaced (`common`, `auth`, `feed`, `market`, `trips`, `messaging`, `admin`, `errors`, `emails`, `seo`). `getRequestConfig` merges file messages with `translation_keys.values[locale]` overrides (cached with `unstable_cache` and tag `i18n`, revalidated on admin edit). Fallback: locale → `languages.fallback_code` → `en`.
- `npm run i18n:sync` upserts `translation_keys` from `en.json` (marks removed keys `is_orphan`), and reports keys missing in `hi`. **CI fails** when `en` and `hi` files have different key sets (AC-43).
- No hard-coded user-facing strings: `eslint-plugin-i18next` (`no-literal-string`, JSX-text and selected attributes: `aria-label`, `title`, `placeholder`, `alt`) is on for `src/app`, `src/components`. Server-originated messages (`AppError.message`, emails, push, notifications) are keys resolved at render with ICU params. Zod error messages are keys, not text.
- Dates, numbers and currency use `Intl` via next-intl formatters with the active locale (INR with `en-IN`/`hi-IN` digit grouping). Hindi plural/ICU rules are covered by next-intl. User-generated content is never translated automatically.
- Admin UI is also translated (`admin` namespace). Hindi admin strings are required for parity.

### 16.4 CMS
`cms_pages` bodies are Markdown per locale. Editor = textarea with a live sanitized preview (no WYSIWYG dependency). **Save** creates a revision (`revision_no = max+1`) and updates the draft columns. **Publish** (permission `cms.publish`) sets `published_revision_id`, `status='published'`, `published_at`. **Rollback** publishes a *copy* of an older revision as a new revision (history stays linear). Public `/p/[slug]` renders the published revision in the requested locale, falling back to English, and 404s for drafts or archived pages. Footer links come from `show_in_footer` pages. Revalidation uses tag `cms:<slug>` (AC-33).

### 16.5 SEO
- `robots.ts`: if `seo.indexing_enabled` is false → `Disallow: /` and metadata `robots: noindex`. Otherwise allow `/`, disallow `/admin`, `/api`, `/settings`, `/messaging`, `/notifications`, `/business`, `/login`, `/signup`, and reference the sitemap.
- `sitemap.ts` with `generateSitemaps()`: segments `static`, `cms`, `profiles`, `companies`, `shops`, `products`, `services`, `trips`, `groups`, `posts` (public, visible, not deleted; ≤ 5,000 URLs each; ordered by `id` with an id-range per segment id), each URL with `alternates.languages` (en/hi) and `lastModified` from `updated_at`. Profiles appear only if `profile_visibility='public' AND discoverable`.
- `generateMetadata` for every public route: title template, description, canonical, `alternates.languages`, Open Graph and Twitter card, `robots` (noindex for private states). JSON-LD per §9.1. `/admin` and auth pages are `noindex`.
- Redirects: the catch-all `[...rest]` page resolves `redirects` (in-process cache 60 s, invalidated on admin write), increments `hit_count` asynchronously, and responds with the stored status code. Redirect loops and chains > 5 are rejected on save.


## 17. External adapters and test transports

Every integration is an interface in `src/server/<name>/` with a real implementation, a `Null` implementation (returns `CONFIGURATION_REQUIRED`) and, where useful for tests, an explicit test transport. Selection happens once in `src/config/integrations.ts`.

| Interface | Real | Null | Test transport (refused in production) |
|---|---|---|---|
| `MailTransport.send({to, subject, html, text})` | Nodemailer SMTP | `NullMail` | `MAIL_TRANSPORT=file` writes JSON files to `.tmp/outbox/` that tests read. Dev uses Mailpit via SMTP. |
| `SmsProvider.send({to, body})` | Twilio REST (`fetch`, basic auth, 5 s timeout, no retries for OTP) | `NullSms` | `SMS_TRANSPORT=file` writes to `.tmp/outbox/`. |
| `ObjectStorage` (`presignPut`, `head`, `getRange`, `copy`, `delete`, `presignGet`) | S3 client | `NullStorage` | `STORAGE_TRANSPORT=memory` for unit tests only. e2e uses MinIO if available, else skips upload specs and reports them as **skipped, not passed**. |
| `PaymentProvider` | `RazorpayProvider` (REST via `fetch`) | `NullPayments` | None. Tests compute HMAC signatures locally for the webhook handler and stub Razorpay HTTP at the network boundary (`msw`). These tests prove our code only. |
| `PushSender` | `web-push` | `NullPush` | None. |
| `AiClient` | Anthropic Messages API (`fetch`) | `NullAi` | Stubbed with `msw` in tests. |
| `RedisLike` (`incr`, `pexpire`, `publish`, `subscribe`, `get`, `set`) | `ioredis` | — | In-memory implementation, allowed when `NODE_ENV !== 'production'`. |

**Verification policy (matches requirement FR-21):** the design and the docs never state that SMTP, SMS, S3, Google, Facebook, Razorpay, Web Push, AI or Sentry “work”. Each has (a) a unit/integration test of our code against a stub or test transport, and (b) an admin “Test connection” action (`integrations.test`, step-up) that performs one real, harmless call (SMTP `verify()`, S3 `HeadBucket`, Twilio account fetch, Razorpay `GET /v1/payments?count=1`, Anthropic models list, Sentry test event, OAuth config presence check since OAuth needs a browser round trip) and stores `{ok, at, detail}`. Until then the UI says “Configured, not yet tested”. In this repo's delivery, none of these live calls were run, and the final report must list them as unverified.

## 18. Background worker, jobs and realtime infrastructure

`src/worker/index.ts` is built with `tsup` to `dist/worker.js` and started as a separate process or container (`node dist/worker.js`) with the same env. It starts pg-boss (schema `pgboss`, created by pg-boss on first start using the migrator URL via `PGBOSS_URL` falling back to `DATABASE_MIGRATE_URL`), registers handlers, upserts `scheduled_jobs` rows, and writes a Redis heartbeat key every 30 s (TTL 90 s) for the health page. Each handler is wrapped to record `last_run_at/last_status/last_error/last_duration_ms/run_count`, to skip when `is_enabled=false`, and to log failures at `error` (+ Sentry). Retries: 5 attempts, exponential backoff, dead-letter queue visible in `/admin/jobs`. The web process only enqueues (it needs the pg-boss client, no handlers).

| Job (queue) | Schedule | Purpose |
|---|---|---|
| `media.process` | on demand | §10.1 step 3–4 |
| `media.reconcile` | on demand | Move objects on visibility change, purge removed content media |
| `media.gc` | hourly :10 | Delete stale `pending`/unattached assets and their objects |
| `notification.fanout`, `email.send`, `push.send` | on demand | §10.13 |
| `listing.expire` | hourly :05 | §10.5 |
| `trip.status` | every 15 min | Moves `planned → ongoing → completed` by comparing dates with `now() at time zone trips.timezone` |
| `promotion.lifecycle` | every 5 min | §10.10 |
| `subscription.reconcile` | every 6 h | Pulls provider state for subscriptions near period end (no-op if payments unconfigured) |
| `counts.reconcile` | daily 02:30 | Recompute cached counters and log drift (`warn` if > 0.1%) |
| `retention.purge` | daily 03:00 | §5.2.5 purge, notifications 180 d, `system_logs` 30 d, `promotion_events` 400 d, expired exports, `purge_append_only()` |
| `auth.cleanup` | hourly :20 | Expired sessions and verification tokens |
| `deletion.process` | hourly :30 | §10.15 |
| `export.build` | on demand | §10.15 |
| `approvals.expire` | hourly :40 | Pending approvals past `expires_at` → `expired` |
| `broadcast.send` | on demand | Admin broadcasts, in batches of 500 recipients |
| `billing.replay` | on demand | Re-process a stored billing event |

**Realtime:** Redis channels `user:<id>` (payload JSON, ≤ 512 bytes: `{t:'message.created'|'notification.created'|'counts'|'session.revoked', …ids}`) are subscribed to through one shared subscriber connection per web instance that multiplexes to local SSE streams. With the in-memory `RedisLike` in dev, a single process works. The SSE route and subscriber live in `src/server/realtime.ts`.

## 19. Operations and deployment

- **Logging:** `pino` JSON to stdout. Fields: `time, level, msg, requestId, userId?, route, action?, durationMs`. The redaction list is configured centrally. `level ≥ warn` is additionally written to `system_logs` through a buffered writer (batch insert every 2 s, drop-on-overflow with a counter, never blocking requests). The request id comes from the `x-request-id` header or is generated by middleware and returned in the response.
- **Sentry:** `@sentry/nextjs` for server, edge and client when DSNs are set. `beforeSend` scrubs cookies, headers and bodies. `tracesSampleRate` 0.05. Source maps are uploaded in CI when `SENTRY_AUTH_TOKEN` exists.
- **Health:** `/api/health` → `{status:'ok'}` (process alive). `/api/health?deep=1` (needs `system.health` or an `X-Health-Token` equal to `HEALTH_TOKEN` env for load balancers) checks DB `select 1`, Redis `PING`, storage `HeadBucket` (if configured), worker heartbeat, and returns per-check latency. `/admin/system-health` renders the same.
- **Backups:** production uses managed Postgres with PITR where available. For self-hosting, `scripts/backup/pg-backup.sh` runs `pg_dump -Fc` nightly, encrypts with `age` (recipient from env `BACKUP_AGE_RECIPIENT`), uploads to a *separate* bucket/prefix, and prunes to 14 daily + 8 weekly + 6 monthly. Object storage has versioning and a lifecycle rule (expire `quarantine/` after 1 day, abort incomplete multipart after 1 day). `docs/OPERATIONS.md` documents restore (`pg_restore` into a scratch DB, row-count checks) and a quarterly restore drill. The backups were not executed in this delivery.
- **Docker:** `Dockerfile` multi-stage (deps → build with `output: 'standalone'` → runtime `node:22-alpine`, non-root user, `sharp` native bundled) with two targets, `web` (`node server.js`) and `worker` (`node dist/worker.js`). `docker-compose.yml` (dev): `postgres:16`, `redis:7`, `minio` (+ bucket init), `mailpit`; `docker-compose.prod.example.yml` shows web + worker + a Caddy reverse proxy with TLS. Proxy requirements are documented: forward `X-Forwarded-For/Proto/Host`, `proxy_buffering off` + read timeout ≥ 1 h for `/api/realtime/stream`, request body limit 2 MB (uploads go direct to storage).
- **Release order:** build image → `db:migrate` (migrator URL) → `db:seed` (idempotent) → roll web → roll worker. Rollback = redeploy the previous image (migrations are backward-compatible by the expand/contract rule).
- **CI** (`.github/workflows/ci.yml`): `install` → `lint` (eslint + i18n parity + colour lint + boundaries + brand check) → `typecheck` → `test:unit` → `test:integration` (Postgres 16 service) → `build` → `test:e2e` (Playwright, Redis + MinIO + Mailpit services) → `npm audit`.
- **Docs to write:** `docs/DEPLOYMENT.md` (env, release, proxy, scaling), `docs/OPERATIONS.md` (backups, restore, jobs, incident runbook, secrets rotation, admin bootstrap), `docs/INTEGRATIONS.md` (each credential, callback URLs, test steps), `docs/SECURITY.md` (model, headers, RBAC, reporting), `README.md` (dev quick start for Windows/macOS/Linux).
- **Scaling notes:** web is stateless (sessions in DB, cache in Redis); run ≥ 1 replicas. A single worker is enough (pg-boss locks), run 2 for HA. Postgres connection pool: `max=10` per web replica and `max=5` per worker. SSE holds one Node socket per tab, so plan about 10k concurrent connections per instance.

## 20. Testing strategy

### 20.1 Layers
- **Unit (Vitest, `environment: node`, no DB or network):** pure logic — `policy.ts` files, RBAC effective-permission set algebra (the SQL result is mapped to the same function and the pure combiner is tested), feature-flag hashing, settings registry schemas, cursor encode/decode, geohash encode/neighbours/bucketing, rate-limit policy table, state machines (listing, trip, campaign), contrast checker, `redact()`, `safeJsonLd()`, redirect-target validator, markdown sanitizer, SW allow/deny matcher (extracted to `sw-rules.ts` and shared with `sw.js` via build), Zod schemas (limits), i18n key parity, token linter.
- **Component (Vitest + Testing Library, `jsdom`):** a small set — `ConfigurationRequired`, `BrandLogo` (renders one image and one wordmark), forms mapping `fieldErrors`, bottom-nav items.
- **Integration (Vitest, `environment: node`, real PostgreSQL):** every module’s `service.ts` and `queries.ts` against a migrated DB. Harness `tests/setup/db.ts`: uses `TEST_DATABASE_URL` when set (CI service or local), otherwise starts **`embedded-postgres`** (real PostgreSQL binaries, works without Docker, which matters on the Windows dev machine here). It applies the committed migrations once into a template database, then each test file does `CREATE DATABASE … TEMPLATE` for isolation and drops it afterwards. Roles `nargito_migrator`/`nargito_app` are created so the grant tests are real. Redis uses the in-memory implementation, with an opt-in `REDIS_URL` run in CI for the limiter/pub-sub tests. Mail/SMS use the file transports.
- **End-to-end (Playwright, projects `chromium-desktop` 1280×800, `chromium-tablet` 800×1024, `mobile` Pixel 7):** against `next build && next start` with a migrated and seeded DB and a worker process. `@axe-core/playwright` runs on landing, login, feed, profile, listing detail, messaging, settings, and `/admin` pages (violations of level serious/critical fail the test).

### 20.2 Required test cases (traceable to ACs)
| Area | Cases |
|---|---|
| Auth (AC-1…8) | sign-up → email from outbox → verify; OTP expiry/attempts/cooldown; Google/Facebook buttons disabled without env; cookie flags; reset token single-use and session revocation; admin without TOTP is redirected; role label `admin` without `admin.access` → 404; `member` + allow override → access after MFA; deny beats role; expired override ignored. |
| Authorization (AC-9, 44) | Generated from the action/route registry: each action is called as anonymous, as a user without the permission, and as the right user; expected `UNAUTHENTICATED`/`FORBIDDEN`/`NOT_FOUND`. Every admin action must declare `permission` and `audit` (registry test fails otherwise). Sensitive permission without fresh step-up → `STEP_UP_REQUIRED`. Approval: reviewer = requester rejected by the DB `CHECK`. |
| Content (AC-10…16) | Validation limits; rate-limit response; visibility matrix (public/connections/group/private × owner/connection/stranger/blocked) over feed, profile, search, permalink; block side effects; keyset pagination stability with concurrent inserts (insert between page fetches, assert no dup/miss of older rows); auto-hide threshold; soft-delete invisibility. |
| Uploads (AC-11) | Real JPEG header renamed `.png`/declared mismatched MIME; polyglot; oversize; SVG; EXIF GPS stripped in output (sharp output re-read). Uses MinIO in CI. |
| Marketplace/trips/messaging (AC-17…21) | State machine table-driven; **concurrency**: 20 parallel `enquire` calls from one user for one listing → 1 conversation, 1 enquiry row, `enquiry_count = 1`; parallel `accept` over capacity; message idempotency through `clientMsgId`; SSE delivery within 2 s (Playwright two contexts). |
| Location/privacy (AC-22, 23) | Handler rejects lat/lng fields; DB catalogue test asserts no column named like `lat|lng|latitude|longitude` exists; bucketing function; export ZIP content; deletion anonymisation and released username. |
| Billing (AC-24…27) | Webhook valid/invalid/replayed signatures (locally computed HMAC), idempotency, refund over-cap prevented under concurrency, approval flow, null-provider behaviour. Promotion token forgery rejected; click before impression rejected; analytics totals equal rows. |
| Admin/config (AC-28…35) | For each admin route: loads with the seeded permitted role, 404 for a user lacking permission, writes `permission_denied`; every mutation yields one audit row in the same transaction (rollback test: failed action leaves no audit row); `UPDATE/DELETE` on audit/security tables as `nargito_app` fails; flag-off blocks route and action; maintenance mode; manifest reflects settings; translation edit visible; CMS publish/rollback; robots toggles; integrations page lists env names but never values. |
| Brand/PWA/layout (AC-36…41) | `generate-brand-assets` output dimensions/alpha channel/aspect ratio asserted with sharp metadata; lock-check failure test; header has exactly one logo image + one wordmark; viewport tests at 1280/800/390/320; theme persistence without flash (first paint class); SW cache inspection (§15). |
| Quality (AC-42…46) | CI pipeline itself; header presence test (CSP nonce present and unique per request); fresh-clone script in CI (`migrate → seed → bootstrap → start`). |

Coverage gate: ≥ 80% lines for `src/modules/**/{policy,service}.ts` and `src/server/**` on the integration + unit run. Gates are enforced in CI. No snapshot tests for pages.

### 20.3 What cannot be verified without credentials or services
Live behaviour of Google/Facebook OAuth, SMTP delivery, Twilio SMS, S3-compatible providers other than MinIO, Razorpay (checkout, webhooks from the real service, refunds), Web Push delivery to real browsers' push services, Anthropic, Sentry ingestion, and real-device PWA install. These are covered by stubs, contract tests and the in-app “Test connection”, and are listed in the delivery report as **not live-verified**.

## 21. Input validation and edge cases

### 21.1 Validation rules for external inputs
Rules are enforced twice: Zod in the action (user-facing errors) and `CHECK` constraints in the database (§11) for the same limits. Required means a missing/empty value returns `VALIDATION` with the field path. Strings are trimmed and NFC-normalised, and control characters except `\n` are rejected.

| Input | Rule |
|---|---|
| email | required for email auth; RFC-5322 subset by Zod `.email()`, ≤254, lower-cased |
| phone | required for phone auth; E.164 after `libphonenumber-js` parse and validity check |
| password | 10–128 chars, not on deny-list, not equal to email/username |
| username | 3–30, `[a-z0-9_.]`, no leading/trailing `.`/`_`, no `..`, not in the reserved list (admin, api, support, nargito, settings, …) |
| display name | 1–80 |
| post body | ≤3,000 (required unless media, trip or share) |
| comment | 1–2,000 |
| message | 1–4,000 or attachments; `clientMsgId` UUID |
| enquiry message | 1–2,000 |
| listing title/description/price | §10.5 |
| slug | server-generated, never accepted from the client except in admin CMS (`^[a-z0-9-]{1,80}$`) |
| URLs | `https` only, ≤500, parsed with `URL`, host not an IP literal/localhost |
| file upload | §10.1 |
| geohash | `^[0-9b-hjkmnp-z]{4,5}$` |
| search q | 2–100 after trim |
| cursor | base64url JSON, Zod-validated shape |
| limit | integer 1–50 (admin 1–100); default 20 |
| report details | ≤1,000 |
| admin reason fields | required, 5–300 chars for suspend/ban/refund/override |
| JSON settings values | per-key Zod schema from the registry |
| IDs | UUID format; any non-UUID → `NOT_FOUND` for reads, `VALIDATION` for writes |
| webhook body | raw body ≤1 MB, signature first, then JSON parse and Zod |
| SSE / beacon payloads | size ≤ 2 KB, Zod |

### 21.2 Edge cases covered by the design
- Double-submit and retries: `clientMsgId`, `ON CONFLICT` upserts, unique indexes, and webhook idempotency make the writes safe to repeat.
- Content whose author is suspended or deleted: hidden from feeds and search, shown as tombstone in threads, and the account's listings are moved to `archived` on suspension.
- Listing deleted after an enquiry: the conversation keeps the snapshot card (§10.6).
- Owner transfers or leaves: the single-owner partial unique index forces an atomic swap. Leaving as the sole owner is refused.
- Blocking after a conversation exists: the conversation is hidden from both inboxes and sends are refused. Unblocking restores it.
- Visibility narrowing (public → connections) on a post with shares: reposts of it are set to `under_review` with reason `source_restricted` and hidden from feeds (they cannot widen access).
- Time: all server timestamps UTC; user-facing dates use the user's locale and the trip's `timezone` for trip dates.
- Hindi/Devanagari input: lengths are counted in Unicode code points by Zod `.max()` (not grapheme clusters). The DB `char_length` counts code points, so the two agree.
- Clock skew across instances can reorder UUIDv7 by a few ms; acceptable for feeds, not relied on for correctness.
- Redis outage: §7.2.
- A deploy while SSE connections are open: clients reconnect (3 s `retry`) and refetch.
- Maintenance mode never blocks admin sign-in or `/api/health`.

## 22. Build order (all of it is in scope)

This is a dependency order for one delivery, not a list of deferrable phases. Every item below is built and tested.
1. Scaffold: Next 15 + TS strict + Tailwind v4 + lint/boundaries/colour/i18n rules, tokens, fonts, `BrandLogo`, brand asset generation and lock, env/integration config.
2. Database: schema (§11), migrations, roles, triggers, seed, test harness.
3. Server kernel: `defineAction`/`defineRoute`, errors, logger, rate limit, settings/flags, audit.
4. Auth + RBAC + admin shell (`requireAdmin`, MFA enrolment, step-up) + bootstrap command.
5. Identity/profile, media pipeline, graph, content (posts, feed, comments, reactions, bookmarks, shares), moderation.
6. Business pages, marketplace, enquiries + messaging + realtime, notifications (+ email, push).
7. Trips, groups, search, nearby/location.
8. Promotions, billing/payments (provider-gated), privacy export/deletion.
9. Remaining admin pages, CMS, i18n admin, SEO, redirects, integrations/health/jobs pages.
10. PWA (manifest, SW, offline, install), email templates, responsive polish, accessibility pass.
11. Playwright suites, docs, Docker/CI, final verification report that lists what was and was not verified.

## 23. Responses to design-review findings
None yet: this is the first iteration (`design-review.json` does not exist). On a revision, this section will list each finding with the decision to address, backlog (with reason) or reject (with justification).

