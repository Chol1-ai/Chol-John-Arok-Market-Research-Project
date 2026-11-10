# Deployment Runbook — Edge Node, LAN & Recovery

**Deployment model:** Single in-store edge node. Fastify/Prisma API, PostgreSQL, and the static frontend server run on the same machine. The cloud tunnel is optional remote administration, not a live ticket-sync layer.<br>
**Target hardware:** Intel NUC / mini-PC (recommended) or Raspberry Pi 5 (8 GB) with SSD and UPS. The stack uses static HTML/CSS/JS, Fastify, and PostgreSQL; it does **not** run Next.js or Redis.<br>
**Target sites:** Foodizo (Ham Towers) and Obunuzi (Opposite YMCA), Wandegeya, Kampala.<br>
**Related specifications:** `Tech_Stack.md` · `Repo_Scaffold_and_Config.md` · `Hardware_and_Peripherals.md` · `Daily_Audit_Digest.md` · `Seed_Data_and_Testing.md` · `Payment_Integration.md`

---

## 0. First-Boot Checklist — New Edge Machine (Ubuntu Server 22.04/24.04 LTS)

Follow the steps in order. Skipping static DHCP, the environment file, or the production cookie/TLS rule will cause failures that are hard to diagnose on-site.

### 0.1 OS & prerequisites

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ca-certificates ufw
sudo timedatectl set-timezone Africa/Kampala
timedatectl                     # confirm Africa/Kampala and NTP sync

# Node.js 20 LTS (the backend requires Node >= 20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version                  # v20.x or later
npm --version

# PostgreSQL 16 (17 also works; the test environment uses 17)
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

### 0.2 Static address on the edge server

Use a DHCP reservation on the router for `192.168.1.100`. Do not configure a static IP inside the OS unless the router cannot reserve one; duplicate IPs are a common cause of KDS outages.

```bash
ip addr show
ip route
ping -c 3 192.168.1.1
```

### 0.3 Clone the repository and configure the backend

```bash
sudo mkdir -p /opt/foodizo
sudo chown "$USER":"$USER" /opt/foodizo
git clone https://github.com/Chol1-ai/Chol-John-Arok-Market-Research-Project.git /opt/foodizo
cd /opt/foodizo

cp backend/.env.example backend/.env
chmod 600 backend/.env
nano backend/.env
```

Minimum values to change:

```bash
NODE_ENV=production
PORT=4000
HOST=127.0.0.1                 # only the local frontend server proxies to the API
CORS_ORIGIN=https://192.168.1.100
DATABASE_URL="postgresql://foodizo_app:<strong-password>@127.0.0.1:5432/foodizo_obunuzi_db?schema=public"
JWT_SECRET=<at-least-32-random-characters>
PAYMENTS_WEBHOOK_SECRET=<telco-callback-signing-secret>
DIGEST_APP_URL=https://192.168.1.100
DIGEST_RECIPIENT_PHONE=+2567XXXXXXXX
DIGEST_CRON_SCHEDULE="30 21 * * *"
```

Production startup now fails closed unless `DATABASE_URL` is explicit, `JWT_SECRET` and `PAYMENTS_WEBHOOK_SECRET` are unique values of at least 32 characters, `HOST` is `127.0.0.1`, and the configured CORS origins and digest URL use HTTPS. The startup error names invalid settings but never echoes their values. Validate deployment configuration before enabling the service:

```bash
cd /opt/foodizo/backend
NODE_ENV=production node --input-type=module -e "import('./dist/config.js').then(() => console.log('Production configuration is valid'))"
```

Add real MTN/Airtel and Africa's Talking credentials only when those channels are live. The backend accepts sandbox values for local development.

> **Production cookie rule:** `NODE_ENV=production` makes the `foodizo_session` cookie `Secure`. Terminate HTTPS in front of the frontend (Caddy, nginx, or Cloudflare Tunnel); otherwise browsers will not store the login cookie over plain HTTP.

### 0.4 Create the database

