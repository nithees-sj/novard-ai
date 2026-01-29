import React from "react";
import { signInWithGoogle } from "../Firebase";
import { useNavigate } from "react-router-dom";

function LoginButton() {
  const navigate = useNavigate();

  const handleSignIn = async () => {
    try {
      const user = await signInWithGoogle();
      if (user) {
        navigate("/home");
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Failed to log in. Please try again.");
    }
  };

  return (
    <button
      onClick={handleSignIn}
      className="px-8 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-full 
                 hover:from-primary-700 hover:to-primary-800 transform hover:scale-105 hover:shadow-lg
                 transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
    >
      Continue with Google
    </button>
  );
}

export default LoginButton;
