# Deployment Guide

**Coforma Studio Deployment Runbooks**

## Overview

Coforma Studio uses a multi-provider deployment strategy:

| Component | Provider | Deployment Method |
|-----------|----------|-------------------|
| **Frontend** | Vercel | Git push (automatic) |
| **Backend API** | Railway | Git push (automatic) |
| **Database** | Railway | Managed service |
| **Storage/CDN** | Cloudflare | Manual configuration |

## Environments

| Environment | Branch | Frontend URL | Backend URL |
|-------------|--------|--------------|-------------|
| **Development** | Local | http://localhost:3000 | http://localhost:4000 |
| **Staging** | `develop` | https://stage.coforma.studio | https://api-stage.coforma.studio |
| **Production** | `main` | https://coforma.studio | https://api.coforma.studio |

---

## Initial Setup

### 1. Vercel Setup (Frontend)

#### Prerequisites
- Vercel account
- GitHub repository connected

#### Steps

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Login to Vercel**
```bash
vercel login
```

3. **Link Project**
```bash
cd packages/web
vercel link
```

4. **Configure Environment Variables**

Go to Vercel Dashboard → Project → Settings → Environment Variables

Add the following variables:

**Production**:
```
NEXTAUTH_URL=https://coforma.studio
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXT_PUBLIC_API_URL=https://api.coforma.studio
NEXT_PUBLIC_TRPC_URL=https://api.coforma.studio/trpc
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_POSTHOG_KEY=...
NEXT_PUBLIC_SENTRY_DSN=...
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
```

**Staging**:
```
NEXTAUTH_URL=https://stage.coforma.studio
NEXTAUTH_SECRET=<different-secret>
NEXT_PUBLIC_API_URL=https://api-stage.coforma.studio
NEXT_PUBLIC_TRPC_URL=https://api-stage.coforma.studio/trpc
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

5. **Configure Build Settings**

- **Framework Preset**: Next.js
- **Root Directory**: `packages/web`
- **Build Command**: `pnpm build --filter=web`
- **Output Directory**: `.next`
- **Install Command**: `pnpm install`

6. **Configure GitHub Integration**

- **Production Branch**: `main`
- **Staging Branch**: `develop`
- **Preview Deployments**: All pull requests

---

### 2. Railway Setup (Backend & Database)

#### Prerequisites
- Railway account
- GitHub repository connected

#### Steps

1. **Install Railway CLI**
```bash
npm install -g @railway/cli
```

2. **Login to Railway**
```bash
railway login
```

3. **Create Project**
```bash
railway init
```

4. **Add PostgreSQL Service**
```bash
railway add --database postgresql
```

5. **Add Redis Service**
```bash
railway add --database redis
```

6. **Add Meilisearch Service**
```bash
railway add --service meilisearch
```

7. **Configure API Service**

Create `railway.json` in project root:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install && pnpm build --filter=api"
  },
  "deploy": {
    "startCommand": "pnpm --filter=api start:prod",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

8. **Configure Environment Variables**

Go to Railway Dashboard → Project → API Service → Variables

**Production**:
```
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
MEILISEARCH_HOST=${{Meilisearch.MEILISEARCH_HOST}}
MEILISEARCH_MASTER_KEY=${{Meilisearch.MEILISEARCH_MASTER_KEY}}
NEXTAUTH_SECRET=<same-as-vercel>
NEXTAUTH_URL=https://coforma.studio
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_ACCESS_KEY_ID=...
CLOUDFLARE_SECRET_ACCESS_KEY=...
SENTRY_DSN=...
LOGTAIL_SOURCE_TOKEN=...
```

9. **Enable Auto-Deploy**

Railway Dashboard → Settings → Deployments → Enable "Auto Deploy on Push"

---

### 3. Cloudflare Setup (Storage & CDN)

#### R2 Buckets

1. **Create Buckets**

Go to Cloudflare Dashboard → R2 → Create Bucket

Create three buckets:
- `coforma-uploads` (private)
- `coforma-exports` (private)
- `coforma-public` (public)

2. **Generate API Keys**

R2 → Manage R2 API Tokens → Create API Token

Copy:
- Access Key ID
- Secret Access Key
- Account ID

Add to Railway environment variables.

3. **Configure CDN**

- **Domain**: `cdn.coforma.studio`
- **Origin**: R2 bucket endpoint
- **Cache Settings**: Aggressive caching for public assets
- **Transform Rules**: Enable image resizing

#### Turnstile (CAPTCHA)

1. **Create Site**

Cloudflare Dashboard → Turnstile → Add Site

- **Domain**: `coforma.studio`
- **Type**: Managed

2. **Copy Keys**

- **Site Key**: Add to Vercel env (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`)
- **Secret Key**: Add to Railway env (`TURNSTILE_SECRET_KEY`)

