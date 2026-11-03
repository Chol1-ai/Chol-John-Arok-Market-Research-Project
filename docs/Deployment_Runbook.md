# Deployment Runbook — Edge Node, Docker & Network

**Deployment Model:** Edge-first hybrid — local LAN node is the source of truth; cloud tunnel is for remote administration and backup, not live ticket sync.<br>
**Target Hardware:** Intel NUC / mini-PC (recommended) or Raspberry Pi 5 (8 GB) with SSD and UPS. A Raspberry Pi 4 with 2 GB is not sufficient for Next.js + PostgreSQL + Redis + Fastify.<br>
**Target Sites:** Foodizo (Ham Towers) and Obunuzi (Opposite YMCA), Wandegeya, Kampala.<br>
**Related Specifications:** `Foundational_Concept.md` · `Design_System.md` · `User_Flow.md` · `User_Profiles_Personas.md` · `Delivery_Zones_and_Dispatch.md` · `Tech_Stack.md` · `Payment_Integration.md` · `Hardware_and_Peripherals.md` · `Seed_Data_and_Testing.md` · `Repo_Scaffold_and_Config.md` · `Daily_Audit_Digest.md` · `build_strategy/Build_Strategy_and_Phases.md`

---

## 0. First-Boot Checklist — New Edge Machine (Ubuntu Server 22.04 LTS)

This is the exact sequence a field technician follows when setting up a **brand-new mini-PC or Raspberry Pi 5** at a restaurant site for the first time. Follow steps in order.

> [!IMPORTANT]
> Complete every step before calling it done. A missed step (e.g., skipping static DHCP or forgetting `.env`) will cause failures that are hard to diagnose on-site.

### 0.1 OS & Prerequisites

```bash
# 1. Flash Ubuntu Server 22.04 LTS to an SSD (not an SD card in production)
# 2. Boot the machine and run initial updates
sudo apt update && sudo apt upgrade -y

# 3. Install Docker Engine (not Docker Desktop)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker                  # apply group change without logout

# 4. Verify Docker
docker --version               # expect Docker 24.x or later
docker compose version         # expect Compose 2.x (built-in plugin)
```

### 0.2 Static IP on the Edge Server

```bash
# Edit Netplan (adjust interface name: ip link show)
sudo nano /etc/netplan/00-installer-config.yaml
```

```yaml
network:
  ethernets:
    eth0:                        # or enp3s0, etc. — check your interface
      dhcp4: no
      addresses: [192.168.1.100/24]
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]
  version: 2
```

```bash
sudo netplan apply
ping 192.168.1.1 -c 3          # confirm gateway reachable
```

### 0.3 Clone Repo & Configure Environment

```bash
# 5. Clone the project repository
cd /opt
sudo mkdir foodizo && sudo chown $USER:$USER foodizo
cd foodizo
git clone https://github.com/YOUR-ORG/foodizo-obunuzi-kds.git .

# 6. Copy and fill environment files
cp .env.example .env
cp .env.client.example .env.client
nano .env                      # fill in real values: DATABASE_URL, MTN/Airtel keys, AT SMS key, SMTP creds
nano .env.client               # fill in NEXT_PUBLIC_API_URL = http://192.168.1.100:4000
```

### 0.4 Start the Stack & Seed the Database

```bash
# 7. Pull images and start all services
docker compose pull
docker compose up -d

# 8. Wait for PostgreSQL to be healthy (up to 30 s)
docker compose ps              # all services should show "Up" or "healthy"

# 9. Run database migrations
docker compose exec api npx prisma migrate deploy

# 10. Seed the database (development/first-install only)
docker compose exec api npx prisma db seed

# 11. Verify the API health endpoint
curl http://192.168.1.100:4000/health    # expect {"status":"ok"}
curl http://192.168.1.100:3000           # expect the Customer PWA homepage HTML
```

### 0.5 Network & Printer

