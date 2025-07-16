# 🧪 Laboratory Management System (LMS) – PWA

A Progressive Web App (PWA) built for managing academic laboratory inventory and request workflows, with role-based access for streamlined operations.

## 🔧 Tech Stack

- **Frontend**: React.js + Tailwind CSS 
- **Backend**: Django (Python)
- **Database**: MySQL
- **API**: Django REST Framework (DRF)
- **Authentication**: Django custom user model (role-based)
- **PWA Features**: Service Worker + Web Manifest

## 👥 User Roles & Features

### 👩‍🏫 Staff
- View inventory
- Create and submit request forms
- Report actual usage post-lab (required)
- View request status (Pending / Approved / Issued / Completed)

### 🧑‍🔬 Store Keeper
- Add/edit inventory and stock entries
- Issue stock to approved requests
- Log damaged items
- View restock alerts and stock register

### 👨‍💼 HOD
- View all request forms
- Approve or reject submitted requests
- View stock and usage reports
- Set restock thresholds
