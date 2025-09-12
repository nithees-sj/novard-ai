import React, { useState, useEffect } from "react";
import { signOut, onAuthStateChanged } from "firebase/auth";
import axios from "axios";
import { auth } from "../Firebase"; // Import Firebase auth instance
import mainlogo from "../images/mainlogo.png";
const apiUrl = process.env.REACT_APP_API_ENDPOINT;


export const Navigationinner = ({ title }) => {
  const [user, setUser] = useState(null); // Firebase user state
  const [userData, setUserData] = useState({});
  const [showPopup, setShowPopup] = useState(false);

const styles = {
  navbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 24px",
    background: "rgba(255,255,255,0.98)",
    backdropFilter: "blur(14px)",
    borderBottom: "1px solid rgba(0,0,0,0.09)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
    position: "sticky",
    top: 0,
    zIndex: 1000,
    minHeight: "56px"
  },
  logoContainer: {
    display: "flex",
    alignItems: "center"
  },
  logo: {
    height: "32px",
    marginRight: "12px",
    borderRadius: "6px"
  },
  logoText: {
    fontSize: "24px",
    fontWeight: "800",
    color: "#111827",
    letterSpacing: "0.5px"
  },
  title: {
    fontSize: "20px",
    fontWeight: "600",
    margin: 0,
    color: "#374151"
  },
  userInfo: {
    fontSize: "16px",
    display: "flex",
    fontWeight: "600",
    alignItems: "center",
    cursor: "pointer",
    padding: "8px 18px",
    borderRadius: "20px",
    background: "rgba(18, 18, 18, 0.04)",
    border: "1px solid rgba(0,0,0,0.08)",
    color: "#111827",
    transition: "all 0.3s ease"
  },
  userInfoHover: {
    background: "rgba(0,0,0,0.08)",
    transform: "translateY(-2px)",
    boxShadow: "0 6px 16px rgba(0,0,0,0.13)"
  },
  profilePicture: {
    height: "32px",
    width: "32px",
    borderRadius: "50%",
    marginLeft: "10px",
    border: "2px solid rgba(0,0,0,0.10)",
    transition: "all 0.3s ease"
  },
  popup: {
    position: "absolute",
    top: "64px",
    right: "24px",
    width: "320px",
    padding: "35px",
    background: "rgba(255,255,255,0.97)",
    backdropFilter: "blur(18px)",
    border: "1px solid rgba(0,0,0,0.11)",
    borderRadius: "22px",
    boxShadow: "0 20px 48px rgba(0,0,0,0.15)",
    textAlign: "center",
    zIndex: 1000,
    animation: "slideDown 0.3s ease-out"
  },
  closeButton: {
    position: "absolute",
    top: "12px",
    right: "18px",
    fontSize: "24px",
    background: "rgba(0, 0, 0, 0.07)",
    border: "none",
    borderRadius: "50%",
    width: "32px",
    height: "32px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.3s ease",
    color: "#111827"
  },
  popupImage: {
    width: "90px",
    height: "90px",
    borderRadius: "50%",
    marginBottom: "18px",
    border: "3px solid rgba(0,0,0,0.12)"
  },
  logoutButton: {
    marginTop: "20px",
    padding: "13px 32px",
    border: "none",
    background: "#111827",
    color: "#fff",
    borderRadius: "28px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "700",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 16px rgba(0,0,0,0.17)",
    textTransform: "uppercase",
    letterSpacing: "1px"
  }
};

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // Create user object with proper photoURL from localStorage or Firebase user
        const userWithPhoto = {
          ...currentUser,
          photoURL: currentUser.photoURL || localStorage.getItem("profilePic") || null,
          displayName: currentUser.displayName || localStorage.getItem("name") || "User"
        };
        setUser(userWithPhoto);

        // Fetch additional user data if required
        const fetchUserData = async () => {
          try {
            const response = await axios.get(
              `${apiUrl}/getUser/${currentUser.email}`
            );
            setUserData(response.data);
          } catch (error) {
            console.error("Error fetching user data:", error);
          }
        };

        fetchUserData();
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth); // Firebase sign-out
      // Clear localStorage
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
    <nav style={styles.navbar}>
      <div style={styles.logoContainer}>
        <img src={mainlogo} alt="CareerDev Logo" style={styles.logo} />
        <span style={styles.logoText}>NOVARD-AI</span>
      </div>

      <div style={styles.title}>{title}</div>

      <div 
        style={styles.userInfo} 
        onClick={togglePopup}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(102, 126, 234, 0.2)";
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.3)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(102, 126, 234, 0.1)";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {user && (
          <>
            <span style={{ color: "#4a5568" }}>{user.displayName}</span>
            <img
              src={user.photoURL || "/img/team/user.jpeg"}
              alt="Profile"
              style={styles.profilePicture}
              onError={(e) => {
                e.target.src = "/img/team/user.jpeg";
              }}
            />
          </>
        )}
      </div>

      {showPopup && user && (
        <div style={styles.popup}>
          <button 
            style={styles.closeButton} 
            onClick={togglePopup}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(102, 126, 234, 0.2)";
              e.currentTarget.style.transform = "scale(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(102, 126, 234, 0.1)";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            &times;
          </button>
          <img
            src={user.photoURL || "/img/team/user.jpeg"}
            alt="Profile"
            style={styles.popupImage}
            onError={(e) => {
              e.target.src = "/img/team/user.jpeg";
            }}
          />
          <h4 style={{ 
            margin: "0 0 5px 0", 
            color: "#2d3748", 
            fontSize: "18px",
            fontWeight: "600" 
          }}>
            {user.displayName}
          </h4>
          <p style={{ 
            margin: "0 0 15px 0", 
            color: "#718096", 
            fontSize: "14px" 
          }}>
            {user.email}
          </p>
          <button 
            style={styles.logoutButton} 
            onClick={handleLogout}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.6)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.4)";
            }}
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
};
