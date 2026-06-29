# Deployment Guide — Laboratory Management System

## Prerequisites

- Python 3.10+
- Node.js 16+
- PostgreSQL 12+
- A SendGrid account (for password reset emails)

---

## 1. Environment Setup

Copy `backend/.env.example` to `backend/.env` and configure:

```ini
# Database
DB_NAME=lms_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

# Frontend URL (used in password reset links and CORS)
FRONTEND_URL=http://localhost:3000

# SendGrid (for password reset emails)
SENDGRID_API_KEY=your_sendgrid_api_key
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
```

---

## 2. Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Backend runs on `http://127.0.0.1:8000`.

---

## 3. Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend runs on `http://localhost:3000`.

---

## 4. Creating the First HOD Account

The system has no registration endpoint. You must create the first HOD (Head of Department) user via Django shell or superuser command.

### Option A: Django Superuser (recommended for first setup)

```bash
cd backend
venv\Scripts\activate
python manage.py createsuperuser
```

Follow the prompts. The superuser is automatically created with:
- Role: `hod`
- `password_must_change`: `False`
- `is_first_login`: `False`

### Option B: Django Shell (for more control)

```bash
cd backend
venv\Scripts\activate
python manage.py shell
```

```python
from users.models import User

user = User.objects.create_user(
    employee_id='HOD001',
    email='hod@college.edu',
    full_name='Dr. Head of Department',
    password='Temp@1234',
    role='hod',
    designation='Head of Department',
    department='B.Sc Chemistry',
    phone='+919876543210',
)
user.is_first_login = True
user.password_must_change = True
user.save()
```

The user will be forced to change their password on first login.

---

## 5. Creating Additional Users (HOD only)

Once the HOD account exists, log in at `/login` and navigate to `User Management` to create:

- **Store Keeper** — manages stock registers and damaged entries
- **Staff** — can submit chemical requests and view inventory

Only one HOD and one Store Keeper can be active at a time (enforced by serializer validation).

---

## 6. Password Management Features

### First-Login Flow
1. HOD creates a user via User Management
2. System generates/assigns a temporary password
3. User logs in with temporary credentials
4. User is redirected to `/change-password` and must set a permanent password
5. On success, user receives full JWT tokens and is redirected to the dashboard

### Change Password (Authenticated)
- Any authenticated user can change their password at `/change-password`
- Old password verification is required
- New password must meet complexity rules (8+ chars, upper, lower, digit, special)

### Forgot Password
- Visit `/forgot-password`
- Enter Employee ID and registered email address
- A reset link is sent via SendGrid
- Link expires after 30 minutes (configurable via `PASSWORD_RESET_TOKEN_EXPIRY_MINUTES`)

### Password Complexity Rules
| Rule | Description |
|------|-------------|
| Minimum length | 8 characters |
| Uppercase | At least 1 uppercase letter |
| Lowercase | At least 1 lowercase letter |
| Digit | At least 1 digit |
| Special | At least 1 special character from `@#$%^&+=!` |

### Account Lockout
- 5 failed login attempts → account locked for 30 minutes
- Configured in settings via `MAX_FAILED_LOGIN_ATTEMPTS` and `ACCOUNT_LOCKOUT_DURATION`

---

## 7. Year-End Report Feature

Accessible at `/reports/year-end` by HOD and Store Keeper roles only.

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/reports/year-end/` | GET | JSON data for all report charts (query params: `year`, `department`) |
| `/api/reports/year-end/download/pdf/` | GET | Download PDF report |
| `/api/reports/year-end/download/excel/` | GET | Download Excel report |

### PDF/Excel Dependencies

- **PDF:** ReportLab (`pip install reportlab`)
- **Excel:** openpyxl (`pip install openpyxl`)

Both are listed in `requirements.txt`.

### Charts on the Dashboard
1. Opening/Closing Stock Summary (Bar)
2. Monthly Stock Receipts (Line)
3. Monthly Issues (Line)
4. Chemical-wise Consumption (Bar)
5. Department-wise Usage (Bar)
6. Usage by Class (Bar — groups B.Sc/M.Sc)
7. Damaged Stock Summary (Bar)

---

## 8. HOD Setup — Quick-Start Checklist

1. [ ] Create PostgreSQL database
2. [ ] Configure `.env` with DB credentials and SendGrid API key
3. [ ] Run migrations: `python manage.py migrate`
4. [ ] Create superuser: `python manage.py createsuperuser`
5. [ ] Start backend: `python manage.py runserver`
6. [ ] Start frontend: `npm start`
7. [ ] Log in with superuser credentials
8. [ ] Navigate to User Management and create Store Keeper and Staff accounts
9. [ ] Verify password reset by testing `/forgot-password` with a staff account

---

## 9. Troubleshooting

| Problem | Solution |
|---------|----------|
| CORS error on login | Ensure `FRONTEND_URL` in `.env` matches the frontend address |
| Emails not sending | Verify `SENDGRID_API_KEY` in `.env` and that SendGrid sender is verified |
| First-login redirect loop | Clear `localStorage` and `sessionStorage` in browser DevTools |
| Report PDF not generating | Run `pip install reportlab` |
| Report Excel not generating | Run `pip install openpyxl` |
| Database connection error | Verify PostgreSQL is running and `.env` credentials are correct |
| `user_account` table not found | Models use `managed = False` — ensure the database has the required tables created by a DBA or migration |
