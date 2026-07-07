# OpenCode Session Prompt — Password Management & First-Login Enforcement

---

## OVERVIEW

Build three interconnected features for the LMS authentication system:

1. **First-login forced password change** — `is_first_login` field already exists on User model but is not enforced. Build the enforcement.
2. **Forgot password flow** — user requests reset via email, receives a secure link, sets new password.
3. **HOD account creation via Django admin** — document the correct superuser setup process.

**Email provider:** SendGrid (already installed as `sendgrid` in venv)
**API Key:** stored in `.env` as `SENDGRID_API_KEY`
**Sender email:** stored in `.env` as `DEFAULT_FROM_EMAIL`

---

## PROJECT CONTEXT

**Stack:** Django 5.2 + DRF, React 19 (CRA), PostgreSQL, JWT auth (djangorestframework-simplejwt)
**Auth endpoint base:** `/api/users/`
**Frontend base:** `http://localhost:3000/`
**Roles:** Staff, HOD, Storekeeper
**Mobile-first viewport:** 375px

---

## PART 1 — FIRST-LOGIN FORCED PASSWORD CHANGE

### Current State
- `is_first_login` Boolean field exists on the User model (default: `True`)
- HOD creates user accounts via `POST /api/users/create_user/`
- No enforcement exists — user can log in normally without changing password

### Required Behaviour
- On login (`POST /api/users/login/`), if `is_first_login == True`:
  - Do NOT return normal JWT tokens
  - Return HTTP 200 with a specific response body:
    ```json
    {
      "first_login": true,
      "message": "You must change your password before continuing.",
      "user_id": "<user_id>",
      "temp_token": "<short-lived JWT or signed token for password change only>"
    }
    ```
  - `temp_token` must be a short-lived token (15 minutes) that is ONLY valid for the change password endpoint — not for any other API calls
- Frontend detects `first_login: true` → redirects to `/change-password` page
- User sets new password via `POST /api/users/change_password/` with `temp_token`
- On success:
  - Set `is_first_login = False` on user record
  - Return normal JWT access + refresh tokens
  - Frontend stores tokens and redirects to dashboard

### Password Validation Rules (apply to all password change/reset flows)
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character (`@`, `#`, `$`, `%`, `^`, `&`, `+`, `=`, `!`)
- Cannot be the same as the temporary/old password
- Enforce via Django password validators in `settings.py` AND at serializer level

### Change Password Endpoint (existing — verify and update if needed)
```
POST /api/users/change_password/
Headers: Authorization: Bearer <temp_token>
Body: {
  "old_password": "temporarypassword123",
  "new_password": "NewSecure@123",
  "confirm_password": "NewSecure@123"
}
```
- Validate `new_password == confirm_password`
- Validate new password meets complexity rules
- Validate `old_password` matches current password
- On success: set `is_first_login = False`, return fresh JWT tokens

---

## PART 2 — FORGOT PASSWORD FLOW

### Flow Overview
```
User clicks "Forgot Password" on login page
→ Enters Employee ID + registered email
→ Backend validates: Employee ID exists AND email matches user profile
→ Backend generates secure reset token (UUID or signed token, 30-minute expiry)
→ Backend sends email via SendGrid with reset link
→ User clicks link in email → lands on /reset-password?token=<token>
→ User enters new password + confirm
→ Backend validates token (not expired, not used) + password complexity
→ Backend updates password, marks token as used
→ User redirected to login page with success message
```

### New Model — PasswordResetToken

```python
# Create in users app or a new auth_utils app
class PasswordResetToken(models.Model):
    user = models.ForeignKey(UserAccount, on_delete=models.CASCADE)
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    def is_valid(self):
        from django.utils import timezone
        return not self.is_used and timezone.now() < self.expires_at

    class Meta:
        db_table = 'password_reset_token'
```

Run migration after creating this model.

### New Endpoints

#### Request Password Reset
```
POST /api/users/forgot-password/
Permission: AllowAny (no auth required)
Body: {
  "employee_id": "STAFF001",
  "email": "staff@example.com"
}
```
- Validate employee_id exists AND email matches `user.email` (case-insensitive)
- If valid: generate `PasswordResetToken`, send email
- If invalid: return HTTP 200 with generic message (do NOT reveal whether employee_id or email was wrong — prevents enumeration attack)
- Response (always):
  ```json
  {"message": "If your details are correct, a password reset link has been sent to your email."}
  ```
