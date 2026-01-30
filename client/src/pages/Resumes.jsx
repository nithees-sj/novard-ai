import React, { useState, useEffect } from "react";
import axios from "axios";
import { Navigationinner } from "../components/navigationinner";
import selectCareerImage from "../images/select-job-image.jpg";
import { MdDeleteOutline } from "react-icons/md";
import { marked } from 'marked';
import ChatbotButton from '../components/ChatbotButton';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

const ResumePage = () => {
  const [selectedCareerId, setSelectedCareerId] = useState(null);
  const [newCareer, setNewCareer] = useState("");
  const [skillsData, setSkillsData] = useState(null);
  const [roadmapCareers, setRoadmapCareers] = useState([]);

  useEffect(() => {
    fetchCareers();
  }, []);

  const fetchCareers = () => {
    axios
      .get(`${apiUrl}/api/resumes/career/careerIds`)
      .then((response) => {
        if (Array.isArray(response.data)) {
          const transformedCareers = response.data.map((career) => ({ name: career }));
          setRoadmapCareers(transformedCareers);
        }
      })
      .catch((error) => console.error("Error fetching career IDs:", error));
  };

  const handleSelectCareer = (careerId) => {
    setSelectedCareerId(careerId);
    axios
      .get(`${apiUrl}/api/resumes/${careerId}`)
      .then((response) => {
        if (response.data && typeof response.data === "object") {
          setSkillsData(response.data);
        }
      })
      .catch((error) => console.error("Error fetching resume data:", error));
  };

  const handleAddNewCareer = () => {
    if (newCareer.trim() !== "") {
      axios
        .post(`${apiUrl}/api/resumes/process`, { career: newCareer.trim(), count: 1 })
        .then(() => {
          setNewCareer("");
          fetchCareers();
        })
        .catch((error) => console.error("Error adding new career:", error));
    }
  };

  const handleDeleteCareer = (careerId) => {
    axios
      .delete(`${apiUrl}/api/resumes/delete/${careerId}`)
      .then(() => fetchCareers())
      .catch((error) => console.error("Error deleting career:", error));
  };

  return (
    <>
      <Navigationinner title={"RESUME"} hideLogo={true} hasSidebar={false} />
      <div className="flex min-h-screen bg-gray-50 pt-14">
        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6">
          {selectedCareerId && skillsData ? (
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Resume Template for {selectedCareerId}</h2>
              <div className="space-y-3">
                {Object.keys(skillsData).map((key) => (
                  <div key={key} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div
                      className="text-sm text-gray-800 leading-relaxed prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: typeof skillsData[key] === "string" ? marked(skillsData[key]) : skillsData[key] }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="max-w-md bg-white p-8 rounded-lg shadow-md">
                  <img src={selectCareerImage} alt="Select a career" className="w-full h-48 object-cover rounded-md mb-4" />
                  <p className="text-lg text-gray-600">Select a role to view resume template</p>
                </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-64 bg-white border-l border-gray-200 p-4 overflow-y-auto">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Roles</h3>

          <div className="space-y-2 mb-6">
            {roadmapCareers.map((career, index) => (
              <button
                key={index}
                className={`w-full px-3 py-2 text-left text-sm font-medium rounded-md transition-colors flex justify-between items-center ${selectedCareerId === career.name ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                onClick={() => handleSelectCareer(career.name)}
              >
                <span className="truncate">{career.name}</span>
                <MdDeleteOutline
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCareer(career.name);
                  }}
                  className="cursor-pointer flex-shrink-0"
                />
              </button>
            ))}
          </div>

          {/* Add New Role */}
          <div className="space-y-2">
            <input
              type="text"
              value={newCareer}
              onChange={(e) => setNewCareer(e.target.value)}
              placeholder="Role for template"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <button
              onClick={handleAddNewCareer}
              className="w-full px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
            >
              Add Role
            </button>
          </div>
        </div>

        <ChatbotButton />
      </div>
    </>
  );
};

export default ResumePage;
