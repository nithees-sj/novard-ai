import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

import { Navigation } from "../components/navigation";
import { Header } from "../components/header";
import { Features } from "../components/features";
import { About } from "../components/about";
import { Services } from "../components/services";
import { Team } from "../components/Team";
import JsonData from "../data/data.json";
import { Contact } from "../components/contact";

const Landing = () => {
  const [landingPageData, setLandingPageData] = useState({});
  const { isAuthenticated } = useAuth0();
  const navigate = useNavigate();

  //  Dynamic gradient background state
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

  useEffect(() => {
    setLandingPageData(JsonData);
    if (isAuthenticated) {
      navigate("/home");
    }
  }, [isAuthenticated, navigate]);

  // Track mouse position for dynamic gradient effect
  useEffect(() => {
    const handleMouseMove = (e) => {
      // Convert mouse position to percentage for smoother gradient transition
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      setMousePosition({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, 
          rgba(14, 165, 233, 0.15) 0%, 
          rgba(217, 70, 239, 0.1) 25%, 
          rgba(255, 255, 255, 1) 50%)`,
        transition: 'background 0.3s ease-out',
      }}
    >
      {/* Animated background blobs */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: `${mousePosition.y * 0.5}%`,
          left: `${mousePosition.x * 0.5}%`,
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(14, 165, 233, 0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: `${100 - (mousePosition.y * 0.3)}%`,
          right: `${100 - (mousePosition.x * 0.3)}%`,
          transform: 'translate(50%, 50%)',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(217, 70, 239, 0.06) 0%, transparent 70%)',
          filter: 'blur(60px)',
          transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      {/* Main content */}
      <div className="relative z-10">
        <Navigation />
        <Header data={landingPageData.Header} />
        <Features data={landingPageData.Features} />
        <About data={landingPageData.About} />
        <Services data={landingPageData.Services} />
        <Team data={landingPageData.Team} />
        <Contact data={landingPageData.Contact} />
      </div>
    </div>
  );
};

export default Landing;