- Delete any existing unused tokens for this user before creating new one

#### Reset Password
```
POST /api/users/reset-password/
Permission: AllowAny (no auth required)
Body: {
  "token": "<uuid>",
  "new_password": "NewSecure@123",
  "confirm_password": "NewSecure@123"
}
```
- Validate token exists, not expired, not used
- Validate password complexity
- Validate `new_password == confirm_password`
- On success:
  - Update user password
  - Mark token `is_used = True`
  - Set `is_first_login = False` if it was True
  - Return: `{"message": "Password reset successful. You can now log in."}`
- On invalid token: HTTP 400 `{"error": "Invalid or expired reset link."}`

#### Verify Reset Token (optional but recommended)
```
GET /api/users/reset-password/verify/?token=<uuid>
Permission: AllowAny
```
- Returns 200 if token is valid, 400 if expired/used
- Frontend uses this on page load to show error before user fills the form

### SendGrid Email Integration

```python
# backend/users/email_utils.py

import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

def send_password_reset_email(to_email: str, employee_id: str, reset_token: str, frontend_url: str):
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    
    message = Mail(
        from_email=os.environ.get('DEFAULT_FROM_EMAIL'),
        to_emails=to_email,
        subject='GNC Chemistry Lab — Password Reset Request',
        html_content=f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1E3A8A;">Guru Nanak College</h2>
            <h3>Department of Chemistry — Lab Management System</h3>
            <hr/>
            <p>Hello <strong>{employee_id}</strong>,</p>
            <p>We received a request to reset your password.</p>
            <p>Click the button below to reset your password. This link expires in <strong>30 minutes</strong>.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_link}" 
                   style="background-color: #1E3A8A; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; font-size: 16px;">
                    Reset Password
                </a>
            </div>
            <p>If you did not request this, ignore this email. Your password will not change.</p>
            <p>This link will expire at: <strong>{{}}</strong></p>
            <hr/>
            <p style="color: #666; font-size: 12px;">
                GNC Chemistry Lab Management System<br/>
                Guru Nanak College (PG and Research Programme)<br/>
                Department of Chemistry
            </p>
        </div>
        """
    )
    
    try:
        sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
        response = sg.send(message)
        return response.status_code == 202
    except Exception as e:
        print(f"SendGrid error: {e}")
        return False
```

**Frontend URL for reset link:**
- Read from `.env` as `FRONTEND_URL=http://localhost:3000`
- In production this will be the deployed frontend URL

---

## PART 3 — FRONTEND PAGES

### Page 1 — Login Page Updates

Add "Forgot Password?" link below the password field:
```jsx
<p style={{textAlign: 'right'}}>
  <Link to="/forgot-password">Forgot Password?</Link>
</p>
```

On login API response, check for `first_login: true`:
```javascript
const response = await api.post('/users/login/', credentials);
if (response.data.first_login) {
  // Store temp_token temporarily (sessionStorage only — not localStorage)
  sessionStorage.setItem('temp_token', response.data.temp_token);
  sessionStorage.setItem('user_id', response.data.user_id);
  navigate('/change-password');
} else {
  // Normal login flow — store JWT tokens
}
```

### Page 2 — Change Password Page (`/change-password`)

```
frontend/src/pages/auth/ChangePassword.jsx
```

- Fields: Old Password, New Password, Confirm New Password (all with eye toggle)
- Show password complexity requirements as a checklist that updates in real-time as user types
- On submit: `POST /api/users/change_password/` with `temp_token` from sessionStorage
- On success: clear sessionStorage, store JWT tokens, redirect to `/dashboard`
- If user navigates to this page without `temp_token` in sessionStorage → redirect to `/login`

### Page 3 — Forgot Password Page (`/forgot-password`)

```
frontend/src/pages/auth/ForgotPassword.jsx
```

- Fields: Employee ID, Email Address
- On submit: `POST /api/users/forgot-password/`
- Always show generic success message regardless of API response (mirrors backend security)
- Success state: show message + "Back to Login" button
- No loading spinner needed — just disable button during request

