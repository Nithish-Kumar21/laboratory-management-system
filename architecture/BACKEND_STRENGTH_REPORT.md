# Backend Strength Report

**Date:** 2026-07-18
**System:** Laboratory Management System (Guru Nanak College - Chemistry Dept)
**Stack:** Django 5.2.8 + DRF 3.16.1 + PostgreSQL 18 + SimpleJWT

---

## 1. Architecture Overview

| Aspect | Detail |
|---|---|
| Framework | Django 5.2.8 with Django REST Framework 3.16.1 |
| Auth | JWT (SimpleJWT) with access (8h) + refresh (7d) tokens |
| Database | PostgreSQL 18 (managed=False models - schema lives in SQL) |
| Apps | 8 Django apps: `users`, `inventory`, `stock_register`, `damaged_entry`, `stock_request`, `reports`, `service_entry`, `audit` |
| RBAC | 3 roles: `hod`, `store_keeper`, `staff` (+ implicit `admin`) |
| Password | Custom complexity validator + Django built-in validators |
| Email | Gmail SMTP (TLS) for password reset & welcome emails |
| Reports | PDF (ReportLab) + Excel (openpyxl) year-end reports |
| Env | `python-decouple` for secrets (but see Security section) |

---

## 2. Strengths (What's Done Well)

### 2.1 Authentication & Authorization

- **JWT-based stateless auth** with 8-hour access token and 7-day refresh token rotation.
- **First-login forced password change** enforced at both view layer and middleware (`FirstLoginMiddleware`), so users cannot bypass the flow.
- **Account lockout** after configurable failed attempts (default 5) with 30-minute cooldown, implemented in `User.increment_failed_attempts()`.
- **Role-based RBAC** with 4 distinct permission classes (`InventoryPermission`, `StockRegisterPermission`, `DamagedEntryPermission`, `StockRequestPermission`, `ServiceEntryPermission`, `IsHODOrStorekeeper`) covering all modules.
- **Single HOD and Single Store Keeper constraint** enforced at both serializer validation and PostgreSQL trigger level (`check_single_hod()` in schema.sql).
- **Password complexity** enforced via custom `PasswordComplexityValidator` (uppercase, lowercase, digit, special char) plus Django's built-in validators (min length 8, no common passwords, no numeric-only).

### 2.2 Concurrency & Data Integrity

- **`select_for_update()`** used in critical inventory operations:
  - Stock issuing (`mark_as_issued` at `stock_request/views.py:150`)
  - Stock completion with delta calculation (`mark_as_completed` at `stock_request/views.py:276`)
  - Service entry item actions (`service_entry/views.py:79`)
  - Stock register deletion (`stock_register/views.py:116`)
- **TOCTOU fix** in `perform_create` (`stock_request/views.py:326`): Active requests are locked before creation to prevent duplicate submissions.
- **`@transaction.atomic`** used on all critical write operations (stock issue, completion, create, delete).
- **Manual sequence generation** inside atomic blocks with `IntegrityError` fallback (`stock_request/views.py:341-366`).

### 2.3 Audit Trail

- **Immutable audit logs**: `AuditLog.save()` raises `PermissionError` on update, `delete()` raises `PermissionError`. This is a strong anti-tamper design.
- **18 action types** covering all significant state changes (login, user CRUD, stock entry, request lifecycle, damage reporting).
- **IP address capture** from `X-Forwarded-For` or `REMOTE_ADDR`.
- **Role-scoped audit view**: HOD sees all, Store Keeper sees stock actions, Staff sees only their own request events.

### 2.4 Database Design

- **PostgreSQL triggers** (`check_low_stock_chemicals`, `check_low_stock_apparatus`) auto-manage low-stock alert tables.
- **PostgreSQL trigger** (`check_single_hod`) enforces single-HOD constraint at DB level.
- **`managed=False` models** with raw SQL schema gives fine-grained control over DB structure (triggers, functions, views).
- **Views-based inventory** (`available_chemicals`, `available_apparatus` are database views, not tables) for computed/consistent inventory reads.

### 2.5 Workflow Management

- **Full stock request lifecycle**: `draft -> pending -> accepted -> issued -> reported -> completed` with `cancelled` and `rejected` branches.
- **State machine guards**: Each transition checks current status before allowing change.
- **Usage reporting**: Staff reports actual chemical usage; Store Keeper completes with delta calculation (returned vs additional).
- **Issue register logging**: Completed requests auto-log to `issue_register` and `issue_chemicals` tables.

### 2.6 Error Handling

- **Consistent JSON error responses** across all views with proper HTTP status codes.
- **User-friendly error messages** (e.g., "You already have an active request", "Only pending requests can be accepted").
- **Graceful email failures**: Welcome/reset emails are wrapped in try/except, logged, but don't block the main operation.

---

## 3. Weaknesses & Risks

### 3.1 CRITICAL - Security