```bash
# 12. Assign static DHCP to the printer in the router admin UI
#     Printer MAC → 192.168.1.200 (see router admin → DHCP reservations)

# 13. Test the printer
echo -e "\x1b\x40Hello Foodizo\x0a\x0a\x0a" | nc 192.168.1.200 9100
# Expect a slip to print; if nothing prints, check the cable and power

# 14. Set the router's DHCP pool to 192.168.1.110–150 for FOH and KDS tablets
```

### 0.6 Final Go-Live Verification

```bash
# 15. Open the KDS on a tablet: http://192.168.1.100:3000/kds/fryer
# 16. Log in as a waiter: http://192.168.1.100:3000/login
# 17. Place a test dine-in order from the waiter POS — confirm it appears on KDS
# 18. Bump the order to READY — confirm a chit prints
# 19. Log in as admin: http://192.168.1.100:3000/admin
# 20. Run the digest dry-run:
docker compose exec api node scripts/run-daily-digest.js --dry-run
# Expect: "Dry run complete — no SMS or email sent"

# 21. Test backup:
bash deploy/backup.sh
ls -lh /opt/foodizo/backups/   # expect a .tar.gz file with today's date
```

> ✅ **First-boot complete.** Proceed to staff training (Stage 4 in  · `build_strategy/Build_Strategy_and_Phases.md`).

---

## 1. What This Runbook Does and Does Not Do

**Does:**

- Installs a single in-store edge node that serves the PWA, FOH POS, KDS, API, PostgreSQL, and Redis over local Wi-Fi.
- Keeps KDS tickets and thermal printing working when the fiber/4G link is down.
- Provides an optional Cloudflare Tunnel for remote admin access without opening router ports.
- Defines backup, update, and rollback procedures.

**Does not:**

- Make MTN MoMo, Airtel Money, SMS, email, or WhatsApp work without internet. Those are external services.
- Replace the restaurant's router, ISP, or electrician.
- Provide a live cloud replica of every ticket. If cloud sync is ever required, use an outbox/event-log pattern; do not point the edge app at a remote database over an unreliable link.
- Turn a Raspberry Pi into a data-centre. Use a mini-PC with an SSD for production.

> **Offline rule:** Local table orders, KDS bumps, and printing continue on LAN. Mobile-money payments require the telco network. Do not show “PAID” from a local guess; only a verified webhook or a manager-verified manual transaction may release a MoMo order.

---

## 2. Hardware & Power Bill of Materials

| Item | Minimum | Recommended | Notes |
| :--- | :--- | :--- | :--- |
| Edge server | Raspberry Pi 5, 8 GB, 128 GB SSD | Intel NUC / mini-PC, i3 or better, 8–16 GB RAM, 256 GB SSD | Runs Docker, PostgreSQL, Redis, API, frontend |
| UPS | 650 VA | 1,000 VA pure sine wave | Covers edge server, router, switch; 15–30 min runtime |
| Network switch | 5-port gigabit unmanaged | 8-port gigabit managed | Connect edge, KDS tablets, printer |
| Router | Existing ISP router | Dual-WAN router with 4G failover | Static DHCP reservations; guest Wi-Fi isolation |
| KDS displays | 4 × 10–15" Android tablets | Wall-mounted, powered, ethernet or 5 GHz Wi-Fi | Steam, Fryer, Rolex, Expo |
| Printer | 80 mm ESC/POS LAN printer | Same, with auto-cutter | Port 9100; static IP |
| FOH device | 6.5" Android handheld/tablet | Same, with charging dock | Prossy's POS |
| Cabling | Cat5e | Cat6 | Prefer ethernet for KDS and printer where possible |

The hardware list and ESC/POS model notes are in `Hardware_and_Peripherals.md`. Confirm whether hardware is supplied by the contractor or the client before signing the contract; the sample contract excludes hardware unless quoted separately.

---