### Page 4 — Reset Password Page (`/reset-password`)

```
frontend/src/pages/auth/ResetPassword.jsx
```

- On page load: extract `token` from URL query params
- Immediately call `GET /api/users/reset-password/verify/?token=<token>`
  - If invalid/expired: show error "This reset link is invalid or has expired." + link to `/forgot-password`
  - If valid: show the reset form
- Fields: New Password, Confirm New Password (both with eye toggle)
- Real-time password complexity checklist
- On submit: `POST /api/users/reset-password/`
- On success: show "Password reset successfully!" + redirect to `/login` after 3 seconds

### Password Complexity Checklist Component (reusable)

```
frontend/src/components/auth/PasswordChecklist.jsx
```

```jsx
// Shows live validation as user types
const rules = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'One number', test: (p) => /\d/.test(p) },
  { label: 'One special character (@#$%^&+=!)', test: (p) => /[@#$%^&+=!]/.test(p) },
];
// Each rule shows green ✓ or red ✗ as user types
```

---

## PART 4 — HOD ACCOUNT SETUP (Django Admin)

Document the correct process in `DEPLOYMENT.md`:

```markdown
## Creating the Initial HOD Account

HOD accounts are created once at deployment via Django admin — not through the app.

Step 1: Create a superuser
  python manage.py createsuperuser

Step 2: In Django admin (http://localhost:8000/admin/), create a UserAccount with:
  - employee_id: HOD001 (or as required)
  - role: HOD
  - is_first_login: True (forces password change on first login)
  - Set a temporary password

Step 3: HOD logs in via the LMS frontend
  - System detects is_first_login = True
  - HOD is redirected to /change-password
  - HOD sets their permanent password
  - HOD can now create Staff and Storekeeper accounts via the app
```

---

## ENVIRONMENT VARIABLES

Add these to `.env` if not already present:

```
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxx
DEFAULT_FROM_EMAIL=yourname@gmail.com
FRONTEND_URL=http://localhost:3000
PASSWORD_RESET_TOKEN_EXPIRY_MINUTES=30
FIRST_LOGIN_TOKEN_EXPIRY_MINUTES=15
```

Read all values via `python-decouple` (already installed):
```python
from decouple import config
SENDGRID_API_KEY = config('SENDGRID_API_KEY')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL')
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:3000')
```

---

## IMPLEMENTATION ORDER

Execute in this exact order:

1. Verify `is_first_login` field exists on UserAccount model and in DB
2. Update login view to detect `is_first_login == True` and return `temp_token` response
3. Update change password view to accept `temp_token`, enforce complexity, set `is_first_login = False`
4. Create `PasswordResetToken` model and run migration
5. Create `backend/users/email_utils.py` with SendGrid helper
6. Build `POST /api/users/forgot-password/` endpoint
7. Build `POST /api/users/reset-password/` endpoint
8. Build `GET /api/users/reset-password/verify/` endpoint
9. Register all new URLs
10. Test all backend endpoints manually with curl or Postman
11. Build `PasswordChecklist.jsx` reusable component
12. Build `ChangePassword.jsx` page
13. Build `ForgotPassword.jsx` page
14. Build `ResetPassword.jsx` page
15. Update Login page with `first_login` detection and "Forgot Password?" link
16. Add all new routes to React Router
17. Test full first-login flow end to end
18. Test full forgot password flow end to end
19. Update `DEPLOYMENT.md` with HOD account setup instructions

---

## CRITICAL GUARDS

- `temp_token` for first-login must ONLY work on the change password endpoint — reject it on all other endpoints
- NEVER store `temp_token` in localStorage — use sessionStorage only (cleared when tab closes)
- The forgot password response must ALWAYS return the same generic message regardless of whether the employee_id/email exists — prevents user enumeration
- Delete existing unused reset tokens before creating a new one — prevents token accumulation
- Password reset tokens must be single-use — mark `is_used = True` immediately on successful reset
- All password complexity rules must be enforced at BOTH backend (serializer) and frontend (real-time checklist) levels
- Eye icon toggle must be present on ALL password fields across all auth pages
- Mobile viewport (375px): all auth pages must be single column, inputs full width, buttons full width
- Do NOT allow reset password or change password to set the same password as the current one
