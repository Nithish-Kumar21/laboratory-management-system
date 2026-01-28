import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, isAdmin, user, loading } = useAuth();
  const location = useLocation();

  console.log('ProtectedRoute Debug:', {
    path: location.pathname,
    isAuthenticated,
    loading,
    passwordMustChange: user?.password_must_change,
    adminOnly
  });

  if (loading) {
    console.log('ProtectedRoute: Loading...');
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute: Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Force password change if required
  if (user.password_must_change && location.pathname !== '/change-password') {
    console.log('ProtectedRoute: Force password change redirect');
    return <Navigate to="/change-password" state={{ forced: true }} replace />;
  }

  if (adminOnly && !isAdmin) {
    console.log('ProtectedRoute: Admin only access denied');
    return <Navigate to="/" replace />;
  }

  console.log('ProtectedRoute: Rendering children');
  return children;
};

export default ProtectedRoute;