## 3. Network Topology

```text
INTERNET
   │
   ├── Fiber router / 4G failover (192.168.1.1)
   │
   ├── 192.168.1.100  Edge server (Docker: frontend, API, Postgres, Redis)
   ├── 192.168.1.101  KDS — Steam Line
   ├── 192.168.1.102  KDS — Grill & Fryer
   ├── 192.168.1.103  KDS — Rolex Griddle
   ├── 192.168.1.104  KDS — Expo / Pass
   ├── 192.168.1.200  80 mm ESC/POS LAN printer (port 9100)
   └── 192.168.1.110–150  DHCP pool for FOH handhelds and customer phones
```

### 3.1 Router rules

- Create **DHCP reservations** for the edge server, KDS tablets, and printer. Do not configure static IPs on the tablets themselves; reservations survive device resets.
- Put customer phones on a **guest SSID** with client isolation enabled, but allow access to the edge server's frontend port `3000` only. The API on port `4000` is Docker-internal and is reached through the Next.js `/api` rewrite, not directly from the guest network. If the guest network cannot reach the LAN, use the staff SSID for the customer PWA or provide a QR code that joins the guest network with the right policy.
- Put KDS tablets and the printer on the **staff SSID/LAN**. Disable client isolation on the staff network, or the tablets cannot reach the edge server.
- Disable WPS and remote router administration from the WAN.
- Change the router admin password from the default; record it in the owner's password manager, not in this repository.
- If the router supports VLANs, place the printer on a separate VLAN and allow only the edge server to reach `192.168.1.200:9100`.

### 3.2 Why not MQTT?

The stack uses **Redis pub/sub + WebSocket** for KDS updates. It does not need Mosquitto MQTT. The original proposal mentioned MQTT but the compose file did not include it, and adding another broker increases failure modes. If a future printer or sensor requires MQTT, add it as a separate, documented service; do not put it in the Phase 1 critical path.

---

## 4. Docker Compose

Save as `docker-compose.yml` in the repository root. The file uses environment variables; never commit real passwords.

```yaml
name: foodizo-edge

x-app-env: &app-env
  NODE_ENV: production
  TZ: Africa/Kampala

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-foodizo}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
      POSTGRES_DB: ${POSTGRES_DB:-foodizo_kds}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-foodizo} -d ${POSTGRES_DB:-foodizo_kds}"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks:
      - foodizo_net
    # No host port. The database is reachable only on the Docker network.

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks:
      - foodizo_net
    # No host port. Redis is not exposed to the LAN.

  migrate:
    build:
      context: .
      dockerfile: Dockerfile.server
      target: migrate
    env_file: .env
    environment:
      <<: *app-env
      DATABASE_URL: postgresql://${POSTGRES_USER:-foodizo}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-foodizo_kds}?schema=public
    depends_on:
      postgres:
        condition: service_healthy
    command: ["npx", "prisma", "migrate", "deploy"]
    networks:
      - foodizo_net
    profiles: ["tools"]

  api:
    build:
      context: .
      dockerfile: Dockerfile.server
      target: runtime
    restart: unless-stopped
    env_file: .env
    environment:
      <<: *app-env
      PORT: 4000
      DATABASE_URL: postgresql://${POSTGRES_USER:-foodizo}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-foodizo_kds}?schema=public
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    # No host port. The browser reaches the API only through the Next.js
    # /api rewrite; remote access goes through Cloudflare Access.
    healthcheck:
      # node:20-bookworm-slim does not guarantee curl/wget; use Node's fetch.
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:4000/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 5
    networks:
      - foodizo_net

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.client
      args:
        # The browser calls /api; Next.js rewrites it to the api service.
        # NEXT_PUBLIC_* values are baked at build time in Next.js.
        NEXT_PUBLIC_API_URL: /api
        API_INTERNAL_URL: http://api:4000
    restart: unless-stopped
    # Never mount the server .env into the frontend. It needs no database,
    # telco, SMS, SMTP, session, or Cloudflare secret.
    environment:
      <<: *app-env
      NEXT_PUBLIC_API_URL: /api
      API_INTERNAL_URL: http://api:4000
    depends_on:
      api:
        condition: service_healthy
    ports:
      - "3000:3000"
    networks:
      - foodizo_net

  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      frontend:
        condition: service_started
    networks:
      - foodizo_net
    profiles: ["tunnel"]

volumes:
  pgdata:
  redisdata:

networks:
  foodizo_net:
    driver: bridge
```

