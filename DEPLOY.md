# Deploying NARGITO

Needs Node 20+, PostgreSQL 14+ and a persistent disk for uploads.

## 1. Configure
1. Copy `.env.production.example` to `.env` and fill it in.
   - `APP_URL`: your https domain. Share previews (Open Graph) and emails use it.
   - `DATABASE_URL`: your PostgreSQL URL. Without it the app falls back to the embedded dev database, which is not for production.
   - `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`: your first admin login.
   - `UPLOAD_DIR`: a persistent folder. Back it up.
   - `CRON_SECRET`: random string for scheduled jobs.
   - SMTP (or Resend) so OTP and notification emails send.

## 2. Build and start
```
npm ci
npm run db:setup     # creates tables and the admin account
npm run build
npm start            # listens on port 3000 (use PORT=8080 npm start to change)
```
Put nginx, Caddy or your host's proxy in front of it for https.

## 3. After first login (Admin)
- Logo & images: upload logo, favicon, social share image (OG), hero and banners.
- Website information: footer text and social links (X, Facebook, Instagram, LinkedIn, YouTube).
- General / Email / Languages / Manage features: site name and what is switched on.
- Change the admin password. The demo logins (`*@nargito.local`, `*@nargito.demo`) exist only after `npm run db:reset` and must never be used in production.

## 4. Scheduled jobs
Call every 5 to 15 minutes from cron or your host scheduler:
```
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/<job>
```
Job names are listed in Admin > System health.

## 5. Check
- Open `/`, register a user, post, like and comment.
- Share a post or product link on WhatsApp or Telegram to confirm the preview image appears (needs a public https `APP_URL`).
- Admin > System health shows no failed jobs.

## Local demo
`npm run db:reset` wipes the local embedded database and loads demo data (logins in the README or the seed script output).
