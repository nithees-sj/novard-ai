import React, { useState } from "react";
import logo from "../images/mainlogo.png";
import ThemeToggle from "./ThemeToggle";

// Sections of the landing page (pages/Landing.jsx).
const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#about", label: "Why Novard-AI" },
  { href: "#contact", label: "Contact" },
];

const linkClass = "text-gray-700 hover:text-blue-600 font-medium transition-colors rounded-lg hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40";

/** The landing page's top bar. */
export const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-md shadow-sm dark:border-b dark:border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <a href="/" className="flex items-center space-x-3 group">
            <img
              src={logo}
              alt="Logo"
              className="w-12 h-12 rounded-lg transition-transform group-hover:scale-105 dark:invert"
            />
            <span className="text-2xl font-bold text-gray-900 font-display tracking-tight">
              Novard-AI
            </span>
          </a>

          <div className="flex items-center gap-2">
            {/* Desktop Navigation */}
            <ul className="hidden md:flex items-center space-x-1">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className={`px-4 py-2 ${linkClass}`}>{link.label}</a>
                </li>
              ))}
            </ul>

            <ThemeToggle className="ml-1" />

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
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
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 animate-slide-down">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`block px-4 py-3 ${linkClass}`}
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
};