### 4.1 Notes on the compose file

- **No Mosquitto/MQTT service.** The stack uses Redis pub/sub and WebSocket.
- **No host ports for PostgreSQL, Redis, or the API.** Only the frontend is reachable from the LAN on port `3000`; the browser reaches the API through the Next.js `/api` rewrite. This is deliberate. A direct `:4000` API port is a development-only convenience and must not be published in the production compose file.
- **`cloudflared` is optional.** Start it with `docker compose --profile tunnel up -d`; leave it off if the client does not need remote access.
- **Same-origin API proxy.** The browser calls `/api`; Next.js rewrites `/api/:path*` to `http://api:4000` inside the Docker network. This keeps working on the LAN and through a Cloudflare Tunnel without baking a LAN IP into the bundle. The compose build args set `NEXT_PUBLIC_API_URL=/api` and `API_INTERNAL_URL=http://api:4000`. For a direct-API development build outside Docker, use `NEXT_PUBLIC_API_URL=http://localhost:4000` and skip the rewrite.
- **Timezone.** `TZ=Africa/Kampala` is set on the app containers. The host should also use `Africa/Kampala`; verify with `timedatectl`.
- **Secrets.** Put `POSTGRES_PASSWORD`, `CLOUDFLARE_TUNNEL_TOKEN`, SMTP, telco, and digest-signing credentials in `.env` with `chmod 600 .env`. Do not commit `.env` and do not mount it into the frontend container. Use a URL-safe database password, or percent-encode reserved characters in `DATABASE_URL`.
- **`.dockerignore`.** Exclude `node_modules`, `.next`, `.git`, `.env`, `*.dump`, `*.dump.gz`, and `backups/` so secrets and large artifacts are not copied into images.

---

## 5. Dockerfiles

### 5.1 `Dockerfile.server`

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build:server

FROM node:20-bookworm-slim AS migrate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma
RUN npx prisma generate
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
EXPOSE 4000
CMD ["node", "dist/server/index.js"]
```

Add `"build:server": "tsc -p tsconfig.server.json"` to `package.json` (see `Repo_Scaffold_and_Config.md`). The `migrate` stage keeps the Prisma CLI available without shipping dev dependencies in the API runtime.

### 5.2 `Dockerfile.client`

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
ARG NEXT_PUBLIC_API_URL=/api
ARG API_INTERNAL_URL=http://api:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV API_INTERNAL_URL=$API_INTERNAL_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
# The client image does not need the Fastify build or Prisma generation.
RUN npm run build:client

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Set `output: 'standalone'` in `next.config.js`. If the app does not use standalone output, replace the runtime stage with `npm start` and copy `.next` plus `node_modules`.

### 5.3 `next.config.js`

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_INTERNAL_URL ?? 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
```

The rewrite is server-side. It lets the same build work on the LAN and through the tunnel: the browser only calls the Next.js origin, and Next.js forwards `/api` to the API container. `API_INTERNAL_URL` is baked at build time, so rebuild the frontend if it changes.

---

## 6. Step-by-Step Setup

