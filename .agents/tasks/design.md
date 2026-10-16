# NARGITO — Requirements

Status: first iteration (no design review exists yet). Companion document: `tech-design.md` (architecture, schema, routes, contracts).

## 1. Summary

NARGITO is a professional social network, local-discovery, business-presence, travel-sharing and enquiry-based marketplace platform. One Next.js modular monolith serves the public website, the installable PWA, the member workspace, the business workspace and the `/admin` panel from one PostgreSQL database. Every feature is backed by real data and enforced by server-side permissions. Integrations that need external credentials show "configuration required" until configured and tested; nothing is simulated.

### Repository findings (greenfield)
- `e:\nargito` contains only `.gitignore`, `Assets/`, `docs/` (empty) and `.agents/`. The git repo has no commits. There is no application code, so the project is built from scratch. There is nothing to preserve or migrate.
- `Assets/nargito_logo.png` exists: 1489×1481 px, 32-bit RGBA, rounded-square app-icon artwork with transparent corners. It contains the symbol only and no wordmark (confirmed by viewing it). The wordmark "Nargito" must therefore be rendered as text beside it, in Poppins SemiBold/Bold, as the typography sheet shows. The dimensions are not exactly square, so derivatives must be padded, never stretched.
- `Assets/Glossy Blue Connection App Icon and Typography-1.png` is the typography and brand reference sheet (Poppins, SemiBold/Bold, dark-navy wordmark). It is a reference only and is not shipped. `Assets/Glossy Blue Nargito Connection Icon.png` has no alpha channel, so it is not used as the brand mark.
- Dev machine: Node v24.15, npm 11.12. Docker and `psql` are NOT installed. This affects how integration tests obtain Postgres (see tech-design §20).

### Assumptions
1. The user message was truncated after "Desktop Layout — LinkedIn-Inspired". Sections after that were not visible. Requirements below are derived from the visible brief plus the explicit coverage list in the step prompt. Anything contradicting the full brief should be raised in design review.
2. The marketplace is enquiry-based: buyers contact sellers through messaging. There is no cart, checkout or order management. Real payments exist only for Pro subscriptions and promotions.
3. Languages at launch: English (default) and Hindi. Further languages are added through the admin panel without code changes.
4. The primary market is India-first. This drives Hindi, INR as the default currency, and Razorpay as the first payment adapter.
5. Video is stored and played as uploaded (no transcoding) within admin-set size and duration limits.
6. Messaging is one-to-one. Group chat is not in scope. Communities are `groups` with a post feed.
7. Saved items (bookmarks) apply to posts only.
8. The entity list in the brief is the schema scope (69 tables, all used). Two tables are added with justification: `media_assets` (shared upload record) and `two_factor` (required by the TOTP plugin). A few Better Auth–required columns are added to `users` and `sessions`. No other unlisted tables.

## 2. Functional Requirements

### FR-1 Accounts and profiles
- A member has a unique username, display name, headline, bio, avatar, cover, location (city/region/country plus an approximate grid cell), and structured experience, education and skills sections.
- Profile visibility (public / connections / private), who can message, and location sharing are member-controlled.
- Profiles are viewable publicly at `/u/[username]` according to visibility, with SEO metadata and structured data.

### FR-2 Authentication
- Sign-up and sign-in with email + password, with email verification.
- Sign-in and sign-up with a phone number and SMS OTP.
- Sign-in with Google and Facebook OAuth.
- Password reset by emailed single-use expiring link.
- TOTP MFA is mandatory for any account holding `admin.access`. It is optional for others.
- Sessions use HTTP-only cookies. Members can list and revoke their sessions.
- Each provider is available only when its credentials are configured, and the UI says so otherwise.

### FR-3 Authorization (RBAC)
- Roles, permissions, role↔permission, user↔role, and per-user allow/deny overrides, all stored in the database.
- Effective permissions are computed on the server. Admin access derives only from the `admin.access` permission and never from a role name.
- Resource-scoped rights (company/shop/group/trip ownership and membership) are enforced by policies.
- Sensitive permissions require MFA step-up. A defined set also requires a second admin's approval (four-eyes).

### FR-4 Posts and media
- Text, image, video and document posts, with visibility (public, connections, group, private), category, optional approximate location, and the option to attach a trip.
- Posts may be authored as a member, or on behalf of a company or shop the member manages.
- Reactions, threaded comments (one reply level), bookmarks, shares (repost and share-to-message) and reports.
- Edit and soft-delete by the author. Moderators may hide or remove.
- Uploads are validated by size, MIME and magic bytes, and processed (EXIF stripped, variants generated).

### FR-5 Social graph
- Follow users, companies and shops. Send, accept, decline and withdraw connection requests. Remove connections.
- Block users. A block hides content in both directions, prevents messaging and connection requests, and removes follow and connection edges.
- People and business suggestions, based on mutual connections, location cell and shared categories.

