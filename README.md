# Laboratory Management System

Full-stack web application for managing laboratory inventory, stock registers, damaged entries, and issue tracking.

## Tech Stack
- **Backend:** Python Django, Django REST Framework
- **Frontend:** React.js
- **Database:** PostgreSQL

## Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js 16+
- PostgreSQL 12+

### Backend Setup

cd backend
python -m venv venv
venv\Scripts\activate # Windows (Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver


### Frontend Setup

cd frontend
npm install
npm start


### Database Configuration
Create a PostgreSQL database and update `backend/backend/settings.py` with your credentials.

## Team Members
- [Add your names here]

## Development Status
Active development - LMS modules: Inventory, Stock Register, Damaged Entry, Issue Register
