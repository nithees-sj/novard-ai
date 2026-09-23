import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import selectCareerImage from "../images/select-job-image.jpg";
import { MdDeleteOutline } from "react-icons/md";
import MarkdownView from './MarkdownView';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

const ResumesInlineView = () => {
  const [selectedCareerId, setSelectedCareerId] = useState(null);
  const [newCareer, setNewCareer] = useState("");
  const [skillsData, setSkillsData] = useState(null);
  const [roadmapCareers, setRoadmapCareers] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [error, setError] = useState(null);

  // Turns an axios failure into something worth showing the user. Every one of
  // these calls used to fail silently into console.error.
  const describeError = (err, fallback) => {
    if (err.code === 'ECONNABORTED') return 'The request timed out. The model may still be busy - try again.';
    if (err.response?.data?.error) return err.response.data.error;
    if (err.response?.status === 404) return 'Nothing saved for that role yet.';
    if (!err.response) return 'Cannot reach the server. Is the API running?';
    return fallback;
  };

  const fetchCareers = useCallback(async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/resumes/career/careerIds`);
      if (Array.isArray(response.data)) {
        setRoadmapCareers(response.data.map((career) => ({ name: career })));
      }
    } catch (err) {
      console.error('Error fetching career IDs:', err);
      setError(describeError(err, 'Could not load the saved roles.'));
    }
  }, []);

  useEffect(() => {
    fetchCareers();
  }, [fetchCareers]);

  const handleSelectCareer = async (careerId) => {
    setSelectedCareerId(careerId);
    setSkillsData(null);
    setIsLoadingContent(true);
    setError(null);
    try {
      const response = await axios.get(`${apiUrl}/api/resumes/${careerId}`);
      if (response.data && typeof response.data === 'object') {
        setSkillsData(response.data);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(describeError(err, 'Could not load that role.'));
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleAddNewCareer = async () => {
    const career = newCareer.trim();
    if (!career || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    try {
      await axios.post(`${apiUrl}/api/resumes/process`, { career: career, count: 1 });
      setNewCareer('');
      await fetchCareers();
      await handleSelectCareer(career);
    } catch (err) {
      console.error('Error adding new career:', err);
      setError(describeError(err, 'Generation failed. Please try again.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteCareer = async (careerId) => {
    if (!window.confirm(`Delete the saved result for "${careerId}"?`)) return;
    setError(null);
    try {
      await axios.delete(`${apiUrl}/api/resumes/delete/${careerId}`);
      if (selectedCareerId === careerId) {
        setSelectedCareerId(null);
        setSkillsData(null);
      }
      await fetchCareers();
    } catch (err) {
      console.error('Error deleting career:', err);
      setError(describeError(err, 'Could not delete that role.'));
    }
  };

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1">
        {isLoadingContent ? (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-250px)] bg-white rounded-lg border border-gray-200 gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-primary-600 animate-spin" />
            <p className="text-sm text-gray-500">Loading {selectedCareerId}&hellip;</p>
          </div>
        ) : selectedCareerId && skillsData ? (
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Resume Template for {selectedCareerId}</h2>
            <div className="space-y-3 overflow-y-auto h-[calc(100vh-300px)] scroll-smooth scrollbar-hide">
              {Object.keys(skillsData).map((key) => (
                <div key={key} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <MarkdownView content={skillsData[key]} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-250px)] text-center px-4 bg-white rounded-lg border border-gray-200">
            <div className="max-w-md p-8">
              <img src={selectCareerImage} alt="Select a career" className="w-full h-48 object-cover rounded-md mb-4" />
              <p className="text-lg text-gray-600">Select a role to view resume template</p>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="w-64 bg-white rounded-lg border border-gray-200 p-4 h-[calc(100vh-160px)] overflow-y-auto scroll-smooth scrollbar-hide">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Roles</h3>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="text-red-500 hover:text-red-700 leading-none">&times;</button>
          </div>
        )}

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
            disabled={isGenerating || !newCareer.trim()}
            className="w-full px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Generating&hellip;
              </>
            ) : (
              'Add Role'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResumesInlineView;