### FR-6 Business presence
- Companies and shops have profiles, logo, cover, industry/category, location and contact details, and a public page.
- Members with roles (owner / admin / editor) manage them.
- Business verification request flow with document upload and admin review. A verified badge appears only after admin approval.
- A business workspace gives access to pages, listings, enquiries, analytics and promotions.

### FR-7 Marketplace
- Products and services are listed by members, shops or companies. They have price (minor units + currency), category, condition or service mode, media, location cell, and a status lifecycle (draft → pending review → active → sold/expired/archived/removed). All status changes are recorded in `listing_status_history`.
- Browse, filter by category/price/location/condition, and full-text search.
- A buyer can enquire about a listing. See FR-9.

### FR-8 Trips (first-class)
- A trip has title, summary, type, status, dates, origin and destination, budget range, visibility, cover, tags and an optional participant cap.
- It has an ordered day-by-day itinerary, trip media and participants.
- Members can request to join open trips. The owner accepts or declines.
- Trip status moves automatically (planned → ongoing → completed) by date.
- Trips are shareable as posts and appear on the owner's profile.

### FR-9 Messaging and contextual enquiries
- One-to-one private messages with text and attachments, read state, mute and archive.
- An enquiry from a listing (product, service or trip) opens or reuses the conversation for that listing and member pair. It carries a listing card: type, id, title snapshot and image reference. Repeat enquiries append to the same conversation.
- A plain DM between two members is also a single reusable conversation.
- Messages arrive in real time. Privacy settings and blocks are honoured.

### FR-10 Notifications
- In-app notifications with aggregation, read/seen state and per-type, per-channel preferences (in-app, email, push).
- Web Push for installed or subscribed browsers.
- Real-time delivery of notification and message counts.

### FR-11 Groups
- Public or private groups with rules, join approval, roles (owner / moderator / member), a group feed and member management.

### FR-12 Discovery
- Global search across people, companies, shops, products, services, trips, groups and posts, with typeahead.
- Per-member recent searches that can be cleared.
- "Nearby" discovery using approximate location only.

### FR-13 Promotions and advertising
- Owners can promote a post, product, service, shop, company or trip through a campaign: objective, schedule, targeting, and a flat price per day from admin settings.
- Campaigns require successful payment (or admin-granted house credit) and, where configured, moderation review before delivery.
- Impressions, clicks and enquiries are recorded as real events and shown in analytics.
- Promoted items are always labelled.
- Admins can create house ads.

### FR-14 Pro subscriptions and payments
- Admin-managed plans with entitlements. Members and businesses can subscribe, cancel and view invoices.
- Payments, refunds and provider webhooks are stored and idempotent. Refunds go through admin approval.
- With no payment provider configured, purchase UI is disabled with "configuration required". No payment is ever simulated.

### FR-15 Privacy and data rights
- Privacy settings, blocked list, data export (async ZIP delivered by expiring link) and account deletion (grace period, cancellable, then anonymise and purge).

### FR-16 Admin panel
Real, data-backed pages under `/admin`, grouped as Overview, Content, Users, Communication, Monetization, Configuration, Operations and Security. The exact page list is in tech-design §9. Navigation items and pages are shown only if the viewer's effective permissions allow. Every admin mutation is audited.

### FR-17 Configuration and content
- `site_settings` (typed, validated registry) and `feature_flags` (percentage and allow-list rollout) are editable in admin and enforced on the server.
- Languages and translation overrides are editable in admin.
- CMS pages have revisions, publish and rollback, and localized SEO fields.
- Redirect manager. `robots.txt`, `sitemap.xml` and JSON-LD are generated.

### FR-18 Brand, design system and layout
- The supplied logo is used in the header, auth pages, loading screen, app shell and emails. Favicons and PWA icons are derived from it, preserving proportions and transparency. The "Nargito" wordmark is Poppins SemiBold/Bold beside the symbol.
- A blue-first token system with light, dark and system themes.
- Poppins for Latin and Noto Sans Devanagari for Hindi.
- Desktop three-column layout (own identity, not a LinkedIn copy), tablet two-column, and mobile single column with a bottom navigation bar.

### FR-19 PWA
- Settings-driven web manifest, install affordance, offline fallback page, and a service worker that never caches private, authenticated or admin responses.
- Web Push handling.

### FR-20 Security
- CSP with nonces and the standard security headers. CSRF defence for every mutation. Server-side rate limiting.
- Magic-byte upload validation with a quarantine stage.
- Append-only audit and security logs. Secrets are never sent to the browser.