```bash
sudo -u postgres psql
```

```sql
CREATE USER foodizo_app WITH PASSWORD '<strong-password>';
CREATE DATABASE foodizo_obunuzi_db OWNER foodizo_app;
\q
```

### 0.5 Install, migrate, and seed

```bash
cd /opt/foodizo

# The root package has no runtime dependencies; install the backend.
npm --prefix backend ci

cd backend
npx prisma generate --schema=prisma/schema.prisma
npx prisma migrate deploy --schema=prisma/schema.prisma
npm run prisma:seed             # first install only; destructive
npm run build
cd ..
```

> The seed refuses to run when `NODE_ENV=production` unless `ALLOW_DESTRUCTIVE_SEED=true` is set. Do not enable that flag on a live database. The seven seeded demo accounts all use PIN `1234`; change them before staff use.

### 0.6 Start the services

Create `/etc/systemd/system/foodizo-api.service`:

```ini
[Unit]
Description=Foodizo/Obunuzi Fastify API
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=foodizo
WorkingDirectory=/opt/foodizo/backend
EnvironmentFile=/opt/foodizo/backend/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/foodizo-web.service`:

```ini
[Unit]
Description=Foodizo/Obunuzi static frontend + API proxy
After=network.target foodizo-api.service
Wants=foodizo-api.service

[Service]
Type=simple
User=foodizo
WorkingDirectory=/opt/foodizo
Environment=PORT=3000
Environment=BACKEND_HOST=127.0.0.1
Environment=BACKEND_PORT=4000
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now foodizo-api foodizo-web
sudo systemctl status foodizo-api --no-pager
sudo systemctl status foodizo-web --no-pager
```

The backend listens on `127.0.0.1:4000`; `server.js` listens on `0.0.0.0:3000` and proxies `/api/v1/*` and `/ws/events` to it.

### 0.7 Network and printer

```bash
# Reserve the printer MAC → 192.168.1.200 in the router.
# Test raw TCP 9100 from the edge server:
echo -e "\x1b\x40Hello Foodizo\x0a\x0a\x0a" | nc 192.168.1.200 9100
```

```bash
# Firewall: staff LAN reaches the frontend; the API stays local.
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24 to any port 22 proto tcp
sudo ufw allow from 192.168.1.0/24 to any port 3000 proto tcp
sudo ufw allow from 192.168.1.0/24 to any port 443 proto tcp   # if using Caddy/nginx TLS
sudo ufw enable
sudo ufw status verbose
```

Do not open PostgreSQL (`5432`) or the printer port (`9100`) to the LAN. The printer is outbound-only from the edge server.

### 0.8 Go-live verification

```bash
curl -fsS http://127.0.0.1:4000/api/v1/health       # {"status":"UP",...}; checks database connectivity
curl -fsS http://127.0.0.1:3000/ | head             # launch hub HTML
curl -fsS http://127.0.0.1:3000/api/v1/health       # proxied API
```

On a tablet:

1. Open `/login`, confirm the seven staff cards load, and sign in with PIN `1234` as a waiter.
2. Confirm the waiter lands on `/pos`; a kitchen user lands on `/kds`; a manager lands on `/admin`.
3. Open a table tab, add an item, and confirm the ticket appears on `/kds`.
4. Claim and bump the ticket; confirm the chit prints and the SMS result is reported honestly (`MOCK` in development/sandbox).
5. Settle the tab and confirm the table moves to `NEEDS_CLEARING`.
6. Open `/dispatch` and `/admin` as a manager; confirm dispatch and digest data load.
7. Open `/prototype/customer`; confirm the customer screen is labelled as a static design prototype and does not call the API.

A first-boot is complete when the health checks pass, all seven demo logins redirect to the correct role home, a test ticket reaches the KDS, and a test chit prints.

---

## 1. Scope

**This runbook does:**

- Installs one edge node running PostgreSQL, the Fastify API, and the static frontend server.
- Keeps local table orders, KDS tickets, and thermal printing working when the WAN link is down.
- Documents optional HTTPS and remote administration.
- Defines backup, restore, update, and rollback procedures.

