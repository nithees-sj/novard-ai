import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import LoginButton from './LoginButton';

export const Header = (props) => {
  const { isAuthenticated } = useAuth0();

  return (
    <header id="header" className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <div className="animate-fade-in">
          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold text-gray-900 mb-6 leading-tight">
            {props.data ? props.data.title : "Loading"}
          </h2>
          <p className="text-xl sm:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto font-body leading-relaxed">
            {props.data ? props.data.paragraph : "Loading"}
          </p>
          {!isAuthenticated && (
            <div className="animate-slide-up">
              <LoginButton />
            </div>
          )}
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow"></div>
      <div className="absolute bottom-20 right-10 w-72 h-72 bg-accent-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow animation-delay-2000"></div>
    </header>
  );
};
