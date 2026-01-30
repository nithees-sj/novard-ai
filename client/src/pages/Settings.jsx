import React from 'react';
import { Navigationinner } from '../components/navigationinner';
import Sidebar from '../components/Sidebar';

const Settings = () => {
  return (
    <>
      <Navigationinner title="SETTINGS" hideLogo={true} />
      <div className="flex bg-gray-50 min-h-screen pt-14">
        <Sidebar />
        
        {/* Main Content */}
        <div className="ml-64 flex-1 p-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
              <p className="text-gray-600">Manage your account preferences and configurations</p>
            </div>

            {/* Placeholder Content */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
                  <svg 
                    className="w-10 h-10 text-gray-400" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
                    />
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
                    />
                  </svg>
                </div>
                
                <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                  Settings Coming Soon
                </h2>
                <p className="text-gray-600 max-w-md mx-auto">
                  We're working on bringing you powerful settings and customization options. 
                  Stay tuned for updates!
                </p>
              </div>

              {/* Placeholder Settings Sections */}
              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Account Settings</h3>
                  <p className="text-sm text-gray-600">Manage your account preferences and security options</p>
                </div>
                
                <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Notifications</h3>
                  <p className="text-sm text-gray-600">Configure how you receive updates and alerts</p>
                </div>
                
                <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Privacy</h3>
                  <p className="text-sm text-gray-600">Control your privacy and data sharing preferences</p>
                </div>
                
                <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Appearance</h3>
                  <p className="text-sm text-gray-600">Customize the look and feel of your dashboard</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Settings;
