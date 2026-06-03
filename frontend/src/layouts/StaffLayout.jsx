import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StaffHeader from '../components/staff/StaffHeader';
import StaffSidebar from '../components/staff/StaffSidebar';
import StaffBottomNav from '../components/staff/StaffBottomNav';

function StaffLayout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      <StaffHeader hasNotification={true} />
      <div className="flex min-h-screen">
        <StaffSidebar onLogout={logout} />
        <main className="lg:ml-[220px] mt-[56px] min-h-[calc(100vh-56px)] bg-[#F0F2F5] p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
      <StaffBottomNav hasNotification={true} />
    </div>
  );
}

export default StaffLayout;