### Step 1 — Prepare Ubuntu Server 24.04

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw avahi-daemon ca-certificates
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker "$USER"
sudo hostnamectl set-hostname foodizo-edge
sudo timedatectl set-timezone Africa/Kampala
sudo systemctl restart avahi-daemon
```

Log out and back in for the Docker group change.

### Step 2 — Set the edge server's LAN address

Use a DHCP reservation on the router for `192.168.1.100`. On the server, verify:

```bash
ip addr show
ip route
ping -c 3 192.168.1.1
```

Do not use a static IP inside the OS unless the router reservation is impossible; duplicate IPs are a common cause of KDS outages.

### Step 3 — Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24 to any port 22 proto tcp
sudo ufw allow from 192.168.1.0/24 to any port 3000 proto tcp
# The API port 4000 is Docker-internal and is not published to the LAN.
# The edge server connects outbound to the printer at 192.168.1.200:9100.
# Do not open 9100 inbound on the edge server; restrict printer access on the
# router/VLAN instead.
sudo ufw enable
sudo ufw status verbose
```

Do **not** open `5432` (Postgres), `6379` (Redis), or `9100` to the whole LAN or the internet. The printer rule allows only the edge server.

### Step 4 — Clone and configure

```bash
sudo mkdir -p /opt/foodizo
sudo chown "$USER":"$USER" /opt/foodizo
git clone https://github.com/your-org/foodizo-obunuzi-kds.git /opt/foodizo
cd /opt/foodizo
cp .env.example .env
chmod 600 .env
nano .env
```

Set at minimum:

```bash
POSTGRES_PASSWORD=<strong-random-password>
OWNER_PHONE=2567XXXXXXXX
OWNER_EMAIL=owner@example.com
TZ=Africa/Kampala
SESSION_TTL_HOURS=12
COOKIE_SECURE=false
PAYMENT_TTL_MINUTES=15
```

Add telco, SMTP, and optional Cloudflare values from `Repo_Scaffold_and_Config.md`. The frontend gets `NEXT_PUBLIC_API_URL=/api` and `API_INTERNAL_URL=http://api:4000` from the compose service, not from the server `.env`.

### Step 5 — Build, migrate, seed, start

```bash
docker compose build
docker compose --profile tools run --rm migrate
docker compose --profile tools run --rm migrate npx tsx prisma/seed.ts   # first install only
docker compose up -d
docker compose ps
```

The seed runs in the `migrate` stage because that stage keeps the dev dependencies (`tsx`) and a generated Prisma client. The production API image intentionally omits them. Do not add `tsx` to production dependencies just for seeding.

### Step 6 — Verify

```bash
# Health is checked inside the API container because port 4000 is not published.
docker compose exec -T api node -e "fetch('http://127.0.0.1:4000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
# The public entry point and the same-origin API proxy must both answer.
curl -I http://192.168.1.100:3000
curl -fsS "http://192.168.1.100:3000/api/v1/delivery-zones?outlet=FOODIZO_HAM_TOWERS" > /dev/null
docker compose logs -f --tail=100 api
```

On a KDS tablet:

1. Open `http://192.168.1.100:3000/kds/expo`.
2. Confirm `ONLINE — LAN LOCAL`.
3. Log in as FOH on the handheld, place a dine-in table order, and confirm it reaches the KDS as `PENDING`.
4. Print a test chit to `192.168.1.200:9100`.
5. Disconnect the WAN/fiber cable and repeat steps 3–4. Local orders and printing must still work; MoMo/SMS must show a clear offline/error state.

---

## 7. Cloudflare Tunnel (Optional Remote Access)

Use a tunnel for **remote administration**, not as a database replication link.

1. Create a Cloudflare account, add the domain, and create a tunnel named `foodizo-edge`.
2. Install `cloudflared` on a machine with a browser, authenticate, and create the tunnel credentials.
3. In the Cloudflare dashboard, add one public hostname:
   - `admin.foodizo.ug` → `http://frontend:3000`
   The API is reached through the Next.js `/api` rewrite; do not expose `api:4000` separately.
