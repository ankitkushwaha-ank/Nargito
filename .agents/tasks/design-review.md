# NARGITO Design Review (iteration 1)

Reviewed: `.agents/tasks/design.md` (requirements, 46 ACs) and `.agents/tasks/tech-design.md` (23 sections, ~1,250 lines), read in full.
Repository state checked: `e:\nargito` holds `.gitignore`, `Assets/` (3 PNGs), an empty `docs/` and `.agents/`. There are no commits and no `node_modules`, so nothing could be checked against library source.

Not verified: the user's brief is truncated after "Desktop Layout". The design says so itself (Assumption 1). Anything the brief requires after that point, including the "entity list" behind "69 tables", could not be checked.

## Verdict: CHANGES_REQUESTED

Count: 4 HIGH, 15 MEDIUM, 10 NIT. Any HIGH or MEDIUM blocks, so this is not approved.

The design is strong on most review targets. See "Checklist outcome" at the end. The blockers are concentrated in five places: the test strategy cannot run as written, the mutation pipeline has an ordering bug that voids its locking, the `users` table contradicts the onboarding and Better Auth flows, the account deletion path violates its own CHECK constraint, and several framework-level claims (Better Auth, Next.js routing, Postgres generated columns) are wrong or unverified.

---

## Findings

### HIGH

**1. HIGH. The testing strategy is not runnable as written: e2e runs in production mode, which refuses the test transports and in-memory Redis it needs.**
Where: §4.1 (`REDIS_URL` "Production refuses to boot without it"), §4.3 rule 2 (test transports refused when `NODE_ENV=production`), §17, §20.1 (e2e "against `next build && next start`"), §20.2 (Auth row reads the email from the outbox), design.md AC-1, AC-21, AC-42.
Problem:
- `next start` always runs with `NODE_ENV=production`. Under the design's own rules, `MAIL_TRANSPORT=file`, `SMS_TRANSPORT=file`, `STORAGE_TRANSPORT=memory` and the in-memory Redis fall back would all be refused at boot. The Playwright flows that read verification emails and OTPs from `.tmp/outbox/` therefore cannot start.
- The dev machine has no Docker, `psql` or Redis (verified). `docker-compose.yml` and "Redis + MinIO + Mailpit services" are CI-only. Locally, e2e can only run if the in-memory adapters are allowed, which contradicts the first point.
- The web process and the worker are separate processes (§1, §18). An in-memory `RedisLike` pub/sub does not cross processes. `notification.fanout` runs in the worker and publishes to `user:<id>`, but SSE streams live in the web process, so no notification would reach the browser without real Redis. Only message sends (published from the web process) would work.
Fix:
- Introduce `APP_ENV` (`development | test | staging | production`) separate from `NODE_ENV`. Test transports and the in-memory limiter are refused only when `APP_ENV=production`. e2e runs `next build && next start` with `APP_ENV=test`. `.env.test.example` documents this.
- When `REDIS_URL` is unset and `APP_ENV != production`, use a `PgNotifyBus` (Postgres `LISTEN/NOTIFY`) for pub/sub, so web and worker share it. The in-memory limiter and cache are acceptable per process.
- Add a "what runs where" table to §20. Local Windows: unit, component, integration (embedded-postgres), and e2e tagged `@local` (no uploads, no Redis-only assertions). CI: everything. Specs that need MinIO or Redis must be reported as skipped, never passed (§17 already says so for uploads, so extend that rule).
- Add `.tmp/` and `dist/` to `.gitignore`. `.tmp/outbox` and `dist/worker.js` are not currently ignored.

**2. HIGH. Mutation pipeline (`defineAction`) runs `authorize()` with `SELECT … FOR UPDATE` before the transaction opens, so the row locks do nothing. The rate limit also runs after DB work.**
Where: §7.1 steps 4, 5, 7; AC-17, AC-20, AC-18.
Problem:
- Step 4 loads the target "`SELECT … FOR UPDATE` when `run` will mutate it". The transaction only starts at step 7. Outside a transaction the lock is released as soon as the statement ends. Every flow that depends on this ordering (listing transitions, trip participant cap, refund cap) loses its serialisation. The flows in §10.5 and §10.7 describe their own `FOR UPDATE`, but the contract in §7.1 says the lock is taken by `authorize`, so the two disagree.
- Step 5 (policy rate limit) runs after validation and after the resource has been loaded and locked. An abusive caller can force row loads and lock waits before ever being limited. The only protection is the coarse per-IP pre-step, which is deliberately large (300/min).
- The signature `authorize?: (ctx, input) => Promise<Resource>` has no `tx` parameter, so it cannot take part in the transaction.
Fix: replace the order with:
```
0 pre-step: origin check, maintenance, ip.mutations
1 authenticate
2 capability: feature, permission, stepUp
3 rate limit (policy key; identifier-keyed auth policies use the normalised raw identifier)
4 validate (Zod)
5 BEGIN tx   -> authorize(ctx, input, tx)   // SELECT ... FOR UPDATE here
6 approval gate (insert approval row, COMMIT, return APPROVAL_REQUIRED) | run(ctx,input,resource,tx)
7 audit(tx) -> COMMIT -> after()
```
and change the signature to `authorize?: (ctx, input, tx) => Promise<Resource>`. Add an integration test that fails if `authorize` is invoked outside a transaction.

