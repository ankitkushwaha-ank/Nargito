<div align="center">

<img src="public/brand/nargito-mark.png" alt="Nargito" width="88" />

# Nargito

**People, journeys and local businesses, all in one place.**

A social, travel and local-marketplace platform with a full admin panel. Mobile first.

</div>

---

## What is inside

| Area | What you get |
|---|---|
| **Social** | Feed, posts with photos, polls and links, like, comment, share, save, report, follow and connect, messages |
| **Profiles** | Cover and photo, skills, resume (experience, education, certificates), person or business account |
| **Trips** | Publish trips, itinerary, join requests, ask the organiser |
| **Marketplace** | Products, services, shops and companies, enquiry button on every listing, post as your shop |
| **Discovery** | Explore, Marketplace, People, Groups, search |
| **Admin panel** | Dashboard with graphs, grid/list views, users, content moderation, reports, verification, roles, logs, backups, SEO, languages |
| **Branding** | Change logo, favicon, share image and the banner of every page from **Admin > Logo & images** |
| **Share previews** | Open Graph and Twitter cards on every product, service, trip, shop and post |
| **Safe by default** | CSRF checks, rate limits, step-up for risky admin actions, two-person approvals, audit logs |

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Drizzle ORM · PostgreSQL (or the built-in PGlite database) · Sharp · Playwright and Vitest for tests

## Quick start (local)

Needs **Node 20+**.

```bash
git clone https://github.com/ankitkushwaha-ank/Nargito.git
cd Nargito
npm install
cp .env.example .env        # Windows: copy .env.example .env
npm run db:setup            # creates the database, the admin account and demo content
npm run dev                 # http://localhost:3000
```

No database server is needed. When `DATABASE_URL` is empty the app uses an embedded PostgreSQL stored in `.data/pglite`.

### Demo logins

| Role | Email | Password |
|---|---|---|
| Super admin | `admin@nargito.local` | value of `SEED_ADMIN_PASSWORD` (printed once if empty) |
| Moderator | `moderator@nargito.local` | `Moderator@2026` |
| Member | `demo@nargito.local` | `Demo@12345` |
| Seller | `rohan_mehta@nargito.demo` | `Demo@12345` |
| Shop owner | `ananya_rao@nargito.demo` | `Demo@12345` |
| Trip organiser | `kabir_singh@nargito.demo` | `Demo@12345` |

> Change every password and set `SEED_SAMPLE=0` before going live with real users.

## Works without a database connection

`npm start` runs `db:setup` first. It applies the migrations, creates the admin account and loads the demo members, trips, shops, products, services and posts when the database is empty. So a fresh deployment is never blank, even with no `DATABASE_URL`.

- Bundled banners and photos live in `public/images`. Pages show them by default, even if nothing was uploaded in the admin panel.
- Uploaded banners are saved in `UPLOAD_DIR` and win over the bundled ones. **Restore** in the admin panel brings the default back.
- The embedded database needs a writable disk. Use a host with a persistent volume (VPS, Render disk, Railway volume, Fly volume), or set `DATABASE_URL` to a PostgreSQL URL. Serverless hosts with a read-only disk need `DATABASE_URL`.

## Environment

Copy `.env.production.example` to `.env` and fill it in. The important ones:

| Variable | Purpose |
|---|---|
| `APP_URL` | Public https address (`https://nargito.in`). Used for share previews, emails, sitemap and OAuth |
| `DATABASE_URL` | `postgres://user:pass@host:5432/db`. Empty uses the built-in database |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | First admin account |
| `SEED_SAMPLE` | `1` loads demo content on first start, `0` keeps the database clean |
| `UPLOAD_DIR` | Folder for uploads and admin banners. Keep it on a persistent disk |
| `CRON_SECRET` | Secret for scheduled jobs |
| `SMTP_*` or `RESEND_API_KEY` | Email and OTP delivery |
| `GOOGLE_*`, `FACEBOOK_*` | Optional social login |
| `STRIPE_*` | Optional payments |

## Deploy

```bash
npm ci
npm run build
npm start          # migrates, seeds if empty, then serves on port 3000
```

Put nginx, Caddy or your host's proxy in front for https. A step by step checklist is in [DEPLOY.md](DEPLOY.md).

## Change banners and logos (no code)

Sign in as admin, open **Admin > Logo & images**.

- Logo, wordmark, favicon and link-share image
- Home, login and register banners (desktop and mobile)
- Explore, Marketplace, Trips, Services, Shops, Groups and People banners
- Default profile cover

Pick a file, press **Upload**. It is live straight away.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Migrate, seed if empty, start the server |
| `npm run start:fast` | Start without the database step |
| `npm run db:setup` | Migrate and seed (safe to repeat) |
| `npm run db:reset` | Wipe the **local embedded** database and reload demo data |
| `npm run db:generate` | Create a migration after editing `src/server/db/schema.ts` |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests |
| `npm run test:e2e` | Browser tests (Playwright) |

## Project layout

```
src/app/            pages: (site) public + signed in, (auth) login/register, admin, api
src/components/     UI: shell, social, admin, ui kit
src/server/         services, auth, database, settings, brand images
src/lib/            shared helpers and admin menu
drizzle/            SQL migrations
scripts/            migrate, seed, reset, image tools
public/images/      bundled banners and demo photos
public/resources/   original source images
design/reference/   design reference screens
```

## Contributing

Open an issue or a pull request. Run `npm run typecheck` before pushing.

## License

Private project. All rights reserved unless the owner states otherwise.

