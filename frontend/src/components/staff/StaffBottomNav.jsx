import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaBoxes, FaFileAlt, FaEdit } from 'react-icons/fa';

const tabs = [
  { to: '/staff/inventory', icon: FaBoxes, label: 'Inventory' },
  { to: '/staff/chemical-request', icon: FaFileAlt, label: 'Requests' },
  { to: '/staff/draft', icon: FaEdit, label: 'Draft' },
];

function StaffBottomNav({ hasNotification = false }) {
  return (
    <nav className="flex lg:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-white border-t border-gray-200 z-50">
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 relative ${
              isActive
                ? 'text-[#1A3C6E] font-medium after:absolute after:top-0 after:left-[20%] after:right-[20%] after:h-[2.5px] after:bg-[#1A3C6E] after:rounded-b-sm'
                : 'text-gray-400'
            }`
          }
        >
          <div className="relative">
            <tab.icon className="text-[22px]" />
            {hasNotification && tab.to === '/staff/chemical-request' && (
              <span className="absolute top-0.5 -right-2 w-[7px] h-[7px] rounded-full bg-red-500 border-2 border-white" />
            )}
          </div>
          <span className="text-[10px]">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default StaffBottomNav;