**This runbook does not:**

- Make MTN MoMo, Airtel Money, or Africa's Talking SMS work without internet. Those are external services.
- Replace the restaurant's router, ISP, or electrician.
- Provide a live cloud replica of every ticket.
- Configure email digest delivery. Phase 1 has no SMTP transport; the digest reports `emailStatus: NOT_CONFIGURED`.
- Run Redis or Next.js. The real-time bus is in-process WebSocket, and the frontend is static HTML/CSS/JS.

> **Offline rule:** local table orders, KDS bumps, and printing continue on the LAN. Mobile money requires the telco network. Never show “PAID” from a local guess; only a verified webhook or a manager-verified manual transaction may release a MoMo order.

---

## 2. Hardware & Power Bill of Materials

| Item | Minimum | Recommended | Notes |
| :--- | :--- | :--- | :--- |
| Edge server | Raspberry Pi 5, 8 GB, 128 GB SSD | Intel NUC / mini-PC, i3 or better, 8–16 GB RAM, 256 GB SSD | Runs PostgreSQL, Fastify, and `server.js`; no container runtime required |
| UPS | 650 VA | 1,000 VA pure sine wave | Covers edge server, router, switch; 15–30 min runtime |
| Network switch | 5-port gigabit unmanaged | 8-port gigabit managed | Connects edge, KDS tablets, printer |
| Router | Existing ISP router | Dual-WAN router with 4G failover | Static DHCP reservations; guest Wi-Fi isolation |
| KDS displays | 4 × 10–15" Android tablets | Wall-mounted, powered, Ethernet or 5 GHz Wi-Fi | One `/kds` board can be filtered by station |
| Printer | 80 mm ESC/POS LAN printer | Same, with auto-cutter | Port 9100; static IP |
| FOH device | 6.5" Android handheld/tablet | Same, with charging dock | Waiter POS |
| Cabling | Cat5e | Cat6 | Prefer Ethernet for KDS and printer where possible |

The hardware and ESC/POS model notes are in `Hardware_and_Peripherals.md`. Confirm whether hardware is supplied by the contractor or the client before signing the contract.

---

## 3. Network Topology

```text
INTERNET
   │
   ├── Fiber router / 4G failover (192.168.1.1)
   │
   ├── 192.168.1.100  Edge server
   │     ├── server.js            :3000  static UI + /api + /ws proxy
   │     ├── Fastify API          :4000  bound to 127.0.0.1
   │     └── PostgreSQL           :5432  bound to 127.0.0.1
   ├── 192.168.1.101–104  KDS tablets
   ├── 192.168.1.200  80 mm ESC/POS LAN printer (port 9100)
   └── 192.168.1.110–150  DHCP pool for FOH handhelds
```

### 3.1 Router rules

- Create **DHCP reservations** for the edge server, KDS tablets, and printer. Reservations survive device resets.
- Put customer phones on a **guest SSID** with client isolation. In Phase 1 the customer screens are static prototypes; if they are shown publicly, they need access only to the frontend port `3000`/`443`.
- Put KDS tablets and the printer on the **staff SSID/LAN**. Disable client isolation on the staff network, or the tablets cannot reach the edge server.
- Disable WPS and remote router administration from the WAN.
- Change the router admin password from the default and record it in the owner's password manager, not in this repository.
- If the router supports VLANs, place the printer on a separate VLAN and allow only the edge server to reach `192.168.1.200:9100`.

### 3.2 Why no Redis or MQTT?

The backend broadcasts KDS events over an in-process WebSocket bus at `/ws/events` (`fastify.broadcastWs`). One API process serves the whole edge node, so there is nothing to publish across processes. Redis is not installed, and Mosquitto/MQTT is not used. If the API is ever scaled to multiple replicas, add a documented broker; do not put one in the Phase 1 critical path.

---

## 4. Runtime Configuration