**3. HIGH. The `users` table contradicts the onboarding and Better Auth sign-up flows (username, name, email, phone, baseline role).**
Where: §9.2 (`/onboarding`: "A signed-in user without a username is redirected here"), §11.2 `users`, §6.1 (phone OTP "adds `users.phone_number`"), §8.2 ("`member` assigned in the same transaction as user creation").
Problem:
- `username text` has no `null` marker, and the doc's rule is "NOT NULL is the default". Better Auth creates the row at sign-up, before onboarding, so the insert fails or needs a fake username. This contradicts the onboarding redirect.
- `name text (1–80)` is NOT NULL, but phone-only sign-up has no name.
- `email` is nullable here, but Better Auth's core user model treats `email` as a required string, and its phone plugin needs a temp-email callback for phone-first sign-up. The design assumes null emails work and never says so.
- Assigning `member` "in the same transaction as user creation" requires Better Auth to run its create hook inside the same transaction. That is not established. If the hook fails or runs after commit, the user has no permissions at all (the baseline set lives in that role).
Fix:
- `username text null` with `CK (username IS NULL OR username ~ '^[a-z0-9_.]{3,30}$')` and `UQ (lower(username)) WHERE username IS NOT NULL`. Add `CK (username IS NOT NULL OR onboarding_completed_at IS NULL)` is not possible across tables, so state it as a service invariant plus an integration test.
- `databaseHooks.user.create.before` fills `name` (provider name, else "Nargito member"). For phone-first sign-up, configure `phoneNumber({ signUpOnVerification: { getTempEmail, getTempName } })`, store the placeholder email under the reserved domain `phone.nargito.invalid`, and have the mailer refuse that domain. Keep the DB column nullable (it must be, for deleted rows).
- Do not rely on a hook for the baseline role. Define `computeEffectivePermissions` as "union of the `member` role's permissions for every `status='active'` user" plus `user_roles` plus overrides. The `user_roles` row for `member` becomes optional.

**4. HIGH. Account anonymisation writes tombstone values that violate the table's own CHECK constraints, so AC-23 cannot pass.**
Where: §5.2 rule 7 ("`email/phone/username` replaced by tombstone values (`deleted-<id>`)"), §11.2 `users` CHECKs, §10.15, design.md AC-23.
Problem: `deleted-<uuid>` is 44 characters and contains `-`. `ck_users_username` requires `^[a-z0-9_.]{3,30}$`, so the UPDATE is rejected and `deletion.process` fails at its first step. The phone CHECK `^\+[1-9][0-9]{7,14}$` rejects the same string. Only the email column has no format check.
Fix: do not use tombstone strings. On anonymisation set `email = NULL`, `phone_number = NULL`, `username = NULL` (nullable per finding 3), `name = 'Deleted user'`, `status = 'deleted'`, `anonymized_at = now()`. The existing `CK (email IS NOT NULL OR phone_number IS NOT NULL OR status='deleted')` already allows this. Public pages render "Deleted user" when `status='deleted'`. Add an integration test that runs the real anonymisation against the real constraints.

### MEDIUM

**5. MEDIUM. Admin idle timeout and the 12-hour cap are not implementable as specified.**
Where: §6.3 step 4, §4 `auth.admin_session_hours`.
Problem: idle timeout is measured with `sessions.updated_at`, but Better Auth only touches that column when it refreshes the session (`updateAge`, 24 h). Nothing updates it on activity, and §6.3 says the admin layout "does not slide the session", so idle detection will never trigger within 30 minutes. Also, step 4 says "`step_up_at` older than 12 hours → redirect to step-up". That is not a cap: the admin steps up again and carries on forever. The text also calls the 12 hours an "absolute" cap, which conflicts with this.
Fix: add `sessions.last_active_at timestamptz`. `requireAdmin` runs `UPDATE sessions SET last_active_at = now() WHERE id=$1 AND last_active_at < now() - interval '60 seconds'`. The idle check uses it (30 min). The absolute cap is `now() - sessions.created_at > auth.admin_session_hours` and revokes the session (a full sign-in is needed). Step-up (`step_up_at`) only governs the 15-minute sensitive-action window. Add tests for each.

**6. MEDIUM. Better Auth capabilities that the admin and OTP requirements depend on are asserted but unverified, and verification is deferred to "the scaffold step".**
Where: §1 Versions paragraph, §6.1, §6.3 (step-up).
Problem:
- Step-up calls "the Better Auth TOTP verify API" for an already signed-in session. The plugin's verify endpoints are built for the sign-in 2FA challenge (pending-2FA cookie). Whether they accept a normal session is unconfirmed. AC-9 and the whole admin hardening story rest on it.
- The 60-second phone OTP resend cooldown (AC-2) is not a documented plugin option that I could confirm. The per-identifier limits in §7.4 (`auth.otp.send` per phone/email) do not map onto the plugin's per-IP+path limiter.
- Cookie writes from Server Actions need the Next cookies plugin. It is not mentioned.
The design says option names "are verified in the scaffold step" but also says "the stack is locked on approval". Behaviour that can fail the admin security model should not be left to discovery.
Fix: add a "Better Auth capability matrix" to §6.1 with a decision per row, and require a spike test in build step 1 that must pass before step 4:
- Step-up: if `verifyTOTP` rejects an authenticated session, verify with `otplib` against the secret decrypted using Better Auth's exported crypto helper and `BETTER_AUTH_SECRET`, and verify backup codes through the plugin.
- Cooldown: enforce in the `sendOTP` callback with a Redis key `otp:cd:<identifier>` (60 s).
- Per-identifier limits: enforce in `hooks.before` (see finding 7).
- Register `nextCookies()` as the last plugin.

