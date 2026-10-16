# Deploy on MilesWeb (cPanel + terminal)

Needs: cPanel with **Setup Node.js App** (Node 20+) and a **PostgreSQL** database.
Nargito uses PostgreSQL. A cPanel *MySQL* database will not work. Create it under **PostgreSQL Databases**.
If your plan has no Node.js App or PostgreSQL, ask MilesWeb support to enable them, or use a VPS.

## 1. Database (cPanel -> PostgreSQL Databases)
1. Create database and user, add the user to the database with ALL privileges.
2. Build the connection string. Special characters in the password must be URL-encoded
   (`!`=%21 `@`=%40 `(`=%28 `)`=%29 `&`=%26 `%`=%25 `#`=%23 `/`=%2F):

```
DATABASE_URL=postgres://DB_USER:ENCODED_PASSWORD@localhost:5432/DB_NAME
```

## 2. Get the code (cPanel -> Terminal, or SSH to 103.86.176.79)
```bash
cd ~
git clone https://github.com/ankitkushwaha-ank/Nargito.git nargito
cd nargito
```

## 3. Create the Node.js app (cPanel -> Setup Node.js App -> Create Application)
- Node version: 20 or newer
- Mode: Production
- Application root: `nargito`
- Application URL: `nargito.in`
- Startup file: `server.js`
Save it, then copy the "source ... virtualenv" command shown at the top of the page and run it in Terminal.

## 4. Environment variables (same page -> Environment variables)
`NODE_ENV=production`, `APP_URL=https://nargito.in`, `DATABASE_URL=...` (from step 1),
`SEED_ADMIN_EMAIL=admin@nargito.in`, `SEED_ADMIN_PASSWORD=<strong password>`, `SEED_SAMPLE=1`,
`CRON_SECRET=<random 32+ chars>`, `UPLOAD_DIR=/home/CPANELUSER/nargito-uploads`

```bash
mkdir -p ~/nargito-uploads
```

## 5. Install, build, create tables (Terminal, inside ~/nargito, with the virtualenv active)
```bash
npm ci
npm run build
npm run db:setup
```

## 6. Start
In Setup Node.js App press **Restart**. Open https://nargito.in.
Set up SSL in cPanel -> SSL/TLS Status (AutoSSL) for nargito.in and www.

## 7. Media storage
Log in as admin, open **Admin -> Configuration -> Media storage (R2)**.
- *Local*: files stay in `UPLOAD_DIR` on the server.
- *Cloudflare R2*: enter Account ID, bucket, Access Key ID, Secret Access Key (and an optional public URL), press **Test connection**, then **Save**.
New uploads use the chosen storage. Old files keep working from where they were saved.

## Update later
```bash
cd ~/nargito && git pull && npm ci && npm run build && npm run db:setup
```
then Restart in Setup Node.js App.

## Notes
- Change the demo passwords after first login.
- Back up the database and `UPLOAD_DIR` regularly.
- Never commit `.env` or share the database password.
