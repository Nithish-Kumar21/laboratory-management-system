<div align="center">

# 🧪 LMS — Laboratory Management System

**A production-grade inventory, workflow, and reporting platform built for a college chemistry department — designed to survive real concurrent usage, not just demo well.**

[![Django](https://img.shields.io/badge/Django-5.2-092E20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![DRF](https://img.shields.io/badge/Django%20REST%20Framework-red)](https://www.django-rest-framework.org/)
[![Tests](https://img.shields.io/badge/tests-89%2F89%20passing-brightgreen)]()

</div>

---

## Why this project exists

Most college department inventory systems are Excel sheets and paper slips. This one replaces that with a real multi-role application — and along the way became a hands-on case study in a problem most CRUD tutorials skip entirely: **what happens when two people click "issue stock" on the same chemical at the same time.**

That question is what shaped most of the engineering decisions below.

---

## What it does

LMS manages the full lifecycle of chemical inventory for a college chemistry department across three roles — **Staff**, **HOD (department head)**, and **Storekeeper**:

- 📦 **Stock Register** — live chemical inventory with supplier, pack size, and rate tracking
- 🧾 **Chemical Requests** — a 7-state approval workflow (draft → pending → accepted → issued → reported → completed, with rejection/cancellation paths)
- 🛠️ **Damage & Service Reporting** — breakage and service-request tracking with automatic inventory correction
- 🔒 **Immutable Audit Log** — every state-changing action recorded, role-scoped, tamper-proof
- 📊 **Year-End Reporting** — auto-generated PDF and Excel reports with chart-based analytics, filtered by academic year
- 👤 **Role-based Access Control** — JWT auth, forced first-login password reset, per-role permission scoping

---

## The engineering problem worth talking about

Inventory systems look simple until multiple people touch the same row at the same time. Here's what that surfaced, and how it was solved:

### 1. Double-counted inventory
Early on, both a PostgreSQL trigger *and* application-level logic in `perform_create()` were adjusting stock counts — causing silent double increments/decrements under normal use.
**Fix:** all inventory arithmetic was moved exclusively into PostgreSQL triggers. Application code no longer touches quantity fields at all — the database is the single source of truth for numbers, the application is only responsible for orchestration.

### 2. Race conditions on state transitions
Two Storekeepers issuing the same request, or a request being approved twice in a network retry, could corrupt state or double-decrement stock.
**Fix:** every state transition (`mark_as_issued`, `mark_as_completed`, etc.) uses `select_for_update()` inside `@transaction.atomic`, with state re-verification *after* the row lock is acquired — not before. Verified under concurrent load with Locust (15/15 passing on adversarial concurrent-issue scenarios).

### 3. ID collisions under load
Manually generated request IDs were colliding when created outside a transaction boundary under concurrent load.
**Fix:** ID generation moved inside the atomic block with an `IntegrityError` fallback/retry.

### 4. Schema drift protection
All Django models are intentionally set to `managed=False`. Every schema change is a reviewed, hand-applied SQL migration — a deliberate constraint that keeps the live schema and the codebase from silently diverging (including protecting against auto-migrations from AI coding assistants).

---

## Tech Stack

| Layer | Choices |
|---|---|
| **Backend** | Django 5.2, Django REST Framework, JWT auth |
| **Database** | PostgreSQL — triggers own all inventory math, row-level locking for concurrency safety |
| **Frontend** | React 19, mobile-first PWA (built for 375px viewports up), Tailwind CSS, Recharts |
| **Reporting** | reportlab (PDF), openpyxl (Excel) |
| **Testing** | pytest-django (concurrency-safe, run against real Postgres), Playwright (real backend, no mocks), Locust (load/race-condition testing) |
| **Email** | Gmail SMTP (App Password) |

---

## Architecture at a glance

```
                     ┌─────────────────────┐
                     │   React 19 PWA       │
                     │  (mobile-first UI)   │
                     └──────────┬───────────┘
                                │ JWT-authenticated REST
                     ┌──────────▼───────────┐
                     │   Django REST API    │
                     │ - role-based views    │
                     │ - select_for_update() │
                     │   + atomic blocks     │
                     └──────────┬───────────┘
                                │ raw SQL / managed=False
                     ┌──────────▼───────────┐
                     │     PostgreSQL        │
                     │ - inventory triggers  │
                     │   (sole math owner)   │
                     │ - manually versioned  │
                     │   schema              │
                     └───────────────────────┘
```

---

## Request Lifecycle

```
draft → pending → accepted → issued → reported → completed
              ↘ rejected              ↖ cancelled (from any pre-issued state)
```

Inventory decrements at **Issued**; **Completed** applies only delta corrections (returns credited back, extra usage deducted) — keeping stock counts accurate even when actual lab usage differs from the original request.

---

## Engineering practices

- Idempotency guards on all 7 state-transition endpoints
- 89/89 backend tests passing, including concurrency-specific test cases
- Locust-based load testing of adversarial concurrent-write scenarios
- Feature-branch workflow with a dedicated integration branch, manual merge review (no auto-merge)
- Manually version-controlled SQL schema instead of framework-generated migrations

---

## Screenshots

> _Add screenshots or a short demo GIF here — Login, Stock Register, Chemical Request flow, and Year-End Report are the strongest ones to show._

---

## Getting Started

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
psql -U <user> -d <database> -f ../sql/schema.sql   # schema is hand-applied, not migrated
python manage.py runserver

# Frontend
cd frontend
npm install
npm run dev
```

```bash
# Tests
pytest                                    # requires real PostgreSQL, not SQLite
pytest tests/playwright/ --headed        # end-to-end, real backend
locust -f tests/locust/locustfile.py     # concurrency/load
```

---

## Status

Currently in pre-deployment hardening — finishing final regression passes, IDOR checks on audit access, and staging environment setup ahead of a phased rollout (single lab section first, then college-wide).

---

## Author

**Nithish Kumar** — backend & database architecture, concurrency design, and system hardening.
Built for the Chemistry Department, Guru Nanak College.