| # | Issue | Location | Severity |
|---|---|---|---|
| S1 | **Hardcoded `SECRET_KEY` in settings.py** (not reading from env) | `settings.py:13` | CRITICAL |
| S2 | **`.env` file committed to git** with real DB credentials and email app password | `backend/.env` | CRITICAL |
| S3 | **`DEBUG=True` in production settings** | `settings.py:16` | HIGH |
| S4 | **`ALLOWED_HOSTS` too restrictive for production** (only localhost) | `settings.py:18` | MEDIUM |
| S5 | **No CSRF protection** on JWT endpoints (SessionAuthentication in REST_FRAMEWORK but not enforced globally) | `settings.py:154` | MEDIUM |
| S6 | **Password reset email token exposed in URL** (no short-lived signed token) | `email_utils.py:9` | MEDIUM |
| S7 | **No rate limiting** on login, forgot-password, or other sensitive endpoints | `views.py` | HIGH |
| S8 | **No HTTPS enforcement** or security headers (HSTS, X-Content-Type-Options, etc.) | `settings.py` | HIGH |
| S9 | **Gmail app password hardcoded** in `.env` and committed | `backend/.env:24` | CRITICAL |
| S10 | **`email_utils.py:50` sends plain password in email** (welcome email) | `users/utils.py:17` | HIGH |

### 3.2 HIGH - Data Integrity

| # | Issue | Location | Severity |
|---|---|---|---|
| D1 | **Request ID race condition** in `StockRequest.save()` (model-level) uses `filter().order_by()` without lock, while `perform_create` does lock - but model.save() still has the unlocked path | `stock_request/models.py:98-116` | HIGH |
| D2 | **`managed=False` on most models** means Django migrations cannot manage schema changes - any DB drift is invisible to Django | Multiple models | MEDIUM |
| D3 | **No database-level foreign key constraints** for some relationships (e.g., `ChemicalItem.stock_register` uses `DO_NOTHING`) | `stock_register/models.py:27` | MEDIUM |
| D4 | **Inventory negative stock possible** - stock_register destroy can deduct below zero if concurrent operations occur | `stock_register/views.py:117` | MEDIUM |
| D5 | **N+1 queries in YearEndReportView** - loops over `ChemicalItem.objects.filter()` and `ApparatusItem.objects.filter()` inside a loop over `stock_registers` | `reports/views.py:104-109` | MEDIUM |

### 3.3 MEDIUM - Code Quality

| # | Issue | Location |
|---|---|---|
| Q1 | **Duplicate email utility files**: `users/email_utils.py` and `users/utils.py` both define `send_welcome_email` and `send_password_reset_email` with different signatures | `users/email_utils.py` vs `users/utils.py` |
| Q2 | **Inline serializer** defined inside views.py (`DegreeClassSerializer` at `views.py:432`) instead of in serializers.py | `users/views.py:432` |
| Q3 | **Debug/test scripts committed**: `check_*.py`, `debug_*.py`, `add_dummy_data.py`, `populate_*.py` etc. clutter the backend directory | `backend/*.py` |
| Q4 | **No `__all__` exports** or consistent module boundaries | All apps |
| Q5 | **Mixed permission patterns**: Some views use `permission_classes` attribute, others check `request.user.role` inline in view methods | `stock_request/views.py:65-66` vs `permissions.py` |
| Q6 | **`perform_create` in `stock_request/views.py`** is 50+ lines of business logic including ID generation, active-request locking, and audit logging - should be a service layer | `stock_request/views.py:319-375` |

### 3.4 MEDIUM - Testing

| # | Issue | Detail |
|---|---|---|
| T1 | **Most test files are empty** | `users/tests.py`, `inventory/tests.py`, `stock_register/tests.py`, `damaged_entry/tests.py`, `reports/tests.py`, `service_entry/tests.py` are all placeholder files |
| T2 | **Only `stock_request/tests.py` has actual tests** | 144 lines covering unit propagation |
| T3 | **No integration tests** for the full request lifecycle | No test covers create -> approve -> issue -> report -> complete |
| T4 | **No security tests** (authentication bypass, permission escalation) | `users/tests_rbac.py` exists but not verified |
| T5 | **No load/performance tests** in the backend itself | Locust files exist at root but not integrated with backend |

### 3.5 LOW - Operational

| # | Issue | Detail |
|---|---|---|
| O1 | **No health check endpoint** for monitoring/load balancers | No `/health` or `/ping` route |
| O2 | **No API versioning** (all routes under `/api/`) | Future breaking changes will be difficult |
| O3 | **No pagination customization** beyond `PAGE_SIZE=100` | Large datasets may cause performance issues |
| O4 | **Logging only to file and console** - no structured logging, no log rotation configured | `settings.py:208-239` |
| O5 | **No Swagger/OpenAPI documentation** for the API | No `drf-spectacular` or similar |
| O6 | **`SessionAuthentication` included** in REST_FRAMEWORK settings alongside JWT - this could cause issues if session middleware is active | `settings.py:155` |

---

## 4. Permission Matrix

