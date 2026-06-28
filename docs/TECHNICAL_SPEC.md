# TECHNICAL_SPEC.md
# Laboratory Management System (LMS)
**Version:** 1.0  
**Date:** April 2026  
**Author:** Nithish Kumar K  
**Status:** Active — Pre-Build Reference

> This document is the authoritative technical contract for the LMS codebase.  
> PRD defines what to build. This document defines exactly how to build it.  
> Any conflict between this document and the PRD: **this document wins on technical decisions, PRD wins on product decisions.**

> **The Standard We Are Building To**  
> This is not a college project. This is a production system that real people depend on to run real lab sessions with real chemicals. Every decision in this document carries that responsibility.  
> The four pillars of this system are: **Security. Robustness. Reliability. Battle-tested.**  
> We do not cut corners on any of them. We do not ship what we cannot defend.

> **On Code Snippets in This Document**  
> Code snippets throughout this document are **pseudocode expressing intent and logic — not copy-paste implementations.**  
> Before implementing anything from this spec, the agent must:  
> 1. Read the existing source file where the code will live  
> 2. Understand its class structure, naming conventions, and patterns  
> 3. Implement the logic to match the existing style — not paste the snippet verbatim  
>  
> Snippets answer *what must happen and in what order.* The existing codebase answers *how it must be written.*  
> Variable names, method signatures, and class patterns in the snippets are illustrative only.

---

## Table of Contents

