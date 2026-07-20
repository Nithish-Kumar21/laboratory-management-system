# Multi-Department Architecture Decision

**Date:** 2026-07-14
**Status:** Decided
**Approach:** Multi-Database per Department

---

## Context

The current Laboratory Management System is built for a single department. The system needs to scale to support multiple departments, each with:

- Department-specific inventory (apparatus and chemicals are NOT shared)
- Independent configurations and likely schema variations
- Department-scoped roles (HOD sees only their department)
- An Admin role with cross-department monitoring privileges

## Decision: Multi-Database Architecture

**Each department gets its own PostgreSQL database.** A shared `default` database holds authentication, user accounts, and cross-cutting concerns.

### Why Not Column-Based Isolation

| Factor | Column-Based | Multi-Database |
|---|---|---|
| Department-specific inventory | Filter every query, risk of leaks | Native isolation per DB |
| HOD scoped to own department | Requires filter on every ViewSet | Routes to own DB automatically |
| Different schemas per dept | Single schema, hard to diverge | Independent migrations per DB |
| Different configs per dept | Shared table, awkward to partition | Each DB has its own config |
| Admin across all depts | Same, but less isolation | Explicit multi-DB queries |
| Future growth | Add columns + filter logic everywhere | Add DB = add department |

---

## Database Topology

```
default DB                     dept_chemistry_bsc              dept_chemistry_msc
──────────────                 ──────────────────              ──────────────────
user_account                   available_chemicals             available_chemicals
auth_group                     available_apparatus             available_apparatus
auth_permission                low_stock_chemicals             low_stock_chemicals
auth_group_permissions         low_stock_apparatus             low_stock_apparatus
auth_user_permissions          stock_register                  stock_register
token_blacklist_*              chemical_item                   chemical_item
password_reset_token           apparatus_item                  apparatus_item
degree_class                   stock_request                   stock_request
audit_log                      stock_request_chemical_item     stock_request_chemical_item
django_migrations              stock_request_apparatus_item    stock_request_apparatus_item
django_session                 issue_register                  issue_register
django_admin_log               issue_chemicals                 issue_chemicals
django_content_type            damaged_entry                   damaged_entry
                               damaged_item                    damaged_item
                               service_entry                   service_entry
                               service_entry_items             service_entry_items
                               service_entry_item_logs         service_entry_item_logs
                               lab_configuration               lab_configuration
```

---

## Role Design

| Role | Access | Database Scope |
|---|---|---|
| **Admin** | Cross-department monitoring, user management | `default` DB + read queries across all department DBs |
| **HOD** | Full access to own department | Own department DB only |
| **Store Keeper** | Inventory, stock, issues, damaged, service in own dept | Own department DB only |
| **Staff** | Create requests, view own data | Own department DB only |

### Admin Role (Reinstated)

The Admin role provides institution-wide oversight:

- **Dashboard:** Aggregated view of all departments' stock levels, requests, low-stock alerts
- **User Management:** Create/edit users across all departments
- **Reports:** Institution-wide year-end reports spanning all departments
- **Read-only** across department DBs (does not modify department data)

---

## Key Components to Build

### 1. Department Model (in `default` DB)

```python
class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)       # e.g., "B.Sc Chemistry"
    db_name = models.CharField(max_length=63, unique=True)     # e.g., "dept_chemistry_bsc"
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        db_table = 'department'
```

### 2. DatabaseRouter

Routes queries automatically based on `request.user.department.db_name`:

- Inventory, stock_register, stock_request, damaged_entry, service_entry, issue_register queries -> department DB
- User, auth, token, audit queries -> `default` DB
- Admin user can query all department DBs explicitly

### 3. User Model Changes

- `department` field changes from `CharField` with hardcoded choices to `ForeignKey(Department)`
- Singleton HOD/Store Keeper validation scoped **per department**, not globally
- `department.db_name` determines which database the user's queries route to

### 4. Provision Department Command

```
python manage.py provision_department --name "Ph.D Chemistry" --db-name "dept_chemistry_phd"
```

Creates the database, runs all migrations, seeds default lab_configuration.

### 5. Admin Cross-Department Query Helpers

Utility functions that iterate over all active department DBs and merge results for admin views.

### 6. Frontend Changes

- Admin gets a **department selector dropdown** in the header to filter views
- Admin also gets an **aggregated dashboard** combining all departments
- Department dropdowns in user CRUD become dynamic (fetched from API)
- `AddRequestModal` class options properly filter by department

---

## Migration Strategy

1. Create `Department` model in `default` DB
2. Create department DBs for existing departments (`B.Sc Chemistry`, `M.Sc Chemistry`)
3. Run all inventory/stock/request/damage/service migrations against each dept DB
4. Migrate existing data from current single DB into the appropriate department DBs
5. Update `User.department` from `CharField` to `ForeignKey(Department)`
6. Deploy `DepartmentRouter`
7. Update all ViewSets to work with routed queries
8. Update frontend for Admin department selector

---

## Module Mapping

Each of these Django apps will have their tables in department-specific DBs:

| App | Tables |
|---|---|
| `inventory` | `available_chemicals`, `available_apparatus`, `low_stock_*`, `lab_configuration` |
| `stock_register` | `stock_register`, `chemical_item`, `apparatus_item` |
| `stock_request` | `stock_request`, `stock_request_*_item`, `issue_register`, `issue_chemicals` |
| `damaged_entry` | `damaged_entry`, `damaged_item` |
| `service_entry` | `service_entry`, `service_entry_items`, `service_entry_item_logs` |

These apps will remain in `default` DB:

| App | Tables |
|---|---|
| `users` | `user_account`, `degree_class`, `password_reset_token` |
| `audit` | `audit_log` |
| Django built-ins | `auth_*`, `django_*`, `token_blacklist_*` |

---

## Tradeoffs Acknowledged

| Tradeoff | Mitigation |
|---|---|
| Cross-DB joins not possible | Admin queries merge in Python; no need for cross-DB FKs |
| Migrations run per-DB | Automated via `provision_department` command |
| More operational complexity (N databases) | PgBouncer pooling; automated backup script |
| Adding department requires DB creation | Management command + optional admin UI later |
| User cannot belong to multiple departments | Acceptable constraint; user record lives in `default` DB with single dept FK |

---

## Implementation Order

1. **Phase 1 - Foundation:** Department model, DatabaseRouter, provision command
2. **Phase 2 - User Model:** Migrate user.department to FK, scope singleton validation per dept
3. **Phase 3 - Data Migration:** Move existing data to department DBs
4. **Phase 4 - ViewSets:** Update all ViewSets to work with routed queries
5. **Phase 5 - Admin:** Cross-department query helpers, aggregated dashboard
6. **Phase 6 - Frontend:** Department selector, dynamic dropdowns, Admin UI
7. **Phase 7 - Reports:** Department-scoped and institution-wide reports
