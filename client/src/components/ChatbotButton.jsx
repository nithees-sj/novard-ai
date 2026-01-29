import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SiChatbot } from "react-icons/si";

const ChatbotButton = () => {
  const navigate = useNavigate();

  const handleChatbotNavigate = () => {
    navigate('/chatbot');
  };

  return (
    <button
      onClick={handleChatbotNavigate}
      className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-br from-primary-600 to-primary-700 
               text-white rounded-full shadow-lg hover:shadow-xl 
               flex items-center justify-center
               transform hover:scale-110 transition-all duration-300
               animate-pulse-slow z-50"
      aria-label="Open Chatbot"
    >
      <SiChatbot size={28} />
    </button>
  );
};

export default ChatbotButton;