### FR-21 Integrations status
- An Integrations page (admin) and inline UI states report configured/missing for each external service. A missing integration shows "configuration required" and its dependent feature is disabled. Nothing is reported as working until a successful live check has been run by an admin ("Test connection" records the result).

### FR-22 Operations
- Structured logging, Sentry error monitoring, health endpoint, scheduled jobs with admin visibility, retention purges, backup and restore documentation, and deployment documentation.

### FR-23 Quality
- Vitest unit tests, integration tests against a real Postgres, and Playwright end-to-end tests including accessibility checks on key pages.

## 3. Non-Functional Requirements

- **Security:** OWASP ASVS L2 as the target for auth, session and access control. Secrets live only in server env. Every mutation passes through the standard contract.
- **Performance:** feed, search and list endpoints use keyset pagination and have supporting indexes (no offset pagination). Target p95 server time under 300 ms for a feed page of 20 items on a 100k-post dataset (measured by an integration benchmark script, not guaranteed).
- **Accessibility:** WCAG 2.2 AA is the target (keyboard operation, focus visibility, labels, contrast, reduced motion). Colour pairs are contrast-tested in unit tests. Axe runs in e2e. Full conformance still needs manual assistive-technology review.
- **Privacy:** precise coordinates are never accepted, stored or logged. IPs are retained only in security and audit logs, with a configurable retention.
- **Reliability:** webhooks and message sends are idempotent. Background jobs retry with backoff. Counters self-heal through reconciliation.
- **Maintainability:** strict TypeScript, domain-module boundaries enforced by lint, and no `process.env` outside the config module.
- **Internationalization:** no hard-coded user-facing strings. English/Hindi key parity is enforced by test.
- **Browser support:** the last two versions of Chrome, Edge, Firefox and Safari. iOS Safari 16.4+ for Web Push in an installed PWA.

## 4. Acceptance Criteria

Authentication and access
1. A new visitor can sign up with email and password, receives a verification email through the configured SMTP transport, and cannot reach authenticated routes until verified.
2. Phone sign-in sends a 6-digit OTP that expires in 5 minutes, allows 3 attempts, and has a 60-second resend cooldown. When no SMS provider is configured, the phone option shows "configuration required" and `POST` to the OTP endpoint returns `CONFIGURATION_REQUIRED`.
3. Google and Facebook buttons appear enabled only when the corresponding env vars are set. Otherwise they show "configuration required".
4. Session cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production, and are never readable from `document.cookie`.
5. Password reset links are single-use and expire in 60 minutes. Using one revokes all of the user's other sessions.
6. A user with `admin.access` and no TOTP enrolled is redirected to MFA enrolment from every `/admin` URL and sees nothing else.
7. A user whose role is named `admin` but who has no `admin.access` permission gets 404 on `/admin/*`. A user with a role named `member` plus an `allow admin.access` override gets in (after MFA). Both are covered by tests.
8. A `deny` override beats any role-granted permission. An expired override or role has no effect.
9. Every sensitive-permission action fails with `STEP_UP_REQUIRED` unless TOTP was verified in the last 15 minutes. Refunds, user deletion and super-admin grants fail with `APPROVAL_REQUIRED` until a different admin approves.

Content and social
10. Creating a post with an invalid body (empty, over 3000 chars) returns `VALIDATION` with field errors. Posting beyond the rate limit returns `RATE_LIMITED` with `Retry-After`.
11. An upload whose extension and declared MIME say JPEG but whose magic bytes say otherwise is rejected and recorded as a security event. The object is deleted from quarantine.
12. A `connections`-visibility post is absent from the feed, profile, search and direct URL (404) for non-connections.
13. Blocking a user removes follow/connection edges and hides both parties' content from each other. The blocked user receives 404 on the blocker's profile.
14. Feed pagination returns stable, non-duplicated pages under concurrent inserts, and `nextCursor` is null on the last page.
15. A report on content by N distinct reporters (N from settings) moves the content to `under_review` and removes it from feeds. A moderator's decision is recorded in the audit log.
16. Soft-deleted content is not returned by any list, search or direct-fetch API for non-moderators.

Marketplace, trips and messaging
17. A product moves draft → pending review → active only via the allowed transitions. Each transition writes a `listing_status_history` row. An invalid transition returns `CONFLICT`.
18. Two enquiries by the same user about the same listing yield exactly one conversation and one `listing_enquiries` row. The conversation shows the listing snapshot even after the listing is deleted or retitled. An enquiry about a different listing by the same pair creates a separate conversation. A concurrent double-submit does not create duplicates (verified by a concurrency test).
19. A user cannot enquire about their own listing or about a listing whose owner has blocked them.
20. A trip participant cap is never exceeded under concurrent accept actions (tested).
21. A message sent in one browser appears in another signed-in session of the recipient within 2 seconds through SSE. Reloading shows it from the database. Resending with the same `clientMsgId` does not duplicate it.

