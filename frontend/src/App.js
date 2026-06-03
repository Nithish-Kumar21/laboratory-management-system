import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Header from './layout/Header';
import Sidebar from './layout/Sidebar';
import BottomNav from './layout/BottomNav';
import ProtectedRoute from './components/ProtectedRoute';
import StaffLayout from './layouts/StaffLayout';
import Login from './components/Login';
import ChangePassword from './components/ChangePassword';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import UserManagement from './components/UserManagement';
import UserProfile from './components/UserProfile';
import Home from './pages/Home';
import Inventory from './pages/Inventory';
import StockRegister from './pages/StockRegister';
import StockRegisterDetail from './pages/StockRegisterDetail';
import IssueRegister from './pages/IssueRegister';
import IssueRegisterDetail from './pages/IssueRegisterDetail';
import DamagedEntry from './pages/DamagedEntry';
import DamagedEntryDetail from './pages/DamagedEntryDetail';
import StockRequest from './pages/StockRequest';
import StockRequestDetail from './pages/StockRequestDetail';
import Settings from './components/Settings';
import LowStockToast from './components/LowStockToast';
import './styles/App.css';

function HomeOrRedirect() {
  const { isAdmin, isHOD } = useAuth();
  if (isAdmin && !isHOD) return <Navigate to="/users" replace />;
  return <Home />;
}

function AdminBlock({ children, redirectTo = '/users' }) {
  const { isAdmin } = useAuth();
  if (isAdmin) return <Navigate to={redirectTo} replace />;
  return children;
}

function AppContent() {
  const { loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />

        {/* Staff Routes */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute>
              <StaffLayout />
            </ProtectedRoute>
          }
        >
          <Route path="inventory" element={<div className="page-placeholder">Inventory — coming soon</div>} />
          <Route path="chemical-request" element={<div className="page-placeholder">Chemical Request — coming soon</div>} />
          <Route path="draft" element={<div className="page-placeholder">Draft — coming soon</div>} />
          <Route path="settings" element={<div className="page-placeholder">Settings — coming soon</div>} />
          <Route index element={<Navigate to="inventory" replace />} />
        </Route>

        {/* Protected Routes with Layout */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="app-layout">
                <Header />
                <Sidebar />
                <div className="main-content-area">
                  <LowStockToast />
                  <div className="page-container">
                    <Routes>
                      <Route path="" element={<HomeOrRedirect />} />
                      <Route path="profile" element={<UserProfile />} />

                      {/* HOD Only */}
                      <Route
                        path="users"
                        element={
                          <ProtectedRoute adminOnly>
                            <UserManagement />
                          </ProtectedRoute>
                        }
                      />

                      <Route path="settings" element={<Settings />} />

                      {/* Existing Routes - HOD has access to inventory and stock-register */}
                      <Route path="inventory" element={<Inventory />} />
                      <Route path="stock-register" element={<StockRegister />} />
                      <Route path="stock-register/:id" element={<StockRegisterDetail />} />
                      <Route path="issue-register" element={<IssueRegister />} />
                      <Route path="issue-register/:id" element={<IssueRegisterDetail />} />
                      <Route path="damaged-entry" element={<DamagedEntry />} />
                      <Route path="damaged-entry/:id" element={<DamagedEntryDetail />} />
                      <Route path="requests" element={<StockRequest />} />
                      <Route path="requests/:id" element={<StockRequestDetail />} />
                      <Route path="drafts" element={<StockRequest draftsOnly />} />

                      {/* Catch all - redirect to home */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </div>
                </div>
                <BottomNav />
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;


