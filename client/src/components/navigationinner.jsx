import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import mainlogo from "../images/mainlogo.png";
import NotificationBell from "./NotificationBell";
import { useReportProblem } from "../context/ReportContext";

const ADMIN_ROLES = ["admin", "superadmin"];

/**
 * The header of every signed-in page: title, the notification bell and the
 * account menu. The admin console reuses it with its own account (`account`,
 * `menuLinks`, `onSignOut`) and no bell.
 */
export const Navigationinner = ({ title, hideLogo = false, hasSidebar = true, sidebarOffset = 'ml-64', showBell = true, account, menuLinks, onSignOut, actions = null }) => {
  const auth = useAuth();
  const user = account || auth.user;
  const navigate = useNavigate();
  const openReport = useReportProblem();
  const [showPopup, setShowPopup] = useState(false);

  const handleLogout = () => {
    setShowPopup(false);
    (onSignOut || auth.signOut)();
  };

  const togglePopup = () => setShowPopup(!showPopup);

  const links = menuLinks || [
    { label: "My reports", onClick: () => navigate("/reports") },
    { label: "Report a problem", onClick: () => openReport({}) },
    ...(ADMIN_ROLES.includes(user?.role) ? [{ label: "Admin console", onClick: () => navigate("/admin") }] : []),
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm ${hasSidebar ? sidebarOffset : ''}`}>
      <div className="relative flex justify-between items-center gap-3 sm:gap-6 px-4 sm:px-6 h-14">
        {/* Logo - conditionally rendered */}
        {!hideLogo && (
          <div className="flex items-center space-x-3">
            <img src={mainlogo} alt="CareerDev Logo" className="h-8 rounded-lg" />
            <span className="text-2xl font-extrabold text-gray-900 font-display tracking-tight">
              NOVARD-AI
            </span>
          </div>
        )}

        {/* Title */}
        <div className="flex-1 text-xl font-semibold text-gray-700 truncate">
          {title}
        </div>

        {actions}
        {showBell && user && <NotificationBell />}

        {/* User Info */}
        <div
          className="flex items-center space-x-3 px-5 py-2 rounded-full bg-gray-100 border border-gray-200 
                   cursor-pointer hover:bg-primary-50 hover:border-primary-300 transition-all duration-300
                   hover:-translate-y-0.5 hover:shadow-md"
          onClick={togglePopup}
        >
          {user && (
            <>
              <span className="text-gray-700 font-semibold">{user.displayName || user.name}</span>
              <img
                src={user.photoURL || user.picture || "/img/team/user.jpeg"}
                alt="Profile"
                className="w-8 h-8 rounded-full border-2 border-gray-300"
                onError={(e) => {
                  e.target.src = "/img/team/user.jpeg";
                }}
              />
            </>
          )}
        </div>

        {/* Popup */}
        {showPopup && user && (
          <div className="absolute top-16 right-6 w-80 p-8 bg-white border border-gray-200 
                       rounded-3xl shadow-hard z-[60] animate-slide-down text-center">
            {/* Close Button */}
            <button
              className="absolute top-3 right-5 w-8 h-8 flex items-center justify-center rounded-full 
                       bg-gray-100 text-gray-900 hover:bg-primary-100 hover:scale-110 transition-all duration-300"
              onClick={togglePopup}
            >
              &times;
            </button>

            {/* Profile Picture */}
            <img
              src={user.photoURL || user.picture || "/img/team/user.jpeg"}
              alt="Profile"
              className="w-24 h-24 rounded-full mx-auto mb-4 border-2 border-gray-300"
              onError={(e) => {
                e.target.src = "/img/team/user.jpeg";
              }}
            />

            {/* User Info */}
            <h4 className="text-xl font-semibold text-gray-800 mb-1">
              {user.displayName || user.name}
            </h4>
            <p className="text-sm text-gray-600 mb-5">
              {user.email}
            </p>

            {/* Account links */}
            <div className="mb-4 space-y-1.5">
              {links.map((link) => (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => { setShowPopup(false); link.onClick(); }}
                  className="w-full rounded-full border border-gray-200 bg-white px-6 py-2 text-sm font-semibold text-gray-700 transition-all duration-300 hover:border-primary-300 hover:bg-primary-50"
                >
                  {link.label}
                </button>
              ))}
            </div>

            {/* Logout Button */}
            <button
              className="w-full py-3 px-8 bg-gray-900 text-white font-bold rounded-full 
                       hover:bg-gray-800 hover:-translate-y-0.5 hover:shadow-lg 
                       transition-all duration-300 uppercase tracking-wider text-sm"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
