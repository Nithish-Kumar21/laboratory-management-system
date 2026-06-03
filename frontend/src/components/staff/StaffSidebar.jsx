import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaBoxes, FaFileAlt, FaEdit, FaCog, FaSignOutAlt } from 'react-icons/fa';

const navItems = [
  { to: '/staff/inventory', icon: FaBoxes, label: 'Inventory' },
  { to: '/staff/chemical-request', icon: FaFileAlt, label: 'Chemical Request' },
  { to: '/staff/draft', icon: FaEdit, label: 'My Draft' },
];

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 px-5 py-3 text-sm relative transition-colors ${
    isActive
      ? 'bg-[#2d5aa0] text-white font-medium before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-white'
      : 'text-white/75 hover:bg-white/10 hover:text-white'
  }`;

function StaffSidebar({ onLogout }) {
  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-[56px] bottom-0 w-[220px] bg-[#1A3C6E] z-40">
      <nav className="flex-1 overflow-y-auto pt-2 flex flex-col gap-0.5">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} className={linkClass}>
            <item.icon className="text-[18px] shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto pb-2">
        <hr className="border-t border-white/15 mx-4 mb-2" />
        <NavLink to="/staff/settings" className={linkClass}>
          <FaCog className="text-[18px] shrink-0" />
          <span>Settings</span>
        </NavLink>
        <button className="flex items-center gap-3 px-5 py-3 text-sm text-white/75 hover:bg-white/10 hover:text-white w-full bg-transparent border-none cursor-pointer font-inherit text-left transition-colors" onClick={onLogout}>
          <FaSignOutAlt className="text-[18px] shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default StaffSidebar;
