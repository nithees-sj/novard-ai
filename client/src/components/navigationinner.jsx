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
      padding: "8px 20px",
      background: "rgba(255,255,255,0.95)",
      backdropFilter: "blur(10px)",
      borderBottom: "1px solid rgba(229,231,235,0.8)",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      position: "sticky",
      top: 0,
      zIndex: 1000,
      minHeight: "60px",
    },
    logoContainer: {
      display: "flex",
      alignItems: "center",
    },
    logo: {
      height: "28px",
      marginRight: "10px",
      borderRadius: "6px",
    },
    logoText: {
      fontSize: "20px",
      fontWeight: "700",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      letterSpacing: "0.3px"
    },
    title: {
      fontSize: "18px",
      fontWeight: "600",
      margin: 0,
      color: "#4a5568",
    },
    userInfo: {
      fontSize: "14px",
      display: "flex",
      fontWeight: "500",
      alignItems: "center",
      cursor: "pointer",
      padding: "6px 12px",
      borderRadius: "20px",
      background: "rgba(102, 126, 234, 0.08)",
      border: "1px solid rgba(102, 126, 234, 0.15)",
      transition: "all 0.3s ease",
    },
    userInfoHover: {
      background: "rgba(102, 126, 234, 0.2)",
      transform: "translateY(-2px)",
      boxShadow: "0 4px 15px rgba(102, 126, 234, 0.3)",
    },
    profilePicture: {
      height: "30px",
      width: "30px",
      borderRadius: "50%",
      marginLeft: "8px",
      border: "2px solid rgba(102, 126, 234, 0.3)",
      transition: "all 0.3s ease",
    },
    popup: {
      position: "absolute",
      top: "65px",
      right: "20px",
      width: "280px",
      padding: "25px",
      background: "rgba(255, 255, 255, 0.95)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      borderRadius: "20px",
      boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)",
      textAlign: "center",
      zIndex: 1000,
      animation: "slideDown 0.3s ease-out",
    },
    closeButton: {
      position: "absolute",
      top: "10px",
      right: "15px",
      fontSize: "20px",
      background: "rgba(102, 126, 234, 0.1)",
      border: "none",
      borderRadius: "50%",
      width: "30px",
      height: "30px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.3s ease",
      color: "#667eea",
    },
    popupImage: {
      width: "80px",
      height: "80px",
      borderRadius: "50%",
      marginBottom: "15px",
      border: "3px solid rgba(102, 126, 234, 0.3)",
    },
    logoutButton: {
      marginTop: "15px",
      padding: "10px 20px",
      border: "none",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "#fff",
      borderRadius: "25px",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "600",
      transition: "all 0.3s ease",
      boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
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
