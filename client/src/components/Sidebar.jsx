import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../Firebase';
import mainlogo from '../images/mainlogo.png';

const Sidebar = ({ isHoverMode = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  // Sidebar visibility state - starts hidden if in hover mode
  const [showSidebar, setShowSidebar] = useState(!isHoverMode);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        const userWithPhoto = {
          ...currentUser,
          photoURL: currentUser.photoURL || localStorage.getItem('profilePic') || null,
          displayName: currentUser.displayName || localStorage.getItem('name') || 'User'
        };
        setUser(userWithPhoto);
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Update sidebar visibility when isHoverMode prop changes
  useEffect(() => {
    setShowSidebar(!isHoverMode);
  }, [isHoverMode]);

  // Hover detection for left edge
  useEffect(() => {
    if (!isHoverMode) {
      setShowSidebar(true);
      return;
    }

    const handleMouseMove = (e) => {
      // Show sidebar when mouse is within 20px of left edge
      if (e.clientX < 20) {
        setShowSidebar(true);
      }
      // Hide sidebar when mouse moves beyond sidebar width + 20px buffer
      else if (e.clientX > 284 && showSidebar) {
        setShowSidebar(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isHoverMode, showSidebar]);

  const menuItems = [
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

  const isActive = (route) => {
    return location.pathname === route;
  };

  return (
    <div
      className={`fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-30 transition-transform duration-300 ease-out ${showSidebar ? 'translate-x-0' : '-translate-x-full'
        }`}
    >
      {/* Logo Section */}
      <div className="p-6 border-r border-gray-200 h-14 flex items-center">
        <div className="flex items-center space-x-2">
          <img src={mainlogo} alt="NOVARD-AI" className="h-8 w-8 rounded-lg" />
          <span className="text-xl font-bold text-gray-900">NOVARD-AI</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item, index) => (
          <button
            key={index}
            onClick={() => navigate(item.route)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
              isActive(item.route)
                ? 'bg-blue-50 text-blue-600 font-medium border-r-4 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span className={isActive(item.route) ? 'text-blue-600' : 'text-gray-500'}>
              {item.icon}
            </span>
            <span className="text-sm">{item.name}</span>
          </button>
        ))}
      </nav>

      {/* User Info Footer */}
      {user && (
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
               onClick={() => navigate('/profile')}>
            <img
              src={user.photoURL || '/img/team/user.jpeg'}
              alt="Profile"
              className="w-10 h-10 rounded-full border-2 border-gray-300"
              onError={(e) => {
                e.target.src = '/img/team/user.jpeg';
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.displayName}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;

