# Server Requirements — PWA Hosting

**Date:** 2026-07-18
**System:** Laboratory Management System (PWA)
**Stack:** Django 5.2.8 + DRF 3.16.1 + PostgreSQL 18 + React 19 (PWA with Workbox)

---

## 1. User & Traffic Profile

| Metric | Value |
|---|---|
| Total registered users | ~22 (1 HOD + 1-2 Storekeepers + 15-20 Staff) |
| Realistic concurrent | 10-15 (lab session start times) |
| PRD target concurrent | 50 (future-proofing) |
| Daily API requests (peak) | ~200-400 |
| Database records/year | ~5,000-10,000 (requests, stock entries, audit logs) |
| PDF/Excel generation | ~2-5/month (year-end reports, CPU-heavy) |
| File storage | Minimal (no photo uploads currently) |

---

## 2. Minimum Requirements (Just Enough)

| Resource | Spec | Reasoning |
|---|---|---|
| **CPU** | 2 vCores | Django is I/O-bound; PostgreSQL handles queries fast for this dataset size; PDF generation is burst-only |
| **RAM** | 2 GB | Django (~150 MB) + PostgreSQL (~256 MB) + Nginx (~20 MB) + OS (~500 MB) = ~1 GB. 2 GB gives headroom |
| **Storage** | 20 GB SSD | Build files (~12 MB) + venv (~200 MB) + DB (~1 GB/year) + logs (~200 MB/year) + OS |
| **Bandwidth** | 1 TB/mo | ~22 users on mobile, API payloads are small JSON; PDF downloads are infrequent |
| **OS** | Ubuntu 22.04 LTS | Stable, well-supported, free |
| **Cost** | ~$10-15/mo | DigitalOcean Basic / Linode Nanode / Hetzner CX22 |

**Stack:** Nginx + Gunicorn (2 workers) + PostgreSQL 16 + Django

**Limitations:**
- PDF report generation may take 5-15 seconds under load
- No room for growth beyond ~30 users
- No horizontal scaling path
- Single point of failure (no DB replication)

---

## 3. Recommended Requirements (Best for Long Term)

| Resource | Spec | Reasoning |
|---|---|---|
| **CPU** | 4 vCores | Headroom for PDF generation + DB queries + concurrent requests without degradation |
| **RAM** | 4 GB | PostgreSQL tuning (shared_buffers=1GB) + Django (4 Gunicorn workers) + OS + swap |
| **Storage** | 40 GB SSD | 5+ years of data growth, log retention, DB backups, room for media |
| **Bandwidth** | 2 TB/mo | Comfortable for growth + periodic report downloads |
| **OS** | Ubuntu 24.04 LTS | Latest LTS with 10-year support |
| **Backups** | Daily automated | pg_dump + off-site storage |
| **SSL** | Let's Encrypt (free) | Auto-renewal via Certbot |
| **Cost** | ~$20-30/mo | DigitalOcean Basic 4GB / Linode 4GB / Hetzner CX32 |

**Stack:** Nginx + Gunicorn (4 workers, 2 threads each) + PostgreSQL 16 + Django + Supervisor

**Long-term advantages:**
- Handles 50+ concurrent users comfortably
- PDF reports generate in 2-5 seconds
- Room for multi-department expansion (PRD Phase 2+)
- Can add Celery workers later for background tasks
- Can add Redis for caching/notifications later
- Supports DB backups with room for WAL archiving

---

## 4. Software Stack Diagram

```
┌─────────────────────────────────────────┐
│              Nginx (reverse proxy)       │
│  - Serves React build (static files)    │
│  - Proxies /api/ to Gunicorn           │
│  - SSL termination (Let's Encrypt)      │
│  - Gzip compression                     │
│  - Security headers (HSTS, CSP, etc.)  │
├─────────────────────────────────────────┤
│           Gunicorn (WSGI server)        │
│  - Min workers: 2 (minimum tier)        │
│  - Recommended: 4 workers x 2 threads  │
│  - Timeout: 120s (for PDF generation)   │
│  - Worker class: gthread                │
├─────────────────────────────────────────┤
│         Django 5.2.8 + DRF              │
│  - WSGI application                     │
│  - JWT auth (SimpleJWT)                 │
│  - Report generation (ReportLab)        │
│  - Email (Gmail SMTP or SendGrid)       │
├─────────────────────────────────────────┤
│         PostgreSQL 16                    │
│  - shared_buffers: 25% of RAM           │
│  - effective_cache_size: 75% of RAM     │
│  - WAL archiving for backups            │
│  - Connection pool: ~20 max             │
├─────────────────────────────────────────┤
│           Supervisor                    │
│  - Process management for Gunicorn      │
│  - Auto-restart on crash                │
│  - Log rotation                         │
└─────────────────────────────────────────┘
```

---

## 5. PWA-Specific Hosting Requirements

Since this is a PWA, Nginx must be configured correctly:

| Requirement | Detail |
|---|---|
| **HTTPS mandatory** | Service Workers only work over HTTPS (except localhost) |
| **Service Worker scope** | Served from root (`/`), must not be blocked by CSP |
| **Manifest served** | `/manifest.json` must be accessible with correct `Content-Type` |
| **Cache headers** | `service-worker.js`: `Cache-Control: no-cache` (always revalidate). Static assets: `Cache-Control: max-age=31536000` (immutable) |
| **SPA fallback** | All non-API routes must return `index.html` for client-side routing |
| **CORS** | API must allow the production domain origin |

---

## 6. Cost Comparison (Annual)

| Provider | Minimum Tier | Recommended Tier |
|---|---|---|
| **Hetzner CX22/CX32** | ~$55/yr | ~$95/yr |
| **DigitalOcean** | ~$144/yr ($12/mo) | ~$288/yr ($24/mo) |
| **Linode/Akamai** | ~$144/yr ($12/mo) | ~$288/yr ($24/mo) |
| **AWS Lightsail** | ~$120/yr ($10/mo) | ~$240/yr ($20/mo) |
| **Oracle Cloud Free Tier** | $0 (ARM 4 OCPU + 24GB RAM) | $0 (but shared, unreliable) |

**Best value for a college:** Hetzner CX32 (4 vCPU, 8 GB RAM, 80 GB SSD) at ~$8/mo — gives recommended-tier specs at minimum-tier pricing.

---

## 7. Recommendation

**Go with the Recommended tier (4 vCPU / 4 GB RAM / 40 GB SSD)** at ~$20-30/mo. The reasoning:

1. **The minimum tier saves ~$10/mo** but creates real operational risk — PDF generation could timeout, no room for growth, and if you ever add notifications or background tasks, you'll need to upgrade anyway.
2. **4 GB RAM allows PostgreSQL tuning** which significantly improves query performance for the year-end reports (which do multiple JOINs across stock_register, chemical_items, issue_chemicals, damaged_items).
3. **Hetzner CX32** gives you recommended specs at almost minimum-tier pricing — best value.
4. **HTTPS is non-negotiable** for PWA service workers, so factor in either free Let's Encrypt or a managed SSL.