**7. MEDIUM. Better Auth endpoints bypass `defineRoute`, so feature flags, maintenance mode, signup toggle and the §7.4 rate-limit policies are not enforced on them.**
Where: §9.6 (`/api/auth/[...all]` "Plugin rate limits plus §7.4"), §16.1 (only `auth.signup_enabled` has a hook), §16.2 enforcement points, AC-30, AC-3, AC-2, §21.2 ("Maintenance mode never blocks admin sign-in").
Problem: every enforcement point listed in §16.2 is `defineAction`/`defineRoute`/layouts/nav/jobs. Sign-in, OTP send, social sign-in and password reset all go through Better Auth's catch-all handler. As written, `phone_login=false` or `social_login_google=false` is only a hidden button, which is exactly what the brief says not to rely on. It is also unclear whether maintenance mode blocks non-admin sign-in (AC-30 "all non-admin mutations return 503") while admin sign-in must work (§21.2), and whoever signs in is not yet known to be an admin.
Fix: add a `src/modules/auth/endpoint-policy.ts` table keyed by Better Auth path, consumed from one `hooks.before` function:
```
/sign-up/*               -> flag auth.signup_enabled, maintenance blocks, policy auth.signup
/sign-in/email           -> policy auth.signin            (allowed in maintenance)
/sign-in/phone-number, /phone-number/send-otp -> flag phone_login, integration sms, policy auth.otp.send
/sign-in/social          -> flag social_login_<provider>, integration oauth
/forget-password, /reset-password -> policy auth.reset
/two-factor/*            -> policy auth.stepup            (allowed in maintenance)
```
Rule: maintenance mode blocks sign-up, OTP send for unknown identifiers and social first-time sign-in. It allows sign-in and sign-out for everyone, and then blocks every other non-admin mutation. Add a test that enumerates `auth.api` endpoints and fails if any path is missing from the table.

**8. MEDIUM. The four-eyes approval flow is internally inconsistent and can dead-lock small teams.**
Where: §7.1 step 6 ("re-enters at step 7") vs §8.4 ("re-runs the action through steps 1–9 … as the requester's identity").
Problem:
- Two incompatible semantics are stated. Re-entering at step 7 skips authorization and validation of the stored payload. Re-running 1–9 "as the requester" runs `stepUp: 'recent'` against a session that is not present at approval time, so every sensitive approved action fails with `STEP_UP_REQUIRED`.
- Approver eligibility is "`approvals.review` plus the action's own permission". `rbac.manage` is held only by `super_admin`, and `refunds.issue` only by `finance` and `super_admin` (§8.4 matrix). A deployment with a single super admin can never grant `super_admin` or process a refund. Nothing documents a path out.
Fix:
- Define execution as: re-enter at step 4 (validate) and step 5 (authorize in a transaction) with the stored input under `ctx = requester`, skip steps 2 (step-up and approval gate), and re-check that the requester still holds the permission. Store `requester_step_up_at` in the approval and require it ≤ 15 minutes old at request time. The approve/reject action itself is a `defineAdminAction` requiring `approvals.review` and fresh step-up.
- Add to §8.4 and `docs/OPERATIONS.md`: "Four-eyes needs ≥ 2 accounts holding the permission. `admin:bootstrap --email <e> --role super_admin` is the sanctioned way to add a second approver." The `/admin/approvals` page must show an explicit "no eligible approver" state.

**9. MEDIUM. Connection requests: the unique pair index conflicts with the re-send, withdraw and remove rules, and the lifecycle is unspecified.**
Where: §10.4, §11.3 (`ux_user_connections_pair` on `least/greatest`), `connection_status` enum (pending, accepted, declined, withdrawn).
Problem: one row per unordered pair is the right constraint, but §10.4 says "A declined request can be re-sent after 30 days" and `INSERT … ON CONFLICT DO NOTHING`. With a unique pair the second insert silently does nothing, so re-sending, re-sending after withdraw, re-requesting after removal, and a reverse request after decline cannot work. The design never says what "remove connection" does to the row, or which timestamp the 30 days are measured from.
Fix: add a transition table to §10.4:
```
no row                      -> INSERT pending (requester = me)
pending, same direction     -> no-op, return existing (idempotent)
pending, reverse direction  -> accept (status=accepted, responded_at=now)
accepted                    -> CONFLICT
declined/withdrawn          -> allowed if now()-responded_at >= 30d (declined) or immediately (withdrawn):
                               UPDATE set requester_id/addressee_id = me/target, status=pending,
                               message=$m, responded_at=NULL, updated_at=now()
remove connection / block   -> DELETE the row (and re-compute connection_count in the same tx)
```
Use `INSERT … ON CONFLICT ON CONSTRAINT`-style handling written as the explicit expression target `(least(requester_id,addressee_id), greatest(requester_id,addressee_id)) DO UPDATE … WHERE`, and add a concurrency test (A→B and B→A in parallel yields one accepted row).