1. [Architecture Rules](#1-architecture-rules)
2. [Data Models](#2-data-models)
3. [API Endpoints](#3-api-endpoints)
4. [Business Logic Rules](#4-business-logic-rules)
5. [State Transition Guards](#5-state-transition-guards)
6. [Inventory Math](#6-inventory-math)
7. [Notification Events](#7-notification-events)
8. [Audit Log Actions](#8-audit-log-actions)
9. [Report Generation](#9-report-generation)
10. [Environment & Configuration](#10-environment--configuration)
11. [Idempotency](#11-idempotency)
12. [Server-Side Logging](#12-server-side-logging)

---

## 1. Architecture Rules

These rules apply to every file in the codebase. The agent must not violate these under any circumstance.

- **No raw SQL.** All queries use Django ORM. `select_for_update()` is mandatory on any query where a subsequent write depends on the read value (inventory quantity changes).
- **No hardcoded values.** No URLs, secrets, origins, or environment-specific strings in code. All via `.env`.
- **All validation happens on the backend.** Frontend validation is UX only. The backend must reject invalid input independently.
- **All stock quantity changes must run inside a database transaction** (`@transaction.atomic`). No exceptions.
- **No negative quantity ever.** Any operation that would result in `available_quantity < 0` must raise a `ValidationError` and abort the transaction.
- **Mobile-first frontend.** Base viewport for all CSS is 375px. Desktop styles are written as `min-width` overrides. No component is acceptable if it is broken or unusable at 375px.
- **`managed = True` on all models.** Django must own the schema. No unmanaged models going forward.
- **API responses follow a consistent shape** — see Section 3 for the standard response envelope.
- **All state-changing endpoints must be idempotent.** Calling the same transition twice must not produce a different result the second time. See Section 11.
- **Server-side logging is mandatory in production.** Every request, every error, every slow query must be written to a persistent log file — never only to the console. See Section 12.

---

## 2. Data Models

### 2.1 User (`users/models.py`)

```python
class User(AbstractBaseUser, PermissionsMixin):
    employee_id       = CharField(max_length=20, unique=True)          # Login username
    full_name         = CharField(max_length=100)
    email             = EmailField(unique=True)
    phone             = CharField(max_length=10)                        # Exactly 10 digits, validated
    role              = CharField(max_length=20, choices=ROLE_CHOICES)  # 'hod' | 'store_keeper' | 'staff'
    department        = CharField(max_length=100, default='PG and Research Programme of Chemistry (GAS)')
    degree            = CharField(max_length=50, null=True, blank=True, choices=DEGREE_CHOICES)
    designation       = CharField(max_length=50)
    is_active         = BooleanField(default=True)
    is_first_login    = BooleanField(default=True)
    account_locked_until = DateTimeField(null=True, blank=True)
    failed_login_attempts = IntegerField(default=0)
    created_by        = ForeignKey('self', null=True, blank=True, on_delete=SET_NULL)
    created_at        = DateTimeField(auto_now_add=True)

ROLE_CHOICES = [('hod', 'HOD'), ('store_keeper', 'Store Keeper'), ('staff', 'Staff')]

DEGREE_CHOICES = [
    ('bsc', 'B.Sc Chemistry'),
    ('msc', 'M.Sc Chemistry'),
    ('phd', 'PhD'),
]
```

**Constraints:**
- `degree` is nullable. Blank is acceptable for existing accounts. For new Staff account creation, `degree` is mandatory — enforced at the serializer level, not the DB level.
- `degree` is not required for `hod` or `store_keeper` roles — enforced in serializer validation.
- `is_first_login` defaults to `True`. Set to `False` after the user successfully sets their own password on first login.
- `phone` must be validated as exactly 10 numeric digits in the serializer.

---

### 2.2 Classes (`users/models.py`)

Classes are stored in a DB table, not hardcoded. This allows future additions without code changes.

```python
class DegreeClass(models.Model):
    degree     = CharField(max_length=50, choices=DEGREE_CHOICES)  # Links to User.degree
    name       = CharField(max_length=100)                          # e.g. "I B.Sc Chemistry"
    is_active  = BooleanField(default=True)

    class Meta:
        unique_together = ('degree', 'name')
        ordering = ['degree', 'name']
```

**Seed data (populate via migration or management command):**

| degree | name |
|---|---|
| bsc | I B.Sc Chemistry |
| bsc | II B.Sc Chemistry |
| bsc | III B.Sc Chemistry |
| msc | I M.Sc Chemistry |
| msc | II M.Sc Chemistry |
| phd | PhD |

---

### 2.3 AvailableChemical (`inventory/models.py`)

```python
class AvailableChemical(models.Model):
    chemical_name       = CharField(max_length=100, unique=True)
    available_quantity_ml = DecimalField(max_digits=10, decimal_places=2, default=0)
    reorder_level       = DecimalField(max_digits=10, decimal_places=2)
    updated_at          = DateTimeField(auto_now=True)
```

**Constraints:**
- `available_quantity_ml` must never go below `0`. Enforced at the service/view layer before any decrement.
- `reorder_level` is mandatory. No `null=True`.
- `unique=True` on `chemical_name` — matching between `StockRequestChemicalItem.chemical_name` and `AvailableChemical.chemical_name` is done by exact string match (case-insensitive). The service layer must use `iexact` lookup.

---

### 2.4 AvailableApparatus (`inventory/models.py`)

```python
class AvailableApparatus(models.Model):
    apparatus_name          = CharField(max_length=100, unique=True)
    available_quantity_pieces = IntegerField(default=0)
    reorder_level           = IntegerField()
    updated_at              = DateTimeField(auto_now=True)
```

**Constraints:**
- `available_quantity_pieces` must never go below `0`.
- `reorder_level` is mandatory.

---

### 2.5 StockRegister (`stock_register/models.py`)

```python
class StockRegister(models.Model):
    invoice_number  = CharField(max_length=20, unique=True)
    supplier_name   = CharField(max_length=100)
    purchase_date   = DateField()                    # Cannot be a future date — validated in serializer
    invoice_file    = FileField(upload_to='invoices/', null=True, blank=True)
    created_by      = ForeignKey(User, on_delete=PROTECT)
    created_at      = DateTimeField(auto_now_add=True)
```

**Constraints:**
- `purchase_date` cannot be in the future — validated in serializer.
- `invoice_number` must be unique across all records.

---

### 2.6 ChemicalItem (`stock_register/models.py`)

```python
class ChemicalItem(models.Model):
    stock_register  = ForeignKey(StockRegister, on_delete=PROTECT, related_name='chemical_items')
    chemical_name   = CharField(max_length=100)
    quantity_ml     = DecimalField(max_digits=10, decimal_places=2)
    rate            = DecimalField(max_digits=10, decimal_places=2)
    make            = CharField(max_length=50)
```

**Note:** `on_delete=PROTECT` — a StockRegister cannot be deleted if it has items. This replaces the previous `DO_NOTHING`.

---

### 2.7 ApparatusItem (`stock_register/models.py`)

```python
class ApparatusItem(models.Model):
    stock_register  = ForeignKey(StockRegister, on_delete=PROTECT, related_name='apparatus_items')
    apparatus_name  = CharField(max_length=100)
    quantity_pieces = IntegerField()
    rate            = DecimalField(max_digits=10, decimal_places=2)
    make            = CharField(max_length=50)
```

---

### 2.8 StockRequest (`stock_request/models.py`)

```python
class StockRequest(models.Model):
    request_id      = CharField(max_length=20, unique=True)   # Format: REQ-YYYY-XXX
    status          = CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    class_name      = CharField(max_length=100)               # From DegreeClass.name, filtered by staff degree
    lab_hour        = CharField(max_length=100)               # Free text
    date_of_use     = DateField()                             # Cannot be past date
    reason          = TextField()                             # Purpose / experiment name
    requested_by    = ForeignKey(User, on_delete=PROTECT, related_name='requests')
    reviewed_by     = ForeignKey(User, null=True, blank=True, on_delete=SET_NULL, related_name='reviewed_requests')
    issued_by       = ForeignKey(User, null=True, blank=True, on_delete=SET_NULL, related_name='issued_requests')
    rejection_reason = TextField(null=True, blank=True)       # Mandatory when status='rejected'
    hod_remarks     = TextField(null=True, blank=True)
    created_at      = DateTimeField(auto_now_add=True)
    submitted_at    = DateTimeField(null=True, blank=True)
    accepted_at     = DateTimeField(null=True, blank=True)
    issued_at       = DateTimeField(null=True, blank=True)
    reported_at     = DateTimeField(null=True, blank=True)
    completed_at    = DateTimeField(null=True, blank=True)

STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('pending', 'Pending'),
    ('accepted', 'Accepted'),
    ('rejected', 'Rejected'),
    ('issued', 'Issued'),
    ('reported', 'Reported'),
    ('completed', 'Completed'),
    ('cancelled', 'Cancelled'),
]
```

---

### 2.9 StockRequestChemicalItem (`stock_request/models.py`)

```python
class StockRequestChemicalItem(models.Model):
    stock_request           = ForeignKey(StockRequest, on_delete=CASCADE, related_name='chemical_items')
    chemical_name           = CharField(max_length=64)
    quantity_ml             = DecimalField(max_digits=10, decimal_places=2)   # Requested quantity
    actual_used_quantity_ml = DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    returned_quantity_ml    = DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
```

**Critical change:** `returned_quantity_ml` must be stored explicitly, not calculated. When staff submits usage, both `actual_used_quantity_ml` and `returned_quantity_ml` are written and persisted. The invariant `actual_used_quantity_ml + returned_quantity_ml == quantity_ml` is validated before saving.

---

### 2.10 IssueRegister (`stock_request/models.py`)

**Change: `managed = True`.** The tables already exist in the DB. Handle with a fake migration (`--fake`) to bring under Django control without recreating the tables.

```python
class IssueRegister(models.Model):
    ir_id                = AutoField(primary_key=True)
    request_code         = CharField(max_length=20, null=True, blank=True)
    stock_request_db_id  = IntegerField(null=True, blank=True)
    staff_name           = CharField(max_length=100)
    class_field          = CharField(db_column='class', max_length=50)
    date                 = DateField()
    status               = CharField(max_length=20)

    class Meta:
        managed = True   # Changed from False
        db_table = 'issue_register'
```

---

### 2.11 IssueChemicals (`stock_request/models.py`)

```python
class IssueChemicals(models.Model):
    ir              = ForeignKey(IssueRegister, on_delete=CASCADE, related_name='chemicals')
    chemical_name   = CharField(max_length=64)
    issued_quantity = DecimalField(max_digits=10, decimal_places=2)
    actual_usage    = DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    returned_quantity = DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        managed = True   # Changed from False
        db_table = 'issue_chemicals'
```

**Add `returned_quantity` field** to this model. It must be populated at completion time alongside `actual_usage`.

---

### 2.12 DamagedEntry (`damaged_entry/models.py`)

```python
class DamagedEntry(models.Model):
    staff           = ForeignKey(User, on_delete=PROTECT)
    class_name      = CharField(max_length=100)
    date            = DateField()
    caused_by       = CharField(max_length=100)
    incident_description = TextField()
    damage_image    = ImageField(upload_to='damage_images/', null=True, blank=True)
    reported_at     = DateTimeField(auto_now_add=True)

class DamagedApparatusItem(models.Model):
    damaged_entry   = ForeignKey(DamagedEntry, on_delete=CASCADE, related_name='apparatus_items')
    apparatus_name  = CharField(max_length=100)
    quantity_damaged = IntegerField()
```

---

### 2.13 Notification (`notifications/models.py`) — New Model

```python
class Notification(models.Model):
    recipient       = ForeignKey(User, on_delete=CASCADE, related_name='notifications')
    type            = CharField(max_length=50, choices=NOTIFICATION_TYPE_CHOICES)
    message         = TextField()
    related_object_id = IntegerField(null=True, blank=True)    # e.g. StockRequest pk
    related_object_type = CharField(max_length=50, null=True, blank=True)  # e.g. 'stock_request'
    is_read         = BooleanField(default=False)
    created_at      = DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
```

---

### 2.14 AuditLog (`audit/models.py`) — New Model

```python
class AuditLog(models.Model):
    user            = ForeignKey(User, null=True, on_delete=SET_NULL)
    action          = CharField(max_length=60, choices=AUDIT_ACTION_CHOICES)
    entity_type     = CharField(max_length=50)    # e.g. 'stock_request', 'user', 'stock_register'
    entity_id       = CharField(max_length=50, null=True, blank=True)
    description     = TextField()
    ip_address      = GenericIPAddressField(null=True, blank=True)
    timestamp       = DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
```

**Audit logs are immutable.** No `update` or `delete` is permitted on this model from any view, serializer, or admin action. Enforce by overriding `save()` and `delete()` to raise `PermissionError` if the record already has a pk.

---

## 3. API Endpoints

### Standard Response Envelope

All API responses follow this shape:

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Error:**
```json
{ "success": false, "error": "Human-readable message", "details": { ... } }
```

HTTP status codes follow REST convention: `200`, `201`, `400`, `401`, `403`, `404`, `409`, `500`.

---

### 3.1 Authentication

| Method | URL | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/auth/login/` | None | Any | Login with employee_id + password |
| POST | `/api/auth/token/refresh/` | None | Any | Refresh access token |
| POST | `/api/auth/logout/` | JWT | Any | Blacklist refresh token |
| POST | `/api/auth/change-password/` | JWT | Any | Change password (also handles first-login change) |

**POST `/api/auth/login/`**
```
Request:  { "employee_id": "EMP001", "password": "..." }
Response: { "success": true, "data": { "access": "...", "refresh": "...", "role": "staff", "is_first_login": true } }
Errors:
  - 401: Invalid credentials
  - 403: Account locked. { "locked_until": "2026-04-22T10:30:00Z" }
```

**POST `/api/auth/change-password/`**
```
Request:  { "current_password": "...", "new_password": "..." }
Response: { "success": true, "data": { "message": "Password updated successfully" } }
Errors:
  - 400: New password does not meet complexity requirements
  - 400: New password cannot be the same as the current password
  - 401: Current password is incorrect
```
On success, if `is_first_login` is `True`, set it to `False` and include `"is_first_login": false` in the response so the frontend can redirect to the dashboard.

---

### 3.2 Users

| Method | URL | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/users/` | JWT | HOD | List all users |
| POST | `/api/users/` | JWT | HOD | Create a new user |
| GET | `/api/users/<id>/` | JWT | HOD | Retrieve a user |
| PATCH | `/api/users/<id>/` | JWT | HOD | Update user details (including degree) |
| DELETE | `/api/users/<id>/` | JWT | HOD | Deactivate user (sets `is_active=False`, never hard delete) |
| GET | `/api/users/me/` | JWT | Any | Current user's profile |

**POST `/api/users/`**
```
Request: {
  "employee_id": "EMP010",
  "full_name": "Dr. Example",
  "email": "example@gnc.edu",
  "phone": "9876543210",
  "role": "staff",
  "degree": "bsc",          # Required if role is 'staff'
  "designation": "Assistant Professor",
  "password": "Preset@123"
}
Response 201: { "success": true, "data": { "id": 10, "employee_id": "EMP010", ... } }
Errors:
  - 400: Employee ID already exists
  - 400: Degree is required for staff role
  - 400: Phone must be exactly 10 digits
  - 400: Password does not meet complexity requirements
```

---

### 3.3 Classes

| Method | URL | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/classes/` | JWT | Staff | List classes for the requesting staff member's degree only |
| GET | `/api/classes/all/` | JWT | HOD, Storekeeper | List all classes across all degrees |

**GET `/api/classes/`** — filters by `request.user.degree` on the backend. A staff member with `degree='bsc'` receives only B.Sc classes regardless of any query parameter passed.

---

### 3.4 Inventory

| Method | URL | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/available_chemicals/` | JWT | All | List chemicals |
| PATCH | `/api/available_chemicals/<id>/` | JWT | HOD, Storekeeper | Update reorder level only |
| GET | `/api/available_apparatus/` | JWT | All | List apparatus |
| PATCH | `/api/available_apparatus/<id>/` | JWT | HOD, Storekeeper | Update reorder level only |

**Response shape — Staff role:**
```json
{ "id": 1, "chemical_name": "Hydrochloric Acid", "available_quantity_ml": 1200.00, "unit": "ml", "stock_status": "available" }
```

**Response shape — HOD / Storekeeper role:**
```json
{ "id": 1, "chemical_name": "Hydrochloric Acid", "available_quantity_ml": 1200.00, "unit": "ml", "reorder_level": 200.00, "stock_status": "available" }
```

`stock_status` is a computed field: `"available"` / `"low_stock"` / `"out_of_stock"`. Calculated in the serializer.

---

### 3.5 Stock Register

| Method | URL | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/stock_register/` | JWT | HOD, Storekeeper | List all procurement entries |
| POST | `/api/stock_register/` | JWT | Storekeeper | Create new stock entry |
| GET | `/api/stock_register/<id>/` | JWT | HOD, Storekeeper | Retrieve one entry with all items |

**POST `/api/stock_register/`**
```
Request: {
  "invoice_number": "INV-2026-001",
  "supplier_name": "Merck India",
  "purchase_date": "2026-04-20",
  "chemical_items": [
    { "chemical_name": "Hydrochloric Acid", "quantity_ml": 500, "rate": 150.00, "make": "Merck" }
  ],
  "apparatus_items": [
    { "apparatus_name": "Beaker 250ml", "quantity_pieces": 10, "rate": 45.00, "make": "Borosil" }
  ]
}
```

On save, for each `chemical_item`:
1. Look up `AvailableChemical` by `chemical_name` (case-insensitive).
2. If found: increment `available_quantity_ml`. If the request includes a new `reorder_level`, update it.
3. If not found: create `AvailableChemical`. `reorder_level` is mandatory in this case — return `400` if missing.

Same logic applies for `apparatus_items` → `AvailableApparatus`.

All of the above runs inside `@transaction.atomic`.

---

### 3.6 Stock Requests

| Method | URL | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/stock_request/` | JWT | All | List requests (filtered by role — see below) |
| POST | `/api/stock_request/` | JWT | Staff | Create draft request |
| GET | `/api/stock_request/<id>/` | JWT | All | Retrieve one request |
| PATCH | `/api/stock_request/<id>/` | JWT | Staff | Edit draft (only while status=draft) |
| DELETE | `/api/stock_request/<id>/` | JWT | Staff | Delete draft (only while status=draft) |
| POST | `/api/stock_request/<id>/submit/` | JWT | Staff (owner) | draft → pending |
| POST | `/api/stock_request/<id>/cancel/` | JWT | Staff (owner) | pending → cancelled |
| POST | `/api/stock_request/<id>/accept/` | JWT | HOD | pending → accepted |
| POST | `/api/stock_request/<id>/reject/` | JWT | HOD | pending → rejected |
| POST | `/api/stock_request/<id>/mark_as_issued/` | JWT | Storekeeper | accepted → issued |
| POST | `/api/stock_request/<id>/report_usage/` | JWT | Staff (owner) | issued → reported |
| POST | `/api/stock_request/<id>/mark_as_completed/` | JWT | Storekeeper | reported → completed |

**List filtering by role:**
- Staff: sees only their own requests
- HOD: sees all requests, default filter = `pending`
- Storekeeper: sees all requests, default filter = `accepted` + `issued` + `reported`

**POST `/api/stock_request/<id>/reject/`**
```
Request:  { "rejection_reason": "Insufficient justification for requested quantity." }
Errors:
  - 400: rejection_reason is required
  - 400: rejection_reason must be at least 10 characters
```

**POST `/api/stock_request/<id>/report_usage/`**
```
Request: {
  "chemical_items": [
    { "chemical_item_id": 5, "actual_used_quantity_ml": 300, "returned_quantity_ml": 200 }
  ]
}
Validation: actual_used_quantity_ml + returned_quantity_ml must equal quantity_ml for each item.
If any item fails: return 400 with the specific item and the mismatch.
```

---

### 3.7 Damage Entries

| Method | URL | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/damaged_entry/` | JWT | HOD, Storekeeper | List all damage reports |
| POST | `/api/damaged_entry/` | JWT | Staff, Storekeeper | Create damage report |
| GET | `/api/damaged_entry/<id>/` | JWT | HOD, Storekeeper | Retrieve one report |

**POST `/api/damaged_entry/`**

On save, for each apparatus item in the report: decrement `AvailableApparatus.available_quantity_pieces` by `quantity_damaged`. If decrement would result in a negative value, reject the entire request with `400: "Insufficient apparatus quantity to record damage."` All inside `@transaction.atomic`.

---

### 3.8 Notifications

| Method | URL | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/notifications/` | JWT | Any | List own notifications (last 30 days) |
| PATCH | `/api/notifications/<id>/read/` | JWT | Any | Mark one notification as read |
| POST | `/api/notifications/mark_all_read/` | JWT | Any | Mark all as read |
| GET | `/api/notifications/unread_count/` | JWT | Any | Returns `{ "count": 3 }` |

Notifications are created server-side by a `NotificationService` called from within workflow transition actions. Frontend polls `/api/notifications/unread_count/` every 30 seconds.

---

### 3.9 Audit Logs

| Method | URL | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/audit/` | JWT | HOD | List audit logs with filter support |

Query params: `?user=<id>&action=<action>&from=<date>&to=<date>&page=<n>`

No create, update, or delete endpoints exist for audit logs. Write access is internal only via `AuditLogService`.

---

### 3.10 Reports

| Method | URL | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/reports/generate/` | JWT | HOD, Storekeeper | Generate a report |
| GET | `/api/reports/` | JWT | HOD, Storekeeper | List previously generated reports |

**POST `/api/reports/generate/`**
```
Request: {
  "report_type": "chemicals" | "apparatus" | "both",
  "date_from": "2026-01-01",
  "date_to": "2026-12-31",
  "format": "pdf" | "excel" | "csv"
}
Response: File download (Content-Disposition: attachment)
```

Report data per item:
- Opening stock = `available_quantity` at `date_from` (derived from audit trail or snapshot)
- Total purchased = sum of `ChemicalItem.quantity_ml` where `StockRegister.purchase_date` is in range
- Total used = sum of `IssueChemicals.actual_usage` where `IssueRegister.date` is in range
- Total damaged = sum of `DamagedApparatusItem.quantity_damaged` where `DamagedEntry.date` is in range
- Closing stock = current `available_quantity`

---

## 4. Business Logic Rules

### 4.1 Password Complexity
Enforced in a shared validator used by both the user creation serializer and the change-password endpoint.

```
- Minimum 8 characters
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 digit (0-9)
- At least 1 special character from: @ # $ % & *
- Cannot be equal to the user's employee_id (case-insensitive)
- On first-login change: cannot be the same as the current (pre-set) password
```

### 4.2 Account Lockout
```
- After 5 consecutive failed login attempts: set account_locked_until = now() + 30 minutes
- Reset failed_login_attempts to 0 on successful login
- On login attempt while locked: return 403 with locked_until timestamp
- Do not increment failed_login_attempts while locked (prevents lockout extension by brute force)
```

### 4.3 Draft Limit
```
- A staff member may have multiple drafts simultaneously (no draft count limit)
- A staff member may NOT submit a new request if they have an existing request in any of these states:
  pending | accepted | issued | reported
- Check is performed at submit time, not at draft creation time
- Error message: "You have an active request in progress. Complete or cancel it before submitting a new one."
```

### 4.4 Degree-Based Class Filtering
```
- When a staff member calls GET /api/classes/, the backend filters DegreeClass by request.user.degree
- If request.user.degree is null: return empty list with a message prompting HOD to assign a degree
- This filter is applied on the queryset in the view, not in the serializer
- HOD and Storekeeper bypass this filter entirely
```

### 4.5 First Login Flow
```
Frontend logic:
1. After login, check is_first_login in the response
2. If True: redirect to /change-password — all other routes redirect back here
3. After successful password change: is_first_login becomes False, redirect to dashboard
4. Backend enforces this: any protected endpoint checks is_first_login and returns
   403 with { "code": "FIRST_LOGIN_REQUIRED" } if True, except /api/auth/change-password/
```

---

## 5. State Transition Guards

Each guard is a check that must pass before the transition proceeds. If any guard fails, return `400` with a clear message. All transitions run inside `@transaction.atomic`.

### draft → pending (submit)
- Request must be in `draft` status
- `requested_by` must be the current user
- `date_of_use` must be today or in the future
- `chemical_items` must have at least 1 item
- For each chemical item: `AvailableChemical` with that name must exist (case-insensitive)
- For each chemical item: `quantity_ml` must be > 0
- Staff must not have an existing request in `pending | accepted | issued | reported`

### pending → cancelled (cancel)
- Request must be in `pending` status
- `requested_by` must be the current user
- Sets status to `cancelled`, records `cancelled_at = now()`

### pending → accepted (accept)
- Request must be in `pending` status
- Current user must have role `hod`

### pending → rejected (reject)
- Request must be in `pending` status
- Current user must have role `hod`
- `rejection_reason` must be provided and have >= 10 characters

### accepted → issued (mark_as_issued)
- Request must be in `accepted` status
- Current user must have role `store_keeper`
- For each chemical item in the request: re-check that `AvailableChemical.available_quantity_ml >= quantity_ml`
  - If any chemical fails this check: abort entire transaction, return `400` with the specific chemical name and available quantity
- Decrement `available_quantity_ml` for each chemical (inside `select_for_update()`)
- No decrement if it would result in negative quantity — abort with `400`

### issued → reported (report_usage)
- Request must be in `issued` status
- `requested_by` must be the current user
- For each chemical item: `actual_used_quantity_ml + returned_quantity_ml == quantity_ml` (exact match)
- Both values must be >= 0
- Store both values on `StockRequestChemicalItem`

### reported → completed (mark_as_completed)
- Request must be in `reported` status
- Current user must have role `store_keeper`
- For each chemical item: increment `AvailableChemical.available_quantity_ml` by `returned_quantity_ml`
- No increment if `returned_quantity_ml` is null — abort with `400`
- Create `IssueRegister` and `IssueChemicals` entries (see Section 6)

---

## 6. Inventory Math

All quantity operations use `select_for_update()` on the inventory row to prevent race conditions.

### On Stock Entry (POST /api/stock_register/)
```
For each chemical_item:
  chemical = AvailableChemical.objects.select_for_update().get(chemical_name__iexact=name)
  chemical.available_quantity_ml += item.quantity_ml
  chemical.save()

For each apparatus_item:
  apparatus = AvailableApparatus.objects.select_for_update().get(apparatus_name__iexact=name)
  apparatus.available_quantity_pieces += item.quantity_pieces
  apparatus.save()
```

### On Issue (accepted → issued)
```
For each chemical_item on the request:
  chemical = AvailableChemical.objects.select_for_update().get(chemical_name__iexact=item.chemical_name)
  if chemical.available_quantity_ml < item.quantity_ml:
      raise ValidationError(...)
  chemical.available_quantity_ml -= item.quantity_ml
  chemical.save()
```

### On Completion (reported → completed)
```
For each chemical_item on the request:
  chemical = AvailableChemical.objects.select_for_update().get(chemical_name__iexact=item.chemical_name)
  chemical.available_quantity_ml += item.returned_quantity_ml
  chemical.save()

# Then create IssueRegister entry:
ir = IssueRegister.objects.create(
  request_code=request.request_id,
  stock_request_db_id=request.pk,
  staff_name=request.requested_by.full_name,
  class_field=request.class_name,
  date=request.date_of_use,
  status='completed'
)
for item in request.chemical_items.all():
  IssueChemicals.objects.create(
    ir=ir,
    chemical_name=item.chemical_name,
    issued_quantity=item.quantity_ml,
    actual_usage=item.actual_used_quantity_ml,
    returned_quantity=item.returned_quantity_ml
  )
```

### On Damage Report (POST /api/damaged_entry/)
```
For each apparatus_item in the damage report:
  apparatus = AvailableApparatus.objects.select_for_update().get(apparatus_name__iexact=item.apparatus_name)
  if apparatus.available_quantity_pieces < item.quantity_damaged:
      raise ValidationError(...)
  apparatus.available_quantity_pieces -= item.quantity_damaged
  apparatus.save()
```

### Negative Quantity Guard (applied everywhere)
```
# Before any decrement, assert:
if (current_quantity - decrement_amount) < 0:
    raise ValidationError("Operation would result in negative quantity for {item_name}.")
```

---

## 7. Notification Events

`NotificationService.create(recipient, type, message, related_object_id, related_object_type)` is called inside the transition action, within the same transaction.

| Trigger | Recipient(s) | Message |
|---|---|---|
| Request submitted (draft → pending) | HOD | "New request {request_id} submitted by {staff_name}." |
| Request accepted | Staff, Storekeeper | Staff: "Your request {request_id} has been approved." / Storekeeper: "Request {request_id} is ready to be issued." |
| Request rejected | Staff | "Your request {request_id} has been rejected. Reason: {rejection_reason}" |
| Request cancelled | HOD | "Request {request_id} has been cancelled by {staff_name}." |
| Request issued | Staff | "Your chemicals for request {request_id} have been issued. Please collect them." |
| Usage reported | Storekeeper | "Staff has reported usage for request {request_id}. Ready to complete." |
| Request completed | Staff | "Request {request_id} has been completed and recorded." |
| Low stock triggered | HOD, Storekeeper | "{chemical_name} is low on stock. Available: {quantity}ml. Reorder level: {reorder_level}ml." |
| Damage report filed | HOD | "A damage report has been filed by {staff_name} for {apparatus_name}." |

**Low stock check:** Triggered after every stock decrement (issue, damage). If `available_quantity <= reorder_level` after the operation, fire the notification.

---

## 8. Audit Log Actions

`AuditLogService.log(user, action, entity_type, entity_id, description, request)` is called inside every relevant view, within the transaction.

| Action Constant | Triggered On |
|---|---|
| `USER_CREATED` | New user created by HOD |
| `USER_UPDATED` | User details or degree updated |
| `USER_DEACTIVATED` | User set to is_active=False |
| `PASSWORD_CHANGED` | Any password change (including first login) |
| `LOGIN_SUCCESS` | Successful login |
| `LOGIN_FAILED` | Failed login attempt |
| `ACCOUNT_LOCKED` | Account locked after 5 failures |
| `STOCK_ENTRY_ADDED` | New StockRegister created |
| `REQUEST_CREATED` | Draft created |
| `REQUEST_SUBMITTED` | draft → pending |
| `REQUEST_CANCELLED` | pending → cancelled |
| `REQUEST_ACCEPTED` | pending → accepted |
| `REQUEST_REJECTED` | pending → rejected |
| `REQUEST_ISSUED` | accepted → issued |
| `USAGE_REPORTED` | issued → reported |
| `REQUEST_COMPLETED` | reported → completed |
| `DAMAGE_REPORTED` | DamagedEntry created |
| `REPORT_GENERATED` | Report downloaded |

---

## 9. Report Generation

Reports are generated on demand. Use `reportlab` for PDF and `openpyxl` for Excel.

### PDF Report Structure
```
Header:   Department Name, "Laboratory Stock Report", Date Range, Generated On, Generated By
Section 1: Chemicals Inventory Table
           Columns: Chemical Name | Opening Stock | Purchased | Used | Closing Stock | Unit
Section 2: Apparatus Inventory Table
           Columns: Apparatus Name | Opening Stock | Purchased | Damaged | Closing Stock | Unit
Section 3: Low Stock Summary (items where closing stock <= reorder level)
Footer:   Page number, generation timestamp
```

### Excel Report Structure
```
Sheet 1: Chemicals — same columns as PDF section 1
Sheet 2: Apparatus — same columns as PDF section 2
Sheet 3: Low Stock Summary
```

### Data Calculation
```python
# For a given chemical and date range (date_from, date_to):

total_purchased = ChemicalItem.objects.filter(
    chemical_name__iexact=chemical.chemical_name,
    stock_register__purchase_date__range=(date_from, date_to)
).aggregate(total=Sum('quantity_ml'))['total'] or 0

total_used = IssueChemicals.objects.filter(
    chemical_name__iexact=chemical.chemical_name,
    ir__date__range=(date_from, date_to)
).aggregate(total=Sum('actual_usage'))['total'] or 0

closing_stock = chemical.available_quantity_ml  # Current live value

# Opening stock is not tracked as a snapshot currently.
# For v1: display "N/A" for opening stock and document this limitation.
# Post v1: add a periodic stock snapshot model.
```

---

## 10. Environment & Configuration

### Required `.env` Variables

```env
# Core
SECRET_KEY=<strong-random-key>          # No default in settings.py — app crashes if missing
DEBUG=False                              # True only in development
ALLOWED_HOSTS=192.168.1.10,localhost

# Database
DATABASE_URL=postgres://user:pass@host:5432/lms_db

# CORS
CORS_ALLOWED_ORIGINS=http://192.168.1.10:3000

# Media
MEDIA_ROOT=/var/www/lms/media
MEDIA_URL=/media/
```

### Settings Split

```
backend/
  settings/
    __init__.py
    base.py       # All common settings. SECRET_KEY loaded with os.environ['SECRET_KEY'] — no fallback.
    dev.py        # DEBUG=True, CORS allows localhost, relaxed email backend
    prod.py       # DEBUG=False, strict CORS, ALLOWED_HOSTS from env
```

### Frontend `.env`

```env
REACT_APP_API_BASE_URL=http://192.168.1.10:8000/api
```

Used in `src/utils/api.js`:
```javascript
const api = axios.create({ baseURL: process.env.REACT_APP_API_BASE_URL });
```

No `http://127.0.0.1:8000` anywhere in source code.

---

## 11. Idempotency

Idempotency means: **calling the same endpoint twice produces the same result as calling it once.** No duplicate operations. No double-decrements. No ghost records.

This is non-negotiable for a system where a slow mobile network can cause a user to tap a button twice, or where a frontend retry triggers a second API call before the first response arrives.

### Rule
Every state-changing endpoint must check the current state of the resource before acting. If the resource is already in the target state, return a clean success response — do not re-execute the operation.

### Implementation per endpoint

**Submit (draft → pending)**
```python
if request_obj.status != 'draft':
    return Response(
        {"success": False, "error": "This request has already been submitted."},
        status=400
    )
```

**Cancel (pending → cancelled)**
```python
if request_obj.status == 'cancelled':
    return Response({"success": True, "data": {"message": "Already cancelled."}}, status=200)
if request_obj.status != 'pending':
    return Response({"success": False, "error": "Only pending requests can be cancelled."}, status=400)
```

**Accept (pending → accepted)**
```python
if request_obj.status == 'accepted':
    return Response({"success": True, "data": {"message": "Already accepted."}}, status=200)
if request_obj.status != 'pending':
    return Response({"success": False, "error": "Only pending requests can be accepted."}, status=400)
```

**Reject (pending → rejected)**
```python
if request_obj.status == 'rejected':
    return Response({"success": True, "data": {"message": "Already rejected."}}, status=200)
if request_obj.status != 'pending':
    return Response({"success": False, "error": "Only pending requests can be rejected."}, status=400)
```

**Mark as Issued (accepted → issued)**
```python
if request_obj.status == 'issued':
    return Response({"success": True, "data": {"message": "Already issued."}}, status=200)
if request_obj.status != 'accepted':
    return Response({"success": False, "error": "Only accepted requests can be issued."}, status=400)
```

**Report Usage (issued → reported)**
```python
if request_obj.status == 'reported':
    return Response({"success": True, "data": {"message": "Usage already reported."}}, status=200)
if request_obj.status != 'issued':
    return Response({"success": False, "error": "Usage can only be reported for issued requests."}, status=400)
```

**Mark as Completed (reported → completed)**
```python
if request_obj.status == 'completed':
    return Response({"success": True, "data": {"message": "Already completed."}}, status=200)
if request_obj.status != 'reported':
    return Response({"success": False, "error": "Only reported requests can be completed."}, status=400)
```

### Why this matters
Without idempotency guards:
- A storekeeper on a slow network clicks "Issue" twice → inventory decrements twice → stock goes negative
- A staff member submits a draft twice on a double-tap → two pending requests exist → HOD is confused
- A completion is triggered twice → inventory incremented twice by returned quantity → stock inflated

With idempotency guards: the second call is harmless. The system is safe regardless of how many times a button is pressed.

### Stock Register (POST /api/stock_register/)
Invoice number uniqueness (`unique=True` on the field) handles idempotency here. A duplicate POST with the same invoice number returns `409 Conflict`.

---

## 12. Server-Side Logging

Console logs disappear when the server restarts. In production, **all logs must be written to persistent files.** When something goes wrong at 2am, the logs are the only way to understand what happened.

### What Must Be Logged

| Level | What |
|---|---|
| `ERROR` | All unhandled exceptions, 500 responses, failed transactions |
| `WARNING` | Failed login attempts, account lockouts, rejected requests, low stock triggers, any `400` response caused by a guard violation |
| `INFO` | Every incoming request (method, URL, user, response status, response time), every successful state transition, every stock quantity change |
| `DEBUG` | SQL queries (development only — never in production) |

### Django Logging Configuration (`settings/base.py`)

```python
import os

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,

    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} {name} {process:d} {thread:d} | {message}',
            'style': '{',
        },
        'simple': {
            'format': '[{asctime}] {levelname} | {message}',
            'style': '{',
        },
    },

    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'error_file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'errors.log'),
            'maxBytes': 1024 * 1024 * 10,  # 10MB per file
            'backupCount': 10,              # Keep last 10 files = 100MB max
            'formatter': 'verbose',
            'level': 'ERROR',
        },
        'info_file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'app.log'),
            'maxBytes': 1024 * 1024 * 10,
            'backupCount': 10,
            'formatter': 'verbose',
            'level': 'INFO',
        },
    },

    'loggers': {
        'django': {
            'handlers': ['console', 'error_file'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['error_file'],
            'level': 'ERROR',
            'propagate': False,
        },
        'lms': {
            # This is the application logger. Use: logger = logging.getLogger('lms')
            'handlers': ['console', 'info_file', 'error_file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
```

### Log Directory

```
backend/
  logs/
    app.log       # INFO and above — all application activity
    errors.log    # ERROR only — all failures and exceptions
```

The `logs/` directory must exist before the server starts. Add it to the project with a `.gitkeep` file. Add `logs/*.log` to `.gitignore` — log files are never committed to version control.

### How to Use the Application Logger

In every view, service, or utility file that needs logging:

```python
import logging
logger = logging.getLogger('lms')

# In a view:
logger.info(f"Request {request_obj.request_id} submitted by user {request.user.employee_id}")
logger.warning(f"Failed login attempt for employee_id={employee_id}. Attempt {attempts} of 5.")
logger.error(f"Transaction failed on issuing request {request_id}: {str(e)}", exc_info=True)
```

`exc_info=True` on error logs captures the full stack trace. This is mandatory on all `except` blocks that log errors.

### What Is Never Logged

- Passwords (plain text or hashed)
- JWT tokens
- Full request bodies containing sensitive fields
- Personal data beyond what is needed to identify the action (employee_id and action is sufficient)

### Production vs Development

In `settings/dev.py`: add `django.db.backends` logger at `DEBUG` level to log all SQL queries to console. This helps during development.

In `settings/prod.py`: SQL query logging is explicitly disabled. `DEBUG = False` already suppresses most of it, but be explicit.

### Log Rotation

`RotatingFileHandler` is configured with `maxBytes=10MB` and `backupCount=10`. This means:
- Each log file grows to 10MB then rotates
- Last 10 rotated files are kept = 100MB maximum per log type
- Oldest files are automatically deleted

This prevents the server disk from filling up over months of operation — a real production concern that most first deployments overlook.

