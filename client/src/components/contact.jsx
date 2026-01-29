import React from "react";
import { FaLinkedin, FaGithub } from "react-icons/fa";
import companyLogo from "../images/mainlogo.png";

export const Contact = () => {
  return (
    <footer
      id="contact"
      className="bg-white border-t border-gray-200 py-6"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo and Name */}
          <div className="flex items-center space-x-3">
            <img
              src={companyLogo}
              alt="Company Logo"
              className="w-10 h-10 rounded-lg"
            />
            <span className="text-xl font-bold text-gray-900 font-display">
              NOVARD-AI
            </span>
          </div>

          {/* Social Links */}
          <div className="flex items-center space-x-4">
            <a
              href="https://www.linkedin.com/in/nithees-s-j-524262366/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-gray-600 hover:text-[#0077b5] hover:bg-gray-100 
                       transition-all duration-300 transform hover:scale-110"
              aria-label="LinkedIn"
            >
              <FaLinkedin size={24} />
            </a>
            <a
              href="https://github.com/nithees-sj/novard-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 
                       transition-all duration-300 transform hover:scale-110"
              aria-label="GitHub"
            >
              <FaGithub size={24} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