All backend configuration is validated by `backend/src/config.ts`. The canonical example is `backend/.env.example`.

| Variable | Required in production | Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` enables the `Secure` session cookie and rejects unsigned payment webhooks |
| `PORT` / `HOST` | Yes | Fastify bind address; use `127.0.0.1:4000` behind `server.js` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `CORS_ORIGIN` | Yes | Comma-separated frontend origins |
| `JWT_SECRET` | Yes | Session signing key, at least 16 characters (use 32+) |
| `JWT_EXPIRATION_HOURS` | No | Session lifetime, default `12` |
| `PAYMENTS_WEBHOOK_SECRET` | Yes | HMAC-SHA256 secret for `X-Foodizo-Signature`; empty means unsigned callbacks are rejected in production |
| `MTN_MOMO_*`, `AIRTEL_MONEY_*` | When live | Telco credentials |
| `AFRICASTALKING_*`, `SMS_SENDER_ID` | When live | SMS gateway; without credentials the service reports `MOCK` |
| `EXPO_PRINTER_IP` / `EXPO_PRINTER_PORT` | Yes | ESC/POS printer address |
| `CASH_DRAWER_KICK_ENABLED` | No | `1` enables the RJ12 drawer kick |
| `DIGEST_CRON_SCHEDULE` | No | Default `30 21 * * *`, interpreted in `Africa/Kampala` |
| `DIGEST_RECIPIENT_PHONE` | Yes | Owner digest SMS recipient |
| `DIGEST_RECIPIENT_EMAIL` | No | Stored for future email support; no mailer is wired |
| `DIGEST_APP_URL` | Yes | Base URL used in the digest report link |
| `DIGEST_EMAIL_ENABLED` | No | Leave `false`; `true` reports `FAILED_NOT_IMPLEMENTED`, not a sent email |

The frontend server reads `PORT`, `BACKEND_HOST`, and `BACKEND_PORT` from the environment. It needs no database, telco, SMS, or session secret.

---

## 5. Optional HTTPS Reverse Proxy (Caddy)

`NODE_ENV=production` requires HTTPS so the browser accepts the `Secure` session cookie. Caddy can terminate TLS on `443` and proxy to `server.js` on `3000`.

`/etc/caddy/Caddyfile`:

```caddyfile
https://192.168.1.100 {
    tls internal
    reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo apt install -y caddy
sudo systemctl reload caddy
sudo ufw allow from 192.168.1.0/24 to any port 443 proto tcp
```

Install Caddy's local root certificate on staff tablets/phones so the browser trusts the LAN certificate. Do not use a public DNS name unless the edge server is reachable through the tunnel.

If you cannot provide HTTPS, use `NODE_ENV=development` only on a fully isolated demo LAN and accept that unsigned payment webhooks are permitted in that mode. Never run a live restaurant on that configuration.

---

## 6. Cloudflare Tunnel (Optional Remote Access)

Use a tunnel for remote administration, not as a database replication link.

1. Create a Cloudflare account, add the domain, and create a tunnel named `foodizo-edge`.
2. Install `cloudflared` on the edge node and authenticate it.
3. Add one public hostname: `admin.foodizo.ug` → `http://127.0.0.1:3000`.
4. Put the hostname behind **Cloudflare Access** with an allow-list for the owner and developer emails. Require email OTP or Google login.
5. Start the tunnel as a service.
6. Test from outside the LAN: open `https://admin.foodizo.ug`, log in through Access, and confirm an API-backed screen loads. Then confirm that the tunnel being down does not affect local KDS/POS operations.

Do not expose PostgreSQL (`5432`), the API (`4000`), or the printer (`9100`) through the tunnel.

---

## 7. Backups & Restore

### 7.1 Nightly database backup

```bash
sudo mkdir -p /var/backups/foodizo
sudo chown "$USER":"$USER" /var/backups/foodizo
```