Location and privacy
22. No API accepts latitude/longitude. Location endpoints accept only geohash strings of length 4–5 and the database has no precise-coordinate column. The nearby UI never displays distance finer than a 5 km bucket.
23. Requesting data export produces a ZIP delivered by a link that expires in 7 days. Deletion requests honour the grace period, can be cancelled, and after processing the email, phone and username are released and personal content is purged.

Monetization
24. With no Razorpay credentials, the Pro and Promote pages render "configuration required" and no payment record can be created.
25. A webhook with an invalid signature is rejected with 400 and stored in `billing_events` with `signature_valid=false`. A replayed valid webhook (same provider event id) is processed once.
26. A campaign delivers only between `start_at` and `end_at` while paid and approved. A promoted item is labelled "Promoted". Impression and click events are stored, a click without a valid serve token is rejected, and the analytics page totals match the event rows.
27. A refund above the approval threshold stays `pending` until a second admin approves it, and the audit log records requester, approver and the result.

Admin and configuration
28. Each admin page listed in tech-design §9 loads real data from the database (no placeholder arrays). The sidebar hides entries the viewer lacks permission for. Direct URL access without permission returns 404 and writes a `permission_denied` security event.
29. Every admin mutation writes one `admin_audit_logs` row in the same transaction. The app database role cannot UPDATE or DELETE audit rows (verified by a test attempting both).
30. Turning off the `marketplace` feature flag makes marketplace routes return 404 and server actions return `FEATURE_DISABLED`, even when called directly. Maintenance mode makes all non-admin mutations return 503.
31. Changing `pwa.name` or `pwa.theme_color` in admin changes `/manifest.webmanifest` within 5 minutes.
32. Editing a translation in admin changes the rendered text without a deploy. Missing Hindi keys fall back to English and are listed in the admin "missing translations" view.
33. CMS pages support draft, publish, and rollback to an earlier revision. Published pages are in `sitemap.xml`. Drafts are not served.
34. Setting `seo.indexing_enabled=false` makes `robots.txt` disallow all and adds `noindex` headers.
35. `/admin/integrations` lists every external integration with its required env vars and a configured/missing state. "Test connection" stores its result and timestamp.

Brand, design and PWA
36. `scripts/generate-brand-assets` produces the favicon, app icons, maskable icon and email logo from `Assets/nargito_logo.png`. The "any" icons keep the alpha channel and the original aspect ratio (padded, not stretched). A sha256 lock fails the build if the source asset changes unexpectedly.
37. The header, login, loading screen and emails show the logo image and the text "Nargito" in Poppins 600/700 once each.
38. All colours in components come from tokens. A lint check fails on hex colours outside the token files. Text/background token pairs meet 4.5:1 in light and dark (unit-tested).
39. At 1280 px the logged-in shell shows three columns. At 800 px it shows two. At 390 px it shows one column and a bottom navigation bar. No horizontal scroll at any width from 320 px (Playwright).
40. Switching theme and language persists for the user and has no flash of the wrong theme on reload.
41. The service worker never stores any response from `/api/*`, `/admin*`, auth pages, RSC payloads, or responses with `Cache-Control: private|no-store` (tested by inspecting Cache Storage after browsing as a signed-in admin). Offline navigation shows `/offline`.

Quality
42. The `npm run typecheck`, `lint`, `test`, `test:integration`, `build` and `test:e2e` commands pass in CI.
43. The en and hi message files have identical key sets. A lint rule fails the build on literal user-facing strings in JSX.
44. An auto-generated authorization test iterates every registered action and route policy and asserts that anonymous and under-privileged callers are denied.
45. Security headers (CSP with nonce, HSTS in production, nosniff, frame-ancestors none, Referrer-Policy, Permissions-Policy) are present on HTML responses (tested).
46. A fresh clone with `.env` set can run `db:migrate`, `db:seed` and `dev`, and a documented bootstrap command creates the first super admin.

## 5. Out of Scope
- Cart, checkout, shipping, order tracking and escrow for marketplace goods.
- Group chat, voice and video calling, and end-to-end-encrypted messaging.
- Video transcoding and live streaming.
- Native iOS and Android apps (the PWA is the mobile story).
- Stripe or other payment adapters (the provider interface allows them later).
- Machine-learning feeds and recommendations. The feed is chronological and relationship-based, plus clearly labelled promoted slots.
- Impersonating users from the admin panel.
- Appeals workflow for moderation decisions. Users can contact support.
- Languages beyond English and Hindi shipped in-repo (more can be added in admin).
- Precise-coordinate maps, turn-by-turn routing and a geocoding provider (city names are user-entered or selected).
- Third-party analytics and tracking pixels.
