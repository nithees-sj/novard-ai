import React from "react";
import { useAuth } from "../AuthContext";

function LoginButton() {
  const { signIn } = useAuth();

  const handleSignIn = async () => {
    try {
      signIn();
    } catch (error) {
      console.error("Login error:", error);
      alert("Failed to sign in. Please try again.");
    }
  };

  return (
    <button
      onClick={handleSignIn}
      className="px-8 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-full 
                 hover:from-primary-700 hover:to-primary-800 transform hover:scale-105 hover:shadow-lg
                 transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
    >
      Get Started
    </button>
  );
}

export default LoginButton;