4. Put `admin.foodizo.ug` behind **Cloudflare Access** with an allow-list for the owner and developer emails. Require email OTP or Google login; do not leave the app public.
5. Put the tunnel token in `.env` as `CLOUDFLARE_TUNNEL_TOKEN` and start with `docker compose --profile tunnel up -d`.
6. Test from outside the LAN: open `https://admin.foodizo.ug`, log in through Access, and confirm an API-backed screen loads. Then test that the tunnel being down does not affect local KDS/POS operations.
7. If the remote page loads but API calls fail, the frontend was built without the §5.3 `/api` rewrite. Rebuild the frontend; do not "fix" it by opening the API port to the internet.

Do not expose PostgreSQL (`5432`), Redis (`6379`), or the printer (`9100`) through the tunnel. Do not use the tunnel as a substitute for a VPN if the owner needs full network access.

---

## 8. Backups & Restore

### 8.1 Nightly database backup

```bash
sudo mkdir -p /var/backups/foodizo
sudo chown "$USER":"$USER" /var/backups/foodizo

# /usr/local/bin/foodizo-backup.sh
#!/usr/bin/env bash
set -euo pipefail
STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="/var/backups/foodizo/foodizo_${STAMP}.dump"
# Use the container's own POSTGRES_USER/POSTGRES_DB; do not re-parse secrets
# from .env on the host just to build the pg_dump command.
docker compose --env-file /opt/foodizo/.env -f /opt/foodizo/docker-compose.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$OUT"
gzip -9 "$OUT"
find /var/backups/foodizo -type f -name '*.gz' -mtime +30 -delete
```

Install it with `sudo install -m 0755 foodizo-backup.sh /usr/local/bin/foodizo-backup.sh`, or `chmod +x` after creating it.

Schedule at 02:00:

```bash
crontab -e
# 0 2 * * * /usr/local/bin/foodizo-backup.sh >> /var/log/foodizo-backup.log 2>&1
```

Copy the backup to a second location (USB drive in the safe, or an object-storage bucket) and encrypt it at rest. A backup on the same SSD as the database is not a backup.

### 8.2 Restore test

```bash
# Run from /opt/foodizo.
docker compose stop api frontend
docker compose exec -T postgres sh -c \
  'dropdb -U "$POSTGRES_USER" --maintenance-db=postgres --if-exists foodizo_kds_restore'
docker compose exec -T postgres sh -c \
  'createdb -U "$POSTGRES_USER" --maintenance-db=postgres foodizo_kds_restore'
gunzip -c /var/backups/foodizo/foodizo_YYYY-MM-DD_HHMM.dump.gz | \
  docker compose exec -T postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d foodizo_kds_restore --clean --if-exists'
docker compose start api frontend
```

Do not leave the API/frontend stopped after the test. If the restore fails, start them and investigate before touching production.

Restore into a staging database first; never test a restore by overwriting production. Document the restore date and result.

### 8.3 What not to back up

- Redis is a cache/pub-sub layer, not the source of truth. AOF is useful for restart speed, not for financial recovery.
- The `.env` file contains secrets. Back it up in a password manager, not in the same cloud bucket as the database.
- Do not back up customer phone numbers to an unencrypted USB stick. Treat the dump as personal data under the Uganda Data Protection and Privacy Act, 2019.

---

## 9. Updates & Rollback

1. Announce a maintenance window outside peak hours.
2. Take a fresh backup.
3. `git fetch && git checkout <tag>`; build images with a version tag, not `latest`.
4. Run `docker compose --profile tools run --rm migrate`.
5. `docker compose up -d`; verify `/health`, KDS WebSocket, and a test print.
6. If verification fails, check out the previous tag, rebuild, and restore the database only if the migration was destructive.

Pin `postgres:16-alpine` and `redis:7-alpine` to specific minor versions in production. Do not use `latest` for stateful services.

---

## 10. Monitoring & Daily Checks