**10. MEDIUM. Business listings route enquiries to one member only; the business workspace "Enquiries" page cannot read or reply, and `enquiry_status` transitions are undefined.**
Where: FR-6 ("business workspace gives access to … enquiries"), §9.4 (`/business/shops/[slug]/enquiries`, editor role may see enquiries), §10.6 (conversation between enquirer and `owner_id`), §11.9 `conversation_participants`, §11.7 `listing_enquiries`, `enquiry_status` enum.
Problem: listing owner may be a shop or company (§10.5), but `listing_enquiries.owner_id` and the two `conversation_participants` rows are the acting `seller_id`. Other owner/admin/editor members have no access to the conversation, so the workspace page can show a count at best. If the seller leaves the business, enquiries become unreachable. `enquiry_status` (open/replied/closed/spam) has no transition rules and no actor.
Fix:
- Add `shop_id` and `company_id` (nullable, `CK num_nonnulls <= 1`, FK `ON DELETE SET NULL`) to `listing_enquiries` and to `conversations`, with `IX (shop_id, last_enquired_at desc)` and `IX (company_id, …)`. Snapshot them from the listing at enquiry time.
- `canAccessConversation(ctx, conv)` = participant OR active member (owner/admin/editor) of `conv.shop_id`/`conv.company_id`. Replies by a business member are stored with that member as `sender_id`.
- `enquiry_status`: `open` → `replied` automatically when an owner-side message is sent; `closed` and `spam` set by owner or business member through `marketplace.setEnquiryStatus`. `spam` also creates a `content_reports` row. Add these to the state-machine unit tests.

**11. MEDIUM. `business_verification_requests.document_media_ids uuid[]` has no referential integrity and no GC protection (also affects the "normalized schema" requirement).**
Where: §11.7, §10.1 step 4 (`media.gc` purges assets "never attached after 48 h"), §11.5 attachment rule.
Problem: documents are referenced only through an array. Nothing calls `attach()` for them (the attach rule is described for posts, listings and similar), so `attached_at` stays NULL and `media.gc` can delete a document while the request is still `pending` or `needs_info`. An array column cannot enforce FKs, so deleted or foreign assets can sit in it. The only guard is a note that "service verifies".
Fix: add a join table `business_verification_documents(request_id → business_verification_requests (c), media_id → media_assets, position smallint, PK (request_id, media_id), IX (media_id))` and justify it in §11 the same way as `media_assets`/`two_factor` (update "69 + 2" to "69 + 3"). `attach()` sets `attached_at` for these rows. `media.gc` also skips any asset referenced by that table. Keep the `1..5` limit as a service rule and a deferred trigger-free check in tests.

