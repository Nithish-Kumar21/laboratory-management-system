import React, { useState } from 'react';
import { FaFlask, FaBell, FaMoon, FaSun } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';

function getInitials(user) {
  if (!user) return 'ST';
  if (user.role === 'staff') return 'ST';
  return user.full_name ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'ST';
}

function StaffHeader({ hasNotification = false }) {
  const { user } = useAuth();
  const [isDark, setIsDark] = useState(false);

  const name = user?.full_name || 'Staff';
  const role = user?.role || 'Store Department';
  const roleLabel = role === 'hod' ? 'Head of Department' : role === 'store_keeper' ? 'Store Keeper' : role === 'staff' ? 'Staff' : role;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-[56px] px-4 lg:px-6 bg-[#1A3C6E]">
      <div className="flex items-center gap-2">
        <FaFlask className="text-white text-[22px] shrink-0" />
        <span className="text-white text-[20px] font-bold">LMS</span>
      </div>
      <div className="flex items-center gap-3 ml-auto">
        <button className="relative bg-transparent border-none text-white/85 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer text-xl hover:text-white hover:bg-white/10 shrink-0 p-0" title="Notifications">
          <FaBell />
          {hasNotification && <span className="absolute top-1 right-1 w-[6px] h-[6px] rounded-full bg-red-500" />}
        </button>
        <button className="bg-transparent border-none text-white/85 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer text-xl hover:text-white hover:bg-white/10 shrink-0 p-0" onClick={() => setIsDark(!isDark)} title="Toggle theme">
          {isDark ? <FaSun /> : <FaMoon />}
        </button>
        <div className="w-[34px] h-[34px] rounded-full bg-[#4A90D9] flex items-center justify-center text-white text-[13px] font-semibold shrink-0">
          {getInitials(user)}
        </div>
        <div className="hidden lg:flex flex-col leading-tight">
          <span className="text-white text-[14px] font-medium">{name}</span>
          <span className="text-white/60 text-[12px]">{roleLabel}</span>
        </div>
      </div>
    </header>
  );
}

export default StaffHeader;