| Check | Command / action | Frequency |
| :--- | :--- | :--- |
| Containers running | `docker compose ps` | Daily |
| API health | `docker compose exec -T api node -e "fetch('http://127.0.0.1:4000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"` | Daily / monitoring |
| Disk space | `df -h /` | Weekly |
| Backup exists | `ls -lh /var/backups/foodizo` | Daily |
| UPS battery | UPS display / self-test | Monthly |
| Printer test | Print a test chit from Expo | Daily opening |
| KDS latency | Place a test order; measure bump-to-screen | Weekly |
| Time sync | `timedatectl` | Monthly |
| Restore test | Restore latest dump to staging | Quarterly |

Add an external uptime monitor (Uptime Kuma, Cloudflare Health Checks, or a simple cron curl) for the public admin hostname if the tunnel is enabled. A local-only monitor cannot alert you when the power is out.

---

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| KDS shows “Reconnecting” | Tablet on guest Wi-Fi with client isolation; API container down; IP changed | Join staff SSID; `docker compose ps`; check DHCP reservation |
| Printer not printing | Wrong IP/port, paper out, printer on different subnet, firewall | `ping 192.168.1.200`; `nc -vz 192.168.1.200 9100`; check UFW rule |
| API 502 / blank page | API failed migration or DB password mismatch | `docker compose logs api`; verify `.env`; run migrate |
| “Too many clients” / DB slow | Long-running queries or low RAM | Check `docker stats`; add indexes; use mini-PC with more RAM |
| MoMo payments fail | Telco outage, wrong keys, no internet | Check telco status; verify `.env`; use manual verification fallback |
| Digest not sent | Cron timezone, SMTP blocked, SMS credits | Check container logs; verify `TZ`; test SMTP/SMS credentials |
| Clock drift | Host timezone/UTC misconfigured | `timedatectl set-timezone Africa/Kampala`; enable NTP |
| Disk full | Logs or backups on the same partition | Rotate Docker logs; move backups to another disk; `docker system prune` with care |

---

## 12. Acceptance Checklist

- [ ] Edge server has a DHCP reservation and is reachable at `192.168.1.100`.
- [ ] PostgreSQL, Redis, and the API have **no** host port exposed.
- [ ] Only ports `3000` and `22` (LAN-restricted) are open on the edge server; the API is reachable only through the frontend `/api` rewrite, and printer port `9100` is outbound-only.
- [ ] `docker compose ps` shows healthy Postgres, Redis, API, and frontend.
- [ ] Migrations run successfully on a clean database.
- [ ] KDS receives a table order over LAN and prints a test chit.
- [ ] Disconnecting the WAN does not stop local KDS/POS/printing.
- [ ] MoMo/Airtel/SMS show a clear offline error; no order is marked paid locally.
- [ ] The app containers use `TZ=Africa/Kampala`.
- [ ] A nightly backup runs and a restore test succeeds.
- [ ] Cloudflare Tunnel is off by default; if enabled, it is behind Cloudflare Access, exposes only the frontend, and the `/api` rewrite works remotely.
- [ ] The frontend container has no `env_file: .env` and no database, telco, SMTP, session, or tunnel secret in its environment.
- [ ] The owner's phone/email for the daily digest are configured and tested.
- [ ] The runbook and credentials are stored outside the repository.

---

## 13. Related Specifications

| File | Scope |
| :--- | :--- |
| `Hardware_and_Peripherals.md` | Hardware, ESC/POS, UPS, printer safety |
| `Tech_Stack.md` | Application architecture, DDL, service layout |
| `Repo_Scaffold_and_Config.md` | Directory tree, `package.json`, `.env.example` |
| `Payment_Integration.md` | Telco APIs and reconciliation |
| `Daily_Audit_Digest.md` | 21:30 owner digest, SMTP/SMS configuration |
| `Seed_Data_and_Testing.md` | Test data and end-to-end checks |
