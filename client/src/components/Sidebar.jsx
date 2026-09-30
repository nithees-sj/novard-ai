import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import mainlogo from '../images/mainlogo.png';
import { useReportProblem } from '../context/ReportContext';

/**
 * The left navigation of every signed-in page.
 *
 * The admin console uses the same sidebar with its own sections:
 *   items       [{ name, icon, route, badge? }] instead of the student menu
 *   footer      replaces the student's profile card
 *   subtitle    a small label under the logo (e.g. "Admin console")
 *   matchPrefix an item is active on its sub-pages too (/admin/risk/...)
 *   drawer      on small screens the sidebar becomes a drawer (opened by
 *               `drawerOpen`, closed with `onDrawerClose`), like the agent chat's
 * Without these props it is exactly the student sidebar.
 */
const Sidebar = ({ isHoverMode = false, items, footer, subtitle, matchPrefix = false, drawer = false, drawerOpen = false, onDrawerClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const openReport = useReportProblem();
  // Sidebar visibility state - starts hidden if in hover mode
  const [showSidebar, setShowSidebar] = useState(!isHoverMode);

  // Update sidebar visibility when isHoverMode prop changes
  useEffect(() => {
    setShowSidebar(!isHoverMode);
  }, [isHoverMode]);

  // Hover detection for left edge. Registered once per mode - reading the
  // current value through the state updater keeps showSidebar out of the deps,
  // which previously tore down and re-attached the listener on every toggle.
  useEffect(() => {
    if (!isHoverMode) {
      setShowSidebar(true);
      return undefined;
    }

    const handleMouseMove = (e) => {
      if (e.clientX < 20) {
        setShowSidebar(true);
      } else if (e.clientX > 284) {
        setShowSidebar((visible) => (visible ? false : visible));
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isHoverMode]);

  const studentItems = [
    {
      name: 'Home',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      route: '/home'
    },
    {
      name: 'Career Development',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      route: '/career'
    },
    {
      name: 'Doubts & Learning',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      route: '/doubts'
    },
    {
      name: 'AI Forum',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      route: '/forum'
    },
    {
      name: 'My Learning',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      route: '/skill-unlocker'
    },
    {
      name: 'Video Sessions',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      route: '/video'
    },
    {
      name: 'Profile',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      route: '/profile'
    },
    {
      name: 'Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      route: '/settings'
    }
  ];

  // Admins signed in to the app see a way into the console.
  const adminItem = {
    name: 'Admin console',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    route: '/admin',
  };
  const menuItems = items || (['admin', 'superadmin'].includes(user?.role) ? [...studentItems, adminItem] : studentItems);

  const isActive = (route) => {
    if (matchPrefix && route !== menuItems[0]?.route) return location.pathname === route || location.pathname.startsWith(`${route}/`);
    return location.pathname === route;
  };

  const go = (route) => {
    navigate(route);
    if (drawer) onDrawerClose?.();
  };

  // As a drawer (small screens only): hidden off-canvas until opened.
  const drawerClasses = drawer ? `${drawerOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0` : '';
  const visibility = drawer ? drawerClasses : (showSidebar ? 'translate-x-0' : '-translate-x-full');

  return (
    <>
    {drawer && drawerOpen && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={onDrawerClose} aria-hidden="true" />}
    <div
      className={`fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-30 transition-transform duration-300 ease-out ${visibility}`}
    >
      {/* Logo Section */}
      <div className="px-4 border-b border-gray-200 h-14 flex items-center shrink-0">
        <div className="flex items-center space-x-2">
          <img src={mainlogo} alt="NOVARD-AI" className="h-8 w-8 rounded-lg" />
          <span className="leading-tight">
            <span className="block text-xl font-bold text-gray-900">NOVARD-AI</span>
            {subtitle && <span className="block text-[11px] font-semibold uppercase tracking-wide text-blue-600">{subtitle}</span>}
          </span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.route}
            type="button"
            aria-current={isActive(item.route) ? 'page' : undefined}
            onClick={() => go(item.route)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
              isActive(item.route)
                ? 'bg-blue-50 text-blue-600 font-medium border-r-4 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span className={isActive(item.route) ? 'text-blue-600' : 'text-gray-500'}>
              {item.icon}
            </span>
            <span className="flex-1 text-sm">{item.name}</span>
            {item.badge ? <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[11px] font-bold text-white tabular-nums">{item.badge}</span> : null}
          </button>
        ))}
      </nav>

      {footer}

      {/* User Info Footer */}
      {!items && user && (
        <div className="px-4 pt-3">
          <button
            type="button"
            onClick={() => openReport({})}
            className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-left text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
            <span>Report a problem</span>
          </button>
        </div>
      )}
      {!items && user && (
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
               onClick={() => navigate('/profile')}>
            <img
              src={user.photoURL || user.picture || '/img/team/user.jpeg'}
              alt="Profile"
              className="w-10 h-10 rounded-full border-2 border-gray-300"
              onError={(e) => {
                e.target.src = '/img/team/user.jpeg';
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.displayName || user.name}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default Sidebar;