`/usr/local/bin/foodizo-backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="/var/backups/foodizo/foodizo_${STAMP}.dump"
PGPASSWORD="$(grep '^DATABASE_URL=' /opt/foodizo/backend/.env | sed -E 's#.*://[^:]+:([^@]+)@.*#\1#')" \
  pg_dump -h 127.0.0.1 -U foodizo_app -d foodizo_obunuzi_db -Fc > "$OUT"
gzip -9 "$OUT"
find /var/backups/foodizo -type f -name '*.gz' -mtime +30 -delete
```

Install and schedule it at 02:00:

```bash
sudo install -m 0755 foodizo-backup.sh /usr/local/bin/foodizo-backup.sh
crontab -e
# 0 2 * * * /usr/local/bin/foodizo-backup.sh >> /var/log/foodizo-backup.log 2>&1
```

Copy the backup to a second location (USB drive in the safe, or an encrypted object-storage bucket). A backup on the same SSD as the database is not a backup.

### 7.2 Restore test

```bash
# Restore into a scratch database; never overwrite production during a test.
sudo -u postgres createdb foodizo_restore
gunzip -c /var/backups/foodizo/foodizo_YYYY-MM-DD_HHMM.dump.gz | \
  pg_restore -h 127.0.0.1 -U foodizo_app -d foodizo_restore --clean --if-exists
psql -h 127.0.0.1 -U foodizo_app -d foodizo_restore -c 'SELECT COUNT(*) FROM orders;'
sudo -u postgres dropdb foodizo_restore
```

Document the restore date and result. Restore into staging first; never test a restore by overwriting production.

### 7.3 What not to back up

- The `.env` file contains secrets. Back it up in a password manager, not in the same bucket as the database.
- Do not back up customer phone numbers to an unencrypted USB stick. Treat the dump as personal data under the Uganda Data Protection and Privacy Act, 2019.
- Redis is not installed, so there is no cache dump to manage.

---

## 8. Updates & Rollback

1. Announce a maintenance window outside peak hours.
2. Take a fresh backup.
3. `git fetch && git checkout <tag>`.
4. `npm --prefix backend ci`.
5. `npx prisma migrate deploy --schema=prisma/schema.prisma` from `backend/`.
6. `npm --prefix backend run build`.
7. `sudo systemctl restart foodizo-api foodizo-web`.
8. Verify `/api/v1/health`, the KDS WebSocket, a test ticket, a test print, and a manager login.
9. If verification fails, check out the previous tag, reinstall, rebuild, and restart. Restore the database only if the migration was destructive.

Do not run `prisma migrate dev` on production; it is an interactive development command. Use `migrate deploy`.

---

## 9. Monitoring & Daily Checks

| Check | Command / action | Frequency |
| :--- | :--- | :--- |
| API service | `sudo systemctl status foodizo-api --no-pager` | Daily |
| Frontend service | `sudo systemctl status foodizo-web --no-pager` | Daily |
| API/database readiness | `curl -fsS http://127.0.0.1:4000/api/v1/health` | Daily / monitoring |
| Frontend health | `curl -fsS http://127.0.0.1:3000/api/v1/health` | Daily / monitoring |
| Disk space | `df -h /` | Weekly |
| Backup exists | `ls -lh /var/backups/foodizo` | Daily |
| UPS battery | UPS display / self-test | Monthly |
| Printer test | Print a test chit from the KDS/dispatch screen | Daily opening |
| KDS latency | Place a test order; measure bump-to-screen | Weekly |
| Time sync | `timedatectl` | Monthly |
| Restore test | Restore the latest dump to a scratch database | Quarterly |

The digest scheduler runs inside the API process at `DIGEST_CRON_SCHEDULE` (default 21:30 `Africa/Kampala`). Check `journalctl -u foodizo-api` after 21:30. In Phase 1 the SMS may be `MOCK` and email is `NOT_CONFIGURED`; a `PARTIAL` digest is expected, not a delivery failure unless `smsStatus` is `FAILED`.