**12. MEDIUM. `user_profiles.search_tsv` as a generated column will fail to migrate: `array_to_string` is not immutable.**
Where: §11.2 `user_profiles` (`search_tsv` generated from `headline || bio || array_to_string(skills,' ')`), §5.4, §11.14.
Problem: PostgreSQL requires generation expressions to be immutable. `array_to_string` is marked STABLE, so `CREATE TABLE`/`ALTER TABLE … GENERATED ALWAYS AS` is rejected ("generation expression is not immutable"). Separately, `headline || bio` yields NULL when either side is NULL, so profiles with only a headline are never indexed. (I confirmed this from PostgreSQL's catalogue behaviour, not by running it, because there is no Postgres in this environment. Finding 1 gives the harness that will prove it.)
Fix: write the expression with an immutable SQL wrapper in a hand-written migration and null-safe concatenation:
```sql
CREATE FUNCTION nrg_immutable_join(text[], text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT array_to_string($1, $2) $$;
-- search_tsv GENERATED ALWAYS AS (to_tsvector('simple',
--   coalesce(headline,'')||' '||coalesce(bio,'')||' '||coalesce(nrg_immutable_join(skills,' '),''))) STORED
```
Add a test that applies every migration to a clean Postgres 16 and runs `\d`-equivalent checks for each `search_tsv` column. Also list `name` in this vector or state that name search uses the `lower(name)` prefix index only (§10.14 says both).

**13. MEDIUM. "Nearby" lets any member locate other members' cells by sweeping arbitrary geohash queries; there is no rule that cells never appear in responses.**
Where: §10.12, §10.2 (Nearby tab), §9.3 `/nearby` ("Nearby people"), §11.2 (`ix (geohash5, user_id) WHERE location_sharing='area'`), AC-22.
Problem:
- The API accepts a client-supplied `geohash5` and returns users in that cell plus 8 neighbours with a bucketed distance. The client cannot be trusted to send its own cell, and nothing ties the query cell to the viewer. An attacker can query any cell and see who is there, then repeat across cells to find the cell of a named user. The 5 km bucketing doesn't help because the attacker chooses the reference point.
- No rule says response DTOs must omit `geohash4/5` for users and posts. `posts.geohash5` is stored per post; leaking it per author pins that author's cell.
- The cell is sent as a query parameter (`/api/feed?…&geohash5=`), so it appears in proxy access logs and Sentry URLs, although §14.3 says location routes "log nothing but route and status".
Fix:
- For people results, ignore any client cell. Use the viewer's own stored cell (`location_sharing='area'`), and require that the viewer has also opted in (reciprocity). Client-supplied cells are accepted only for non-person entities (listings, trips, businesses).
- Add policy `nearby.query` (30/hour per user) and a `nearby.min_cohort` setting (default 3): people results are returned only when at least that many opted-in members are in the 9-cell area.
- Add a rule and a unit test: no DTO type exported from `modules/*/index.ts` contains a property matching `/geohash/i`. Distances are only the bucket enum.
- Send cells in a header (`X-Cell`) or POST body for `/api/feed` and `/api/nearby`, and strip query strings in the access log and Sentry `beforeSend` for these routes.

**14. MEDIUM. Next.js routing details are infeasible: catch-all outside any root layout, 301/302 redirect codes, and `sitemap.xml` index.**
Where: §2 layout (`app/[...rest]/page.tsx`), §9.1 (`/[...rest]`, `/sitemap.xml` "index split per entity type"), §16.4/16.5, `redirects.status_code CK in (301,302,307,308)`, AC-33.
Problem:
- The repo uses two root layouts (`(site)/[locale]` and `admin`). In that setup every `page.tsx` must live under a layout that renders `<html>`. A page at `app/[...rest]/page.tsx` has none, which Next rejects at build time. In addition, next-intl's middleware rewrites unprefixed paths to `/en/...`, so a root-level catch-all would never receive them. Redirect lookup has to live in `(site)/[locale]/[...rest]/page.tsx`.
- `redirect()` in a page emits 307 (and `permanentRedirect()` emits 308). A Server Component cannot return 301 or 302. The stored codes 301/302 are unusable.
- `app/sitemap.ts` with `generateSitemaps()` produces `/sitemap/[id].xml` files and does not produce a `/sitemap.xml` index. (Stated from Next.js documented behaviour; not checkable here because nothing is installed. The design should not rely on either reading.) AC-33 ("Published pages are in `sitemap.xml`") and §9.1 both name `/sitemap.xml`.
Fix:
- Move the catch-all to `src/app/(site)/[locale]/[...rest]/page.tsx`.
- Restrict `redirects.status_code` to `CK in (307, 308)`, mapping "temporary" and "permanent". Update §16.5 and the admin form.
- Add `src/app/sitemap.xml/route.ts` that renders a `<sitemapindex>` pointing at each `/sitemap/<id>.xml`, and drop the claim that `generateSitemaps` creates the index. Add `/sw.js`, `/manifest.webmanifest`, `/brand/*`, `/robots.txt`, `/sitemap*` to the explicit middleware matcher exclusions so next-intl does not rewrite them.

**15. MEDIUM. Cache invalidation is single-instance only for i18n overrides, CMS pages and feature flags, while the design requires multi-replica operation.**
Where: §16.3 (`unstable_cache` tag `i18n`), §16.4 (`revalidateTag cms:<slug>`), §16.2 (no caching rule stated for flags), §19 scaling ("web is stateless; run ≥ 1 replicas"), AC-32, AC-33, AC-30.
Problem: `revalidateTag` and `unstable_cache` use the Next data cache of the instance that executed the action. With `output: 'standalone'` and several replicas, the other replicas keep serving stale translations and CMS content until they restart. Settings alone got a pub/sub invalidation (§16.1), the others did not.
Fix: pick one mechanism and state it. Recommended: reuse the settings pattern for translations, CMS published revisions and feature flags (in-process TTL 60 s plus Redis pub/sub `invalidate:<namespace>`), and use `unstable_cache` only for non-user-visible aggregates. Alternatively configure a Redis-backed Next `cacheHandler` with `cacheMaxMemorySize: 0`. Add the bound "visible on all replicas within 60 s (pub/sub: within 2 s)" to AC-30, AC-32, AC-33 and add a test with two app instances sharing Redis.

**16. MEDIUM. Payments: the CSP blocks Razorpay Checkout, and the client checkout/confirmation flow is not defined.**
Where: §14.1 CSP string, §10.10, §10.11, AC-24..27.
Problem: the CSP has `default-src 'self'` and no `frame-src`, and `connect-src` omits Razorpay, so Checkout (script, iframe, XHR) will be blocked. The doc defines order creation and the webhook but not what the browser does between them: how the client receives the order, what it does with Checkout's `razorpay_payment_id/order_id/signature` callback, and what the UI shows until the webhook arrives. Without a rule, an implementer may show "paid" on the client callback, which the doc prohibits elsewhere ("never optimistically").
Fix: add to §10.11 and §14.1:
- CSP is composed from enabled integrations. When Razorpay is configured: `script-src … https://checkout.razorpay.com` (loaded by a nonced loader so `strict-dynamic` applies), `frame-src https://api.razorpay.com https://checkout.razorpay.com`, `connect-src … https://api.razorpay.com https://lumberjack.razorpay.com`. Verify the exact origins against Razorpay's current docs at implementation and record them in `docs/INTEGRATIONS.md`.
- Flow: `checkout` action returns `{orderId, keyId, amount, currency}`; client opens Checkout; the callback posts `{orderId, paymentId, signature}` to `billing.confirm`, which verifies `HMAC_SHA256(orderId|paymentId, RAZORPAY_KEY_SECRET)` only to record `payments.provider_payment_id` and set a `confirming` UI state. Status changes to `succeeded` only on the webhook. The UI polls `payments.status` for up to 60 s and then shows "We are still confirming your payment", never "paid".
- Add a CSP test that includes the Razorpay origins only when configured.

**17. MEDIUM. The "configuration required" UX is inconsistent across integrations: some are "hidden", some "disabled", and FR-21 requires visible states.**
Where: §4.2 table (Phone: "hidden/disabled"; Web Push: "toggle hidden"; AI: "hidden"; Email: "show configuration required"), design.md FR-2, FR-21, AC-2, AC-3.
Problem: FR-21 says missing integrations show "configuration required" and their feature is disabled. AC-3 says Google/Facebook "show configuration required". The table says phone login is "hidden/disabled", Push is "hidden", AI hints are hidden. Hidden is not the same as disabled-with-message, and "hidden/disabled" has two valid readings. Tests and UI will diverge.
Fix: replace the "When absent" column with a single rule plus an exceptions list: every user-facing surface of an unconfigured integration renders `<ConfigurationRequired integration="…" />` in a disabled state, for every viewer. The only exception is `ai_assist` and Sentry, which render nothing for non-admin viewers; admins see the disabled state on `/admin/integrations`. State "phone login: visible, disabled, tooltip + inline text" explicitly, and make AC-2/AC-3 match. Also fix the OAuth "Test connection" wording: a config-presence check must store `{ok:null, detail:'not live-verified'}`, never `ok:true`, so the UI cannot show Google/Facebook as verified.

**18. MEDIUM. The contrast unit test as specified contradicts the tokens: `--border` and `--input` fail the 3:1 rule the test asserts.**
Where: §12.1 ("≥ 3:1 for ring and border-on-surface UI pairs"), tokens `--border #E5EAF2`, `--input #D5DCE8`, dark `--input #33415C`; design.md AC-38, WCAG 2.2 AA target (1.4.11).
Problem: I computed the ratios. `--border` on white = 1.21:1, `--input` on white = 1.38:1, dark `--input` on `#151E30` = 1.63:1. The stated test would fail on day one. If the test is loosened, input boundaries (which are the only indicator of a text field's extent) fail WCAG 1.4.11. The design's other contrast figures are correct (white on primary 5.09, primary on tint 4.46, primary-hover on tint 6.40, muted on white 4.97, dark link on surface 6.39).
Fix:
- `--border` (given in the brief) is decorative: used only for cards and dividers, and excluded from the 3:1 test. Say so.
- Form control boundaries (inputs, selects, textareas, checkboxes, switches) use `--input`. Change light `--input` to `#7C879B` (3.62:1 on white, 3.44:1 on `#F7F9FC`) and dark `--input` to `#6F7FA3` (4.16:1 on `#151E30`, 4.70:1 on `#0B1120`).
- The test asserts `--input` and `--ring` ≥ 3:1 against `--surface` and `--background` in both themes, and text pairs ≥ 4.5:1.

**19. MEDIUM. The worker process runs with the migrator (DDL/owner) database URL, which breaks the least-privilege and append-only guarantees.**
Where: §18 (pg-boss uses `PGBOSS_URL` "falling back to `DATABASE_MIGRATE_URL`"), §11.13 immutability, §11.15 roles, AC-29.
Problem: `nargito_migrator` owns the schema. A long-running process with that role can `ALTER TABLE … DISABLE TRIGGER` or write directly to `admin_audit_logs`, bypassing the immutability triggers and the `REVOKE`s that AC-29 tests for the app role. The worker also runs user-influenced work (media processing of uploaded files, export building), so it is exposed to untrusted input.
Fix: run pg-boss schema creation once in `db:migrate` (migrator URL, `new PgBoss({migrate: true}).start()` then stop). The worker starts pg-boss with `migrate: false` and uses `DATABASE_URL` (`nargito_app`), with `GRANT USAGE ON SCHEMA pgboss` and DML on `pgboss` tables to `nargito_app` in `0001_roles.sql`. Remove `DATABASE_MIGRATE_URL` from the worker's environment in `docker-compose.prod.example.yml`. Add a test that the worker env validator rejects a present `DATABASE_MIGRATE_URL`.

### NIT

**20. NIT. Lint rule for role labels will false-positive on business roles.** §8.2 bans `role ===` patterns in `src/**`, but `company_members.role` and `group_members.role` have values named `admin`/`owner` and are compared in `business/policy.ts`. Fix: replace the pattern lint with "only `modules/rbac` may import `roles` and `user_roles` tables" (boundaries rule) and keep the AC-7 behavioural tests as the real guard.

**21. NIT. Razorpay event id source is not named.** §10.11/§11.11 key idempotency on `provider_event_id` but the doc never says where it comes from. Fix: state "from the `X-Razorpay-Event-Id` header; if absent, reject with 400 and store `signature_valid=true, provider_event_id=NULL, processing_error='missing_event_id'`". Also note `ON CONFLICT` against the partial unique index must repeat the `WHERE signature_valid` predicate (Drizzle `targetWhere`).

**22. NIT. Audit `redact()` regex is over-broad.** `/pass|secret|token|totp|otp|key|hash/i` also redacts `key` (setting keys, flag keys, permission keys), so audit diffs of `site_settings` and `feature_flags` would show `"[redacted]"` for the subject. Fix: match whole key names (`^(password|passwordHash|secret|token|accessToken|refreshToken|totpSecret|otp|backupCodes|apiKey|authSecret)$`) and test that `key` survives.

**23. NIT. `permission_denied` security events are written on every admin 404 without sampling.** A signed-in member can generate unlimited rows by requesting `/admin/*`. Fix: apply the §7.2 sampling (1 in 10 per user per minute) to `permission_denied` and cap at 60 rows/user/hour.

**24. NIT. `conversations.pair_key` duplicates participant data.** `pair_key` text can drift from `conversation_participants`. Fix: store `user_low_id`/`user_high_id` (FK → users, `CK user_low_id < user_high_id`) and make the unique index `(context_key, user_low_id, user_high_id)`. The `kind` column (always `'direct'`) can be dropped.

**25. NIT. Reaction types are stored but only one counter exists.** `post_reactions.type` has four values, `posts.like_count` is a single total, and the UI will need a per-type breakdown. Fix: state that the breakdown comes from `GROUP BY type` on `ix_post_reactions_post_id_type` (cached 30 s for hot posts) and rename `like_count` to `reaction_count`.

**26. NIT. Dependencies, env vars and a few conventions are used but not declared in the locked tables.** `msw`, `tsup`, `png-to-ico`, `libphonenumber-js`, `next-themes`, `otplib` (if finding 6 applies), `eslint-plugin-i18next`, `eslint-plugin-boundaries` are not in §1; `HEALTH_TOKEN`, `ADMIN_ALLOWED_CIDRS`, `PGBOSS_URL`, `BACKUP_AGE_RECIPIENT`, `S3_PUBLIC_BASE_URL` appear only in prose; the Zod major is "whichever Better Auth requires". Fix: add them to §1/§4 and pin the Zod major explicitly (and the matching `@hookform/resolvers` version).

**27. NIT. Public media can outlive a visibility narrowing.** §10.1 step 5 moves objects asynchronously (`media.reconcile`), and public objects are CDN-cached. A post changed from public to connections stays reachable by URL until the job runs and the CDN expires. Fix: on narrowing, set `media_assets.visibility='restricted'` synchronously, so `/api/media/*` stops serving it, and send a CDN purge (or use a short `max-age` on public media, e.g. 1 h) with the job doing only the object move.

**28. NIT. Small contract gaps in `defineAction`/`defineRoute`.** `defineAdminAction` "forbids `public: true`" but `public` is not in the `defineAction` signature; the difference between `auth: 'optional'` and `'none'` is undefined; `defineRoute` is said to do "the same steps 1–5" but the maintenance pre-step (step 0) is only described for actions; post and listing creation have no idempotency key (only `clientMsgId` for messages), so a double-click can create two posts. Fix: remove `public`, define optional (ctx if present) vs none (never loads the session), apply step 0 to both factories, and add an optional `idempotencyKey` (UUID, stored 10 min in Redis) to `content.createPost`, `marketplace.create*` and `trips.create`.

**29. NIT. Open-ended lists and small inconsistencies.** The reserved username list ends in "…" (§21.1) and CMS reserved slugs end in "…" (§11.12); `sw.js` is "hand-written" (§15) but also "shares `sw-rules.ts` via build" (§20.1); admin i18n locale source for `/admin` (no prefix) is not stated; admin lists ordered by `updated_at` have no index although §5.3 says each paginated query has one; "role-less filters" in `/admin/broadcasts` is unparseable. Fix: commit the actual reserved lists in `src/modules/identity/reserved.ts` and `cms/reserved.ts` and cite them; choose one SW build approach (a tiny `esbuild` step that bundles `sw-rules.ts` into `public/sw.js`, run in `prebuild`); state that admin uses `users.locale` via cookie; add `IX (updated_at desc, id desc)` to tables with admin lists sorted that way, or sort admin lists by `id`; rewrite the broadcast audience as "all | language | country | has_business".

---

## Verified Assumptions

- Brand asset: `Assets/nargito_logo.png` exists and is 1489×1481, 8-bit, PNG colour type 6 (RGBA), read from the file header. The two other PNGs exist. This matches design.md.
- Repo state matches the design: no commits, `docs/` empty, no application code. Nothing to migrate.
- Dev machine: Node v24.15.0 and npm 11.12.1 present. `docker`, `psql` and `redis-server` are not installed. The design's statements agree, and finding 1 follows from them.
- Colour maths in §12.1 is correct for white on primary (5.09), primary on tint (4.46, correctly flagged as failing), primary-hover on tint (6.40), muted on white (4.97) and on tint (4.36), dark link on dark surface (6.39). The two exceptions are the border and input values (finding 18).
- One ORM (Drizzle with `pg`) and one auth framework (Better Auth) are chosen. Prisma, NextAuth and Better Auth's `admin` plugin are explicitly excluded. No mixed usage found.
- Table inventory is consistent with itself: the §3 module table lists 71 tables, which is 69 + `media_assets` + `two_factor`, and each has a definition in §11.
- Constraints demanded by the brief exist in the schema: unique username and email (lower-cased), unique slugs for companies, shops, products, services, trips, groups, `UQ`/PK for one reaction per user and post (`post_reactions` PK), per comment, one bookmark (`UQ (user_id, post_id)`), one follow per target (three partial unique indexes), one connection per unordered pair, one owner per company/group, one enquiry per (listing, enquirer), and the conversation reuse constraint `(context_key, pair_key) WHERE kind='direct'`.
- Feed and ownership indexes exist and match the query shapes in §10.2: author, company, shop and group indexes on `(x, id desc)`, a partial public index, geohash indexes, and cursor pagination on UUIDv7 `id`.
- Geohash regex `^[0-9b-hjkmnp-z]{4,5}$` is the correct base-32 geohash alphabet (no a, i, l, o). No latitude/longitude column exists anywhere in §11. `least()`/`greatest()` over uuid is valid in a unique expression index.
- RBAC: effective permissions are computed server-side from DB tables, deny wins, expiry honoured, no role column on `users`, `admin.access` is a permission. The admin gate returns 404 without it. This satisfies the "never from a role label" requirement, apart from finding 20.
- Trips are a first-class model: own tables for trips, itinerary, media, participants, own state machine, own cap-enforcement flow, joins to enquiries and posts.
- Admin IA (§9.5) lists 40+ pages across Overview, Content, Users, Communication, Monetization, Configuration, Operations and Security, each with a permission and a table source.
- Credential-dependent integrations (Google, Facebook, SMTP, Twilio, S3, CDN, Razorpay, VAPID, AI, Sentry) have exact env var names in §4.2, and §4.3/§17 forbid simulated success.
- Cross-document consistency between design.md and tech-design.md is good: AC numbers referenced in tech-design match the requirement text, apart from the items raised above.

## Unverified / Wrong Assumptions

Wrong or contradicted (fixes above):
- "Tombstone `deleted-<id>`" is compatible with the username/phone CHECKs (§5.2.7): wrong (finding 4).
- `authorize()` with `FOR UPDATE` before `db.transaction` serialises writers (§7.1): wrong (finding 2).
- Test transports and in-memory Redis can be used by `next start` e2e (§20.1 vs §4.3): contradicted (finding 1).
- `username`/`name`/`email` shapes are compatible with Better Auth's sign-up and phone-first flow (§11.2): contradicted by the doc's own onboarding redirect (finding 3).
- `array_to_string` is usable in a generated column (§11.2): wrong (finding 12).
- `[...rest]` at the app root, 301/302 from a page, and a `generateSitemaps` index at `/sitemap.xml` (§2, §9.1, §16.5): not feasible in Next.js as described (finding 14).
- "`sessions.updated_at` supports a 30 minute idle timeout" (§6.3): wrong (finding 5).
- The contrast test passes with the given border/input tokens (§12.1): wrong (finding 18).

Unverified (no source or runtime available; the repo is greenfield):
- Better Auth plugin behaviour: TOTP verification in an authenticated session, `phoneNumber` options for cooldown, `emailOTP`/`twoFactor` option names, `databaseHooks` transactionality, account linking `trustedProviders`, cookie name configuration. The design defers this to scaffold (finding 6).
- Razorpay: CSP origins, the `X-Razorpay-Event-Id` header, Checkout callback fields (findings 16, 21).
- Next.js 15 behaviours: `generateSitemaps` URL shape, `redirect()` status codes, `React.cache` outside Server Components (route handlers and server actions do not get request-scoped memoisation, so "once per request" in §6.2 is only true for rendered pages; correctness is unaffected, only the query count), `serverActions.allowedOrigins`.
- `embedded-postgres` supporting the exact Postgres major used in CI on Windows, and `pg-boss` privilege requirements after `migrate:false` (finding 19).
- Performance target (p95 < 300 ms feed on 100k posts for an `author_id IN (… up to 2,000 …) ORDER BY id DESC` query): plausible with the listed indexes but unmeasured. The design correctly calls it a benchmark target, not a guarantee.
- The user's full brief. Sections after "Desktop Layout" were not visible to the design author or to this review. The assumptions "69 tables", "bookmarks apply to posts only", "marketplace is enquiry-based with no cart", and the admin page list cannot be checked against the original text. The author should diff the design against the full brief before implementation.

## Checklist outcome (requested targets)

| Target | Result |
|---|---|
| Exactly one ORM and one auth framework | Pass (Drizzle, Better Auth). See finding 6 for unverified plugin behaviour. |
| Complete, normalized schema with required uniques and feed/ownership indexes | Mostly pass. Gaps: findings 9, 10, 11, 12, 24. |
| Server-computed RBAC, admin never from a role label, mutation authorization pipeline | RBAC passes. Pipeline fails (findings 2, 5, 7, 8). |
| Contextual-enquiry conversation reuse | Pass for the constraint and flow. Gap for business inboxes (finding 10). |
| Trips first-class | Pass. |
| Feature flags and site settings enforced server-side | Pass for actions/routes/pages. Fails for Better Auth endpoints and multi-replica caches (findings 7, 15). |
| i18n English + Hindi, no hard-coded strings | Pass, with minor items (finding 29). |
| Privacy-preserving approximate location | Partial. Storage is right, query surface leaks (finding 13). |
| Full admin IA with real data-backed pages | Pass. |
| Credential-dependent integrations with env vars and "configuration required" | Env vars pass. UX consistency fails (finding 17), payments flow gap (finding 16). |
| Runnable testing strategy | Fail (finding 1). |
