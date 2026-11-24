# Staging setup, step by step

This guide takes you from zero accounts to a running staging copy of Seven Brands. That copy has the admin, the Moodicons and SonicGlyphs storefronts and the worker, with **test-mode payments only**. Plan on about 1.5–2 hours the first time.

**What you'll create**

| Piece | Service | Cost for staging |
|---|---|---|
| Database | Neon (managed Postgres) | Free plan |
| Private file storage | Cloudflare R2 | Free up to 10 GB, but Cloudflare asks for a payment method to switch R2 on |
| Server | A small VPS (DigitalOcean, Hetzner or Vultr, Singapore region) | About $6–12 a month |
| Addresses (subdomains) | **Option A:** free `sslip.io` names (no domain needed). **Option B:** your own domain | A: free. B: about $10 a year for the domain |

The server stores no customer data: the database lives in Neon and files live in R2. So the VPS can be thrown away and rebuilt at any time.

> Provider websites change their menus often. If a button has a slightly different name than written here, look for the closest match. Nothing in this guide depends on exact wording.

Keep a private note open (a password manager is best). You'll collect about ten values along the way, and **none of them should go into chat, email or git.**

---

## 1. Neon database (about 10 minutes)

1. Sign up at **neon.tech**.
2. Create a project:
   - Name: `seven-brands-staging`
   - Postgres version: **16**
   - Region: **AWS Asia Pacific (Singapore)**, the closest to the Philippines (or the region nearest your VPS)
3. Neon creates a database (often called `neondb`). You can keep it, or create one called `daos` under *Databases*. Either works.
4. Open **Connect** (or *Connection details*) and copy the connection string. **Switch connection pooling OFF** first, so you get the *direct* string: its host does **not** contain `-pooler`. It looks like this:
   ```
   postgresql://USER:PASSWORD@ep-xxxx-xxxx.ap-southeast-1.aws.neon.tech/daos?sslmode=require
   ```
   Why the direct string: the worker uses Postgres `LISTEN/NOTIFY` to pick up jobs instantly, and Neon's pooled connections don't support that. (The worker would still poll every 5 seconds, but the direct string is simpler and plenty for staging.)
5. Save it in your note as **DATABASE_URL**.

Neon's free plan pauses the database when it's idle. The first request after a pause takes a second or two longer. That's fine for staging.

---

## 2. Cloudflare R2 private bucket (about 15 minutes)

1. Sign up at **cloudflare.com** (free plan).
2. In the dashboard, open **R2 Object Storage** and switch R2 on. Cloudflare asks for a payment method; staging stays inside the free allowance (10 GB stored, generous request limits).
3. **Create bucket**:
   - Name: `daos-staging`
   - Location: *Automatic*, or *Asia-Pacific* if offered
   - Leave **public access off**. The bucket must stay private: customers only ever get 5-minute signed links.
4. Create an API token for the bucket. Under **R2 → Manage R2 API Tokens** (*API tokens*), choose **Create API token**:
   - Permissions: **Object Read & Write**
   - Specify bucket: **only `daos-staging`**
   - Expiry (TTL): your choice; "forever" is fine for staging