Add an external uptime monitor (Uptime Kuma, Cloudflare Health Checks, or a simple cron curl) for the public admin hostname if the tunnel is enabled. A local-only monitor cannot alert you when the power is out.

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| Login succeeds but the next request is unauthenticated | `NODE_ENV=production` with plain HTTP, so the `Secure` cookie is rejected | Terminate HTTPS in front of `server.js`, or use a development-only LAN for demos |
| KDS shows “Reconnecting” | Tablet on guest Wi-Fi with client isolation; API or frontend service down; IP changed | Join staff SSID; check both systemd services; verify the DHCP reservation |
| Printer not printing | Wrong IP/port, paper out, printer on a different subnet, firewall | `ping 192.168.1.200`; `nc -vz 192.168.1.200 9100`; check the printer IP |
| API 502 / blank page | Backend not running, migration failed, or database password mismatch | `sudo journalctl -u foodizo-api -n 100`; verify `.env`; run `migrate deploy` |
| “Too many clients” / DB slow | Long-running queries or low RAM | Check `pg_stat_activity`; add indexes; use a mini-PC with more RAM |
| MoMo payments fail | Telco outage, wrong keys, no internet | Check telco status; verify `.env`; use manager-verified manual MoMo |
| Webhook returns `INVALID_WEBHOOK_SIGNATURE` | Missing or wrong `PAYMENTS_WEBHOOK_SECRET`, or unsigned callback in production | Configure the same secret at the telco and in `.env` |
| Digest not sent | Cron schedule invalid, API not running, SMS failure, or email disabled | `journalctl -u foodizo-api`; check `DIGEST_CRON_SCHEDULE`; `emailStatus: NOT_CONFIGURED` is expected |
| Clock drift | Host timezone/UTC misconfigured | `timedatectl set-timezone Africa/Kampala`; enable NTP |
| Disk full | Logs or backups on the same partition | Rotate journal logs; move backups to another disk; clean old dumps |

---

## 11. Acceptance Checklist

- [ ] Edge server has a DHCP reservation and is reachable at `192.168.1.100`.
- [ ] PostgreSQL and the Fastify API listen only on `127.0.0.1`; only the frontend port and optional TLS port are reachable from the staff LAN.
- [ ] `foodizo-api` and `foodizo-web` are enabled and running under systemd.
- [ ] `NODE_ENV=production` is served over HTTPS, or the deployment is clearly labelled a development demo.
- [ ] Migrations run successfully on a clean database.
- [ ] The seed produced 7 staff accounts, 16 tables per outlet, and the canonical fixtures; demo PINs are changed before real use.
- [ ] All seven staff logins redirect to the correct role home (`/pos`, `/kds`, `/admin`).
- [ ] KDS receives a table order over the LAN and prints a test chit.
- [ ] Disconnecting the WAN does not stop local KDS/POS/printing.
- [ ] MoMo/Airtel/SMS show a clear offline error; no order is marked paid locally.
- [ ] Payment webhooks are signed with `PAYMENTS_WEBHOOK_SECRET`.
- [ ] The app uses `Africa/Kampala`; the 21:30 digest scheduler is registered and logged.
- [ ] Digest channel reporting is honest: `SMS_MOCK` and `NOT_CONFIGURED` are not presented as delivered.
- [ ] A nightly backup runs and a restore test succeeds.
- [ ] Cloudflare Tunnel is off by default; if enabled, it is behind Cloudflare Access and exposes only the frontend.
- [ ] The runbook and credentials are stored outside the repository.

---

## 12. Related Specifications

| File | Scope |
| :--- | :--- |
| `Hardware_and_Peripherals.md` | Hardware, ESC/POS, UPS, printer safety |
| `Tech_Stack.md` | Application architecture, schema, service layout |
| `Repo_Scaffold_and_Config.md` | Directory tree, dependencies, environment variables |
| `Payment_Integration.md` | Telco APIs and reconciliation |
| `Daily_Audit_Digest.md` | 21:30 owner digest, channel behaviour, report link |
| `Seed_Data_and_Testing.md` | Test data and end-to-end checks |