---

## Deployment Workflows

### Deploy to Staging

```bash
# 1. Ensure you're on develop branch
git checkout develop
git pull origin develop

# 2. Make changes and commit
git add .
git commit -m "feat: add new feature"

# 3. Push to trigger auto-deploy
git push origin develop
```

**Automatic Steps**:
1. GitHub Actions runs CI (lint, typecheck, test)
2. Vercel deploys frontend to `stage.coforma.studio`
3. Railway deploys backend to staging environment
4. Slack notification sent on success/failure

**Verification**:
```bash
# Check frontend
curl https://stage.coforma.studio/api/health

# Check backend
curl https://api-stage.coforma.studio/api/health
```

---

### Deploy to Production

```bash
# 1. Merge develop into main
git checkout main
git pull origin main
git merge develop

# 2. Push to trigger auto-deploy
git push origin main
```

**Automatic Steps**:
1. GitHub Actions runs CI (lint, typecheck, test)
2. Vercel deploys frontend to `coforma.studio`
3. Railway deploys backend to production
4. Slack notification sent on success/failure

**Verification**:
```bash
# Check frontend
curl https://coforma.studio/api/health

# Check backend
curl https://api.coforma.studio/api/health
```

---

## Database Migrations

### Staging Migrations

```bash
# 1. Create migration locally
pnpm --filter=api prisma migrate dev --name add_xyz_table

# 2. Commit migration files
git add packages/api/prisma/migrations
git commit -m "feat(db): add xyz table"

# 3. Push to develop (auto-deploys to staging)
git push origin develop

# 4. Railway runs migrations on startup (automatic)
# Verify in Railway logs: railway logs --service=api --environment=staging
```

### Production Migrations

**IMPORTANT**: Always test migrations in staging first!

```bash
# 1. Ensure migrations tested in staging
# 2. Merge to main
git checkout main
git merge develop
git push origin main

# 3. Verify migration success in Railway logs
railway logs --service=api --environment=production
```

### Manual Migration (Emergency)

```bash
# 1. Connect to Railway database
railway connect postgres

# 2. Run migration SQL manually
\i packages/api/prisma/migrations/YYYYMMDDHHMMSS_migration_name/migration.sql
```

---

## Rollback Procedures

### Frontend Rollback (Vercel)

1. Go to Vercel Dashboard → Deployments
2. Find previous successful deployment
3. Click "Promote to Production"

**OR via CLI**:
```bash
vercel rollback
```

### Backend Rollback (Railway)

1. Go to Railway Dashboard → Deployments
2. Find previous successful deployment
3. Click "Redeploy"

**OR via CLI**:
```bash
railway rollback
```

### Database Rollback

**DANGER**: Database rollbacks are destructive!

```bash
# 1. Identify migration to revert
pnpm --filter=api prisma migrate status

# 2. Revert migration (creates new migration that undoes changes)
pnpm --filter=api prisma migrate resolve --rolled-back YYYYMMDDHHMMSS_migration_name

# 3. Deploy revert migration
git add packages/api/prisma/migrations
git commit -m "revert(db): rollback migration YYYYMMDDHHMMSS"
git push origin main
```

---

## Monitoring & Health Checks

### Health Check Endpoints

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| Frontend | `https://coforma.studio/api/health` | `{"status":"ok"}` |
| Backend | `https://api.coforma.studio/api/health` | `{"status":"ok","services":{...}}` |

### Automated Monitoring

- **Uptime**: Better Uptime (1-min interval)
- **Errors**: Sentry (real-time)
- **Logs**: Better Stack / Logtail
- **Metrics**: PostHog

### Manual Health Check

```bash
# Frontend health
curl -s https://coforma.studio/api/health | jq

# Backend health
curl -s https://api.coforma.studio/api/health | jq

# Expected response
{
  "status": "ok",
  "timestamp": "2025-11-14T10:30:00Z",
  "services": {
    "database": "ok",
    "redis": "ok",
    "meilisearch": "ok"
  }
}
```

---

## Scaling

### Frontend Scaling (Vercel)

