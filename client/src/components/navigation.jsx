import React, { useState } from "react";
import logo from "../images/mainlogo.png";
import ThemeToggle from "./ThemeToggle";

// Sections of the landing page (pages/Landing.jsx).
const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#about", label: "How it works" },
  { href: "#contact", label: "Contact" },
];

const linkClass = "rounded-lg text-body text-fg-muted transition-colors hover:bg-sunken hover:text-fg";

/** The landing page's top bar. */
export const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-line-subtle bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 rounded">
            <img
              src={logo}
              alt=""
              className="h-7 w-7 rounded-md dark:invert"
            />
            <span className="font-display text-lead font-bold tracking-tight text-fg">NOVARD-AI</span>
          </a>

          <div className="flex items-center gap-2">
            {/* Desktop Navigation */}
            <ul className="hidden md:flex items-center space-x-1">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className={`px-3 py-1.5 ${linkClass}`}>{link.label}</a>
                </li>
              ))}
            </ul>

            <ThemeToggle className="ml-1" />

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-sunken hover:text-fg md:hidden"
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
          <div className="animate-slide-down border-t border-line-subtle py-2 md:hidden">
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
