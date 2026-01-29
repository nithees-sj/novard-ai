import React, { useState } from "react";
import logo from "../images/mainlogo.png";

export const Navigation = (props) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <a href="/" className="flex items-center space-x-3 group">
            <img
              src={logo}
              alt="Logo"
              className="w-12 h-12 rounded-lg transition-transform group-hover:scale-105"
            />
            <span className="text-2xl font-bold text-gray-900 font-display tracking-tight">
              Novard-AI
            </span>
          </a>

          {/* Desktop Navigation */}
          <ul className="hidden md:flex items-center space-x-1">
            <li>
              <a
                href="#features"
                className="px-4 py-2 text-gray-700 hover:text-primary-600 font-medium transition-colors rounded-lg hover:bg-gray-50"
              >
                Features
              </a>
            </li>
            <li>
              <a
                href="#about"
                className="px-4 py-2 text-gray-700 hover:text-primary-600 font-medium transition-colors rounded-lg hover:bg-gray-50"
              >
                About
              </a>
            </li>
            <li>
              <a
                href="#services"
                className="px-4 py-2 text-gray-700 hover:text-primary-600 font-medium transition-colors rounded-lg hover:bg-gray-50"
              >
                Services
              </a>
            </li>
            <li>
              <a
                href="#team"
                className="px-4 py-2 text-gray-700 hover:text-primary-600 font-medium transition-colors rounded-lg hover:bg-gray-50"
              >
                Team
              </a>
            </li>
            <li>
              <a
                href="#contact"
                className="px-4 py-2 text-gray-700 hover:text-primary-600 font-medium transition-colors rounded-lg hover:bg-gray-50"
              >
                Contact
              </a>
            </li>
          </ul>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 animate-slide-down">
            <a
              href="#features"
              className="block px-4 py-3 text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded-lg transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Features
            </a>
            <a
              href="#about"
              className="block px-4 py-3 text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded-lg transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              About
            </a>
            <a
              href="#services"
              className="block px-4 py-3 text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded-lg transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Services
            </a>
            <a
              href="#team"
              className="block px-4 py-3 text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded-lg transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Team
            </a>
            <a
              href="#contact"
              className="block px-4 py-3 text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded-lg transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Contact
            </a>
          </div>
        )}
      </div>
    </nav>
  );
};