- **Automatic**: Vercel scales automatically based on traffic
- **Limits**:
  - Pro plan: 100 GB bandwidth/month
  - Team plan: 1 TB bandwidth/month

### Backend Scaling (Railway)

#### Horizontal Scaling

```bash
# Scale API service to 3 instances
railway up --replicas 3
```

#### Vertical Scaling

Railway Dashboard → Service → Settings → Resources

- **Starter**: 512 MB RAM, 0.5 vCPU
- **Pro**: 2 GB RAM, 2 vCPU
- **Custom**: Up to 32 GB RAM, 8 vCPU

### Database Scaling (Railway)

#### Read Replicas (Future)

Railway supports read replicas for PostgreSQL:

```bash
railway add --database postgresql --replica
```

Update connection string to use read replica for read-only queries.

---

## Backup & Recovery

### Automated Backups

- **Daily**: Railway automated backups (7-day retention)
- **Weekly**: Manual `pg_dump` to R2 (90-day retention)

### Manual Backup

```bash
# 1. Connect to Railway database
railway variables --service postgres

# 2. Dump database
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# 3. Upload to R2
aws s3 cp backup_*.sql.gz s3://coforma-backups/ \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com
```

### Restore from Backup

```bash
# 1. Download backup from R2
aws s3 cp s3://coforma-backups/backup_20251114.sql.gz . \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com

# 2. Restore to database
gunzip -c backup_20251114.sql.gz | psql $DATABASE_URL
```

---

## Secrets Rotation

### Quarterly Rotation Schedule

| Secret | Provider | Rotation Date |
|--------|----------|---------------|
| Database Password | Railway | Q1 2026 |
| Redis Password | Railway | Q1 2026 |
| NextAuth Secret | Manual | Q1 2026 |
| Stripe API Key | Stripe | Q1 2026 |
| Cloudflare R2 Keys | Cloudflare | Q1 2026 |

### Rotation Procedure

1. **Generate new secret** via provider dashboard
2. **Update environment variables** in Railway/Vercel (do not apply yet)
3. **Deploy new version** (zero-downtime deploy)
4. **Verify health checks** pass
5. **Revoke old secret** after 24-hour grace period

---

## Troubleshooting

### Frontend Not Deploying

**Check**:
- [ ] Vercel build logs for errors
- [ ] Environment variables set correctly
- [ ] Build command in `vercel.json` is correct

**Fix**:
```bash
# Test build locally
cd packages/web
pnpm build

# Check Vercel logs
vercel logs <deployment-url>
```

### Backend Not Deploying

**Check**:
- [ ] Railway build logs for errors
- [ ] Database connection string correct
- [ ] Migrations applied successfully

**Fix**:
```bash
# Check Railway logs
railway logs --service=api

# Manually trigger deploy
railway up
```

### Database Connection Errors

**Check**:
- [ ] Database service is running (Railway Dashboard)
- [ ] Connection string is correct
- [ ] Database has available connections

**Fix**:
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity"
```

### Migration Failures

**Check**:
- [ ] Migration syntax is valid
- [ ] No conflicting schema changes
- [ ] Database has sufficient permissions

**Fix**:
```bash
# Mark migration as applied (if already manually applied)
pnpm --filter=api prisma migrate resolve --applied YYYYMMDDHHMMSS_migration_name

# Force reset (DANGER: deletes all data)
pnpm --filter=api prisma migrate reset
```

---

## Incident Response

### Severity Levels

| Level | Description | Response Time | Notification |
|-------|-------------|---------------|--------------|
| **P0 (Critical)** | Complete outage | Immediate | All hands |
| **P1 (High)** | Major feature down | 1 hour | Engineering team |
| **P2 (Medium)** | Minor feature impaired | 4 hours | On-call engineer |
| **P3 (Low)** | Cosmetic issue | Next business day | Support team |

### Incident Checklist

1. **Identify** severity level
2. **Notify** appropriate team (Slack #incidents channel)
3. **Investigate** root cause
4. **Mitigate** (rollback, hotfix, or workaround)
5. **Communicate** status to stakeholders
6. **Resolve** and verify fix
7. **Post-mortem** (within 48 hours for P0/P1)

---

## Contact

- **On-Call Engineer**: Slack #oncall channel
- **DevOps**: devops@innovacionesmadfam.dev
- **Engineering Lead**: engineering@innovacionesmadfam.dev

---

**Last Updated**: 2025-11-14
**Maintained By**: DevOps Team
**Review Cadence**: Monthly
