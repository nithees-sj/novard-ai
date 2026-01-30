import React, { useState, useEffect } from "react";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../Firebase";
import mainlogo from "../images/mainlogo.png";

export const Navigationinner = ({ title, hideLogo = false, hasSidebar = true }) => {
  const [user, setUser] = useState(null);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        const userWithPhoto = {
          ...currentUser,
          photoURL: currentUser.photoURL || localStorage.getItem("profilePic") || null,
          displayName: currentUser.displayName || localStorage.getItem("name") || "User"
        };
        setUser(userWithPhoto);
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("name");
      localStorage.removeItem("email");
      localStorage.removeItem("profilePic");
      setUser(null);
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  const togglePopup = () => setShowPopup(!showPopup);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 bg-white/98 backdrop-blur-md border-b border-gray-200 shadow-sm ${hasSidebar ? 'ml-64' : ''}`}>
      <div className="flex justify-between items-center px-6 h-14">
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
        <div className="text-xl font-semibold text-gray-700">
          {title}
        </div>

        {/* User Info */}
        <div
          className="flex items-center space-x-3 px-5 py-2 rounded-full bg-gray-100 border border-gray-200 
                   cursor-pointer hover:bg-primary-50 hover:border-primary-300 transition-all duration-300
                   hover:-translate-y-0.5 hover:shadow-md"
          onClick={togglePopup}
        >
          {user && (
            <>
              <span className="text-gray-700 font-semibold">{user.displayName}</span>
              <img
                src={user.photoURL || "/img/team/user.jpeg"}
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
          <div className="absolute top-16 right-6 w-80 p-8 bg-white/97 backdrop-blur-lg border border-gray-200 
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
              src={user.photoURL || "/img/team/user.jpeg"}
              alt="Profile"
              className="w-24 h-24 rounded-full mx-auto mb-4 border-3 border-gray-300"
              onError={(e) => {
                e.target.src = "/img/team/user.jpeg";
              }}
            />

            {/* User Info */}
            <h4 className="text-xl font-semibold text-gray-800 mb-1">
              {user.displayName}
            </h4>
            <p className="text-sm text-gray-600 mb-5">
              {user.email}
            </p>

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
