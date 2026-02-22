import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import TopBar from './layout/TopBar';
import Sidebar from './layout/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
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
  const { isAdmin } = useAuth();
  if (isAdmin) return <Navigate to="/users" replace />;
  return <Home />;
}

function AdminBlock({ children, redirectTo = '/users' }) {
  const { isAdmin } = useAuth();
  if (isAdmin) return <Navigate to={redirectTo} replace />;
  return children;
}

function AppContent() {
  const { loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(window.innerWidth > 1024);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />

        {/* Protected Routes with Hybrid Layout */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className={`app-layout ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
                <TopBar onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
                <Sidebar isOpen={isSidebarOpen} isMobile={isMobile} />

                {isMobile && isSidebarOpen && (
                  <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
                )}

                <div className="main-content-area">
                  <LowStockToast />
                  <div className="page-container">
                    <Routes>
                      <Route path="" element={<HomeOrRedirect />} />
                      <Route path="profile" element={<UserProfile />} />

                      {/* Admin Only */}
                      <Route
                        path="users"
                        element={
                          <ProtectedRoute adminOnly>
                            <UserManagement />
                          </ProtectedRoute>
                        }
                      />

                      <Route path="settings" element={<Settings />} />

                      {/* Existing Routes - admin has no access to inventory or stock-register */}
                      <Route path="inventory" element={<AdminBlock redirectTo="/users"><Inventory /></AdminBlock>} />
                      <Route path="stock-register" element={<AdminBlock redirectTo="/users"><StockRegister /></AdminBlock>} />
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