5. After you create it, Cloudflare shows **Access Key ID**, **Secret Access Key** and an **S3 endpoint** like `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`. The secret is shown **once**, so copy all three now:
   - `S3_ACCESS_KEY_ID`
   - `S3_SECRET_ACCESS_KEY`
   - `S3_ENDPOINT` (just `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, **without** the bucket name on the end)

No CORS settings are needed. Downloads are plain browser navigations to signed links.

---

## 3. A small VPS (about 20 minutes)

**Recommended size:** 2 vCPU and **4 GB RAM** (Ubuntu 24.04), in Singapore. The images are built on the server, and building the two Next.js apps can run out of memory on 2 GB. If you pick 2 GB anyway, add swap in step 3.4.

Examples, any of them works:
- **DigitalOcean:** Droplet, Ubuntu 24.04, Singapore (SGP1), Basic 4 GB.
- **Hetzner:** CPX21 or CX32, Singapore, Ubuntu 24.04.
- **Vultr:** Cloud Compute 4 GB, Singapore.

### 3.1 Create the server
- Choose **SSH key** login (not a password). If you don't have a key yet, run `ssh-keygen -t ed25519` on your computer and paste the `.pub` file's contents into the provider's form.
- Write down the server's **public IPv4 address**, for example `203.0.113.5`.

### 3.2 Firewall
In the provider's firewall settings (or with `ufw` on the server), allow only:
- **22** (SSH), ideally limited to your own IP address
- **80** and **443** (web)

Block everything else. The apps listen only inside Docker; Caddy is the only thing exposed.

### 3.3 Log in and install Docker
```bash
ssh root@203.0.113.5
apt-get update && apt-get -y upgrade
curl -fsSL https://get.docker.com | sh      # official Docker install script
docker compose version                      # should print v2.x
```

### 3.4 (Only for 2 GB servers) add swap
```bash
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 3.5 Get the code
```bash
cd /opt
git clone --branch ccr-1805ee39-daequu https://github.com/HaideRotaquio/n8n.git seven
cd seven/seven-brands
```
If the repository is **private**, make the server read-only:
1. Run `ssh-keygen -t ed25519 -f ~/.ssh/deploy -N ""` on the server.
2. Add `~/.ssh/deploy.pub` on GitHub under **repo → Settings → Deploy keys** (read-only).
3. Clone with `GIT_SSH_COMMAND='ssh -i ~/.ssh/deploy' git clone --branch ccr-1805ee39-daequu git@github.com:HaideRotaquio/n8n.git seven`.

---

## 4. Staging addresses (subdomains)

You need three addresses: one for the admin and one per brand. Choose **one** option.

### Option A: free, no domain purchase (recommended for now)
`sslip.io` is a free public DNS service: any name that contains an IP address points to that IP. With the server IP `203.0.113.5`:

| Role | Address |
|---|---|
| Admin | `admin.203-0-113-5.sslip.io` |
| Moodicons | `moodicons.203-0-113-5.sslip.io` |
| SonicGlyphs | `sonicglyphs.203-0-113-5.sslip.io` |

There's nothing to set up: they work as soon as the server exists. Caddy still gets real HTTPS certificates for them. This keeps decision D6 (no domain purchases before the trademark check) intact.

### Option B: your own domain
If you already own a domain (pick a neutral one, not a brand name, until the trademark search is done):
1. Add the domain to Cloudflare (*Add a site*, free plan) and change the nameservers at your registrar to the two Cloudflare gives you.
2. In **DNS → Records**, add three **A** records pointing at the server IP: `admin.staging`, `moodicons.staging` and `sonicglyphs.staging`.
3. Set each record's proxy status to **DNS only** (grey cloud), so Caddy can get its certificates directly.

Your addresses are then `admin.staging.yourdomain.com` and so on.

Check either option from your computer: `ping moodicons.203-0-113-5.sslip.io` (or your domain) should reach the server IP.

---

## 5. Configure the server (about 10 minutes)

All of this happens in `/opt/seven/seven-brands` on the server.

### 5.1 Secrets file
```bash
cp .env.staging.example .env.staging
chmod 600 .env.staging
openssl rand -base64 32     # run twice: one value for BETTER_AUTH_SECRET, one for STORAGE_SIGNING_SECRET
nano .env.staging
```
Fill in:

| Setting | Value |
|---|---|
| `DATABASE_URL` | the Neon **direct** string from step 1 |
| `BETTER_AUTH_SECRET` | first random value |
| `STORAGE_SIGNING_SECRET` | second random value |
| `ADMIN_BASE_URL` | `https://admin.203-0-113-5.sslip.io` (your admin address) |
| `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | from step 2 |
| `S3_BUCKET` | `daos-staging` |
| `COMMERCE_PROVIDER` | leave it **empty** for now (checkout shows "opens soon") until a provider's test account exists; see `PAYMENTS_SETUP.md` |
| `DAOS_ANTHROPIC_API_KEY` | optional; leave empty until the account has credits |

Keep `DEPLOY_ENV=staging`. **Never** set `COMMERCE_LIVE_PAYMENTS` on staging.

### 5.2 Web server (Caddy)
```bash
cp infrastructure/Caddyfile.example infrastructure/Caddyfile
nano infrastructure/Caddyfile
```
Replace the example names with your three addresses. The file already sets `noindex` headers, so search engines ignore staging.

---

## 6. Build and start (about 15–25 minutes, mostly waiting)

```bash
C="docker compose -f infrastructure/docker-compose.staging.yml --env-file .env.staging"

$C build                       # builds admin, storefront and worker images (the slow part)
$C run --rm migrate            # creates the tables in Neon and seeds the seven brands
$C up -d                       # starts admin, storefront, worker and Caddy
$C ps                          # all services should be "running"
```

Create your owner account (use a long password; it must be at least 12 characters):
```bash
$C run --rm -e OWNER_EMAIL='you@example.com' -e OWNER_NAME='Your Name' -e OWNER_PASSWORD='a-long-passphrase' \
  worker sh -c "cd /repo/packages/auth && node --import tsx src/cli/create-owner.ts"
```
Tip: put a space before that command so your shell doesn't save the password in its history.

**Checks:**
- `https://admin.<…>/api/health` → `{"status":"ok","db":"ok"}`
- Open the admin address and sign in.
- Go to **Infrastructure**: database and storage should both be green.

---

## 7. Point the brands at their addresses and fill the catalog (in the admin)

1. **Brands → Moodicons → domains:** replace `moodicons.localhost` with your Moodicons address. Do the same for SonicGlyphs. (The storefront answers 404 for any address not listed here.)
2. **Production:** run the rig jobs with **all palettes** selected:
   - Moodicons: `moodicons-face@1` (4 palettes) and `moodicons-symbols@1` (2 palettes)
   - SonicGlyphs: `sonicglyphs-line@1` (3 palettes)
3. **Quality assurance:** approve the assets (a person's review is required), then **Generate exports** on each one. (A bulk tool for this is a good Phase 5 candidate; for now it's one click per asset.)
4. **Product catalog → "Create … launch drafts"** for each brand, check the prices, then **Publish** the products you're happy with.
5. Open the storefront addresses: the designs and products should appear, with a yellow "Test mode" banner.

---

## 8. Test purchase (once you have a provider test account)

Follow `docs/PAYMENTS_SETUP.md`:
1. Set the provider's keys in `.env.staging` and `COMMERCE_PROVIDER`.
2. Restart the apps: `$C up -d` re-creates the containers with the new settings.
3. Set the provider's webhook URL to `https://<moodicons address>/api/webhooks/<provider>`.
4. Buy with the provider's test card, then check **Orders** and **Revenue → Recent webhooks** in the admin.

---

## Everyday operations

| Task | Command (in `/opt/seven/seven-brands`) |
|---|---|
| Deploy new code | `git pull && $C build && $C run --rm migrate && $C up -d` |
| See logs | `$C logs -f storefront` (or `admin`, `worker`, `caddy`) |
| Restart everything | `$C restart` |
| Stop staging | `$C down` (Neon and R2 keep the data) |
| Free disk space after many builds | `docker system prune -f` |

## If something goes wrong

| Symptom | Likely cause |
|---|---|
| Browser certificate error for a few minutes after starting | Caddy is still getting certificates. Check `$C logs caddy`; ports 80/443 must be open and the DNS names must point at the server. |
| Storefront shows "Not found" for every page | The address isn't in the brand's domains (step 7.1), or it's spelled differently. |
| Admin sign-in fails with an origin error | `ADMIN_BASE_URL` doesn't match the admin address exactly (it must start with `https://` and have no trailing slash). |
| Build stops with "killed" or exit code 137 | Out of memory: add swap (step 3.4) or use a 4 GB server. |
| Infrastructure page: storage red | Wrong R2 endpoint (it must not end in the bucket name), wrong bucket name, or the token isn't allowed on that bucket. |
| Infrastructure page: database red | Check the Neon string, and that it's the direct one ending in `sslmode=require`. |

## What I can and can't do from here

I can't create these accounts or log into your server: they need your identity and payment details, and this session can't reach your server. Once staging is up, I can help read logs you paste (remove secrets first), fix problems in code, and prepare upgrades that you deploy with the command above.