| Module | Staff | Store Keeper | HOD |
|---|---|---|---|
| **Login/Auth** | Yes | Yes | Yes |
| **User CRUD** | Self only | Self only | All users |
| **Inventory (Chemicals/Apparatus)** | View only | View + Edit reorder | View only |
| **Stock Register** | No access | Full CRUD + Delete | View only |
| **Stock Request** | Create + Own list + Delete draft | View + Issue + Complete | Accept/Reject + View all |
| **Damaged Entry** | No access | Full CRUD + Delete | View only |
| **Service Entry** | No access | Full CRUD + Actions + Complete | View only |
| **Reports (Year-End)** | No access | View + Download PDF/Excel | View + Download PDF/Excel |
| **Audit Logs** | Own request events only | Stock-related actions | All logs |

---

## 5. API Endpoint Summary

| Endpoint Pattern | Methods | App |
|---|---|---|
| `/api/users/login/` | POST | users |
| `/api/users/logout/` | POST | users |
| `/api/users/change-password/` | POST | users |
| `/api/users/forgot-password/` | POST | users |
| `/api/users/reset-password/` | POST | users |
| `/api/users/` | GET, POST | users |
| `/api/users/<pk>/` | GET, PUT, PATCH, DELETE | users |
| `/api/users/me/` | GET | users |
| `/api/token/refresh/` | POST | simplejwt |
| `/api/classes/` | GET | users |
| `/api/inventory/chemicals/` | GET, PATCH | inventory |
| `/api/inventory/apparatus/` | GET, PATCH | inventory |
| `/api/stock-register/` | GET, POST, PUT, PATCH, DELETE | stock_register |
| `/api/damaged-entry/` | GET, POST, PUT, PATCH, DELETE | damaged_entry |
| `/api/stock-request/` | GET, POST, PUT, PATCH, DELETE | stock_request |
| `/api/stock-request/<pk>/accept/` | POST | stock_request |
| `/api/stock-request/<pk>/reject/` | POST | stock_request |
| `/api/stock-request/<pk>/mark_as_issued/` | POST | stock_request |
| `/api/stock-request/<pk>/report_usage/` | POST | stock_request |
| `/api/stock-request/<pk>/mark_as_completed/` | POST | stock_request |
| `/api/stock-request/<pk>/submit/` | POST | stock_request |
| `/api/stock-request/<pk>/cancel/` | POST | stock_request |
| `/api/issue-register/` | GET | stock_request |
| `/api/service-entry/` | GET, POST, PUT, PATCH, DELETE | service_entry |
| `/api/service-entry/<pk>/action_item/` | POST | service_entry |
| `/api/service-entry/<pk>/complete/` | POST | service_entry |
| `/api/reports/year-end/` | GET | reports |
| `/api/reports/year-end/download/pdf/` | GET | reports |
| `/api/reports/year-end/download/excel/` | GET | reports |
| `/api/audit-logs/` | GET | audit |

---

## 6. Recommendations (Priority Order)

### Immediate (Before Next Deploy)

1. **Rotate secrets**: Change SECRET_KEY, DB password, and Gmail app password. Ensure `.env` is in `.gitignore` and remove from git history.
2. **Set `DEBUG=False`** in production.
3. **Add rate limiting** to login, forgot-password, and password-change endpoints (use `django-ratelimit` or DRF throttling).
4. **Add security middleware** (`django.middleware.security.SecurityMiddleware` is present, but add `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, etc.).

### Short-Term (1-2 Weeks)

5. **Write integration tests** for the full stock request lifecycle (at minimum).
6. **Add API documentation** with `drf-spectacular` (Swagger UI).
7. **Remove debug/test scripts** from the backend directory or move to a `scripts/` folder.
8. **Consolidate email utilities** - remove `users/utils.py` duplicate functions.
9. **Add a `/health` endpoint** for monitoring.

### Medium-Term (1 Month)

10. **Introduce a service layer** for complex business logic (stock request creation, inventory adjustment).
11. **Add N+1 query optimizations** in `YearEndReportView` (use `prefetch_related` / `select_related`).
12. **Implement API versioning** (`/api/v1/`).
13. **Add structured logging** with JSON format and log rotation.
14. **Add database connection pooling** (e.g., `pgbouncer` or `django-db-connection-pool`).

---

## 7. Overall Assessment

| Category | Score (1-10) | Notes |
|---|---|---|
| **Architecture** | 7/10 | Well-structured Django apps with clear separation; missing service layer |
| **Security** | 4/10 | Strong password/auth design, but critical secrets exposure and missing rate limiting |
| **Data Integrity** | 7/10 | Good use of `select_for_update`, `transaction.atomic`, and DB triggers; some edge cases remain |
| **RBAC** | 8/10 | Comprehensive role-based permissions per module with inline and class-based patterns |
| **Testing** | 2/10 | Almost no test coverage; only one test file has real tests |
| **Code Quality** | 6/10 | Clean DRF patterns; some duplication and debug artifacts |
| **Operational Readiness** | 3/10 | No health checks, no API docs, no versioning, DEBUG=True |

**Overall Backend Strength: 5.3/10** - Functionally solid for an internal college tool, but needs immediate security hardening and significant testing investment before any production use beyond localhost.
