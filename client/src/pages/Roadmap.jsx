import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import selectJobRoleImage from '../images/select-job-image.jpg';
import { Navigationinner } from '../components/navigationinner';
import ChatbotButton from '../components/ChatbotButton';

import frontendImage from '../images/roadmaps/frontend_page-0001.jpg';
import backendImage from '../images/roadmaps/backend_page-0001.jpg';
import devopsImage from '../images/roadmaps/devops_page-0001.jpg';
import fullstackImage from '../images/roadmaps/full-stack_page-0001.jpg';
import aiEngineeringImage from '../images/roadmaps/ai-engineer_page-0001.jpg';
import aiDatascientistImage from '../images/roadmaps/ai-data-scientist_page-0001.jpg';
import androidImage from '../images/roadmaps/android_page-0001.jpg';
import cybersecurityImage from '../images/roadmaps/cyber-security_page-0001.jpg';
import dataanalystImage from '../images/roadmaps/data-analyst_page-0001.jpg';
import gamedevImage from '../images/roadmaps/game-developer_page-0001.jpg';
import iosImage from '../images/roadmaps/ios_page-0001.jpg';
import uxdesignImage from '../images/roadmaps/ux-design_page-0001.jpg';

const roadmapItems = [
  { name: 'FRONTEND', imageUrl: frontendImage },
  { name: 'BACKEND', imageUrl: backendImage },
  { name: 'DEVOPS', imageUrl: devopsImage },
  { name: 'FULL STACK', imageUrl: fullstackImage },
  { name: 'AI ENGINEERING', imageUrl: aiEngineeringImage },
  { name: 'AI DATA SCIENTIST', imageUrl: aiDatascientistImage },
  { name: 'ANDROID', imageUrl: androidImage },
  { name: 'CYBER SECURITY', imageUrl: cybersecurityImage },
  { name: 'DATA ANALYST', imageUrl: dataanalystImage },
  { name: 'GAME DEVELOPER', imageUrl: gamedevImage },
  { name: 'IOS', imageUrl: iosImage },
  { name: 'UX DESIGN', imageUrl: uxdesignImage },
];

const Roadmap = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const handleSelectItem = (itemName) => {
    const selectedRoadmap = roadmapItems.find((item) => item.name === itemName);
    setSelectedItem(itemName);
    setSelectedImage(selectedRoadmap?.imageUrl || null);
  };

  return (
    <>
      <Navigationinner title={"ROADMAP"} />
      <div className="flex min-h-screen bg-gray-50">
        {/* Main Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {selectedItem && selectedImage ? (
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{selectedItem}</h2>
              <img
                src={selectedImage}
                alt={selectedItem}
                className="w-full h-auto rounded-lg shadow-lg"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="max-w-md bg-white p-8 rounded-lg shadow-md">
                <img
                  src={selectJobRoleImage}
                  alt="Select Job Role"
                  className="w-full h-48 object-cover rounded-md mb-4"
                />
                <p className="text-lg text-gray-600">
                  Please select a job role to view the roadmap
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-64 bg-white border-l border-gray-200 p-4 overflow-y-auto">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Select Job Role</h3>
          <button
            className="w-full mb-3 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
            onClick={toggleExpand}
          >
            {isExpanded ? 'Show Less' : 'Show More'}
          </button>
          <div className="space-y-2">
            {(isExpanded ? roadmapItems : roadmapItems.slice(0, 5)).map((item, index) => (
              <button
                key={index}
                className={`w-full px-3 py-2 text-left text-sm font-medium rounded-md transition-colors ${selectedItem === item.name
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                onClick={() => handleSelectItem(item.name)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        <ChatbotButton />
      </div>
    </>
  );
};

export default Roadmap;
