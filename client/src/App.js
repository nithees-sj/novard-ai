import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";

import Landing from "./pages/Landing";
import HomePage from "./pages/HomePage";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Roadmap from "./pages/Roadmap";
import Skills from "./pages/Skills";
import ProjectsPage from "./pages/Projects";
import ResumePage from "./pages/Resumes";
import Chatbot from "./pages/Chatbot";
import Career from "./pages/Career";
import Doubts from "./pages/Doubts";
import Forum from "./pages/Forum";
import Video from "./pages/Video";
import YouTubeVideos from "./pages/YouTubeVideos";
import Notes from "./pages/Notes";
import YouTubeVideoSummarizer from "./pages/YouTubeVideoSummarizer";
import DoubtClearance from "./pages/DoubtClearance";
import TeacherLogin from "./pages/TeacherLogin";
import TeacherDashboard from "./pages/TeacherDashboard";
import CourseVideos from "./pages/CourseVideos";
import TeacherGuidance from "./pages/TeacherGuidance";
import SkillUnlocker from "./pages/SkillUnlocker";

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; 
  }

  return (
    <Routes>
      {/* Public route */}
      <Route path="/" element={user ? <Navigate to="/home" replace /> : <Landing />} />

      {/* Protected routes */}
      <Route
        path="/home"
        element={
          user ? <HomePage /> : <Navigate to="/" replace />
        }
      />
      <Route
        path="/profile"
        element={
            user ? <Profile /> : <Navigate to="/" replace />
          }
        />
        <Route
          path="/settings"
          element={
            user ? <Settings /> : <Navigate to="/" replace />
        }
      />
      <Route
        path="/roadmap"
        element={
          user ? <Roadmap /> : <Navigate to="/" replace />
        }
      />
      <Route
        path="/skills-required"
        element={
          user ? <Skills /> : <Navigate to="/" replace />
        }
      />
      <Route
        path="/project-ideas"
        element={
          user ? <ProjectsPage /> : <Navigate to="/" replace />
        }
      />
      <Route
        path="/resume-build"
        element={
          user ? <ResumePage /> : <Navigate to="/" replace />
        }
      />
      <Route
        path="/chatbot"
        element={
          user ? <Chatbot /> : <Navigate to="/" replace />
        }
      />
      <Route
        path="/career"
        element={
          user ? <Career /> : <Navigate to="/" replace />
        }
      />
      <Route
          path="/skill-unlocker"
          element={
            user ? <SkillUnlocker /> : <Navigate to="/" replace />
          }
        />
        <Route
        path="/doubts"
        element={
          user ? <Doubts /> : <Navigate to="/" replace />
        }
      />
      <Route
        path="/forum"
        element={
          user ? <Forum /> : <Navigate to="/" replace />
        }
      />
      <Route
        path="/video"
        element={
          user ? <Video /> : <Navigate to="/" replace />
        }
      />
      <Route
        path="/notes"
        element={
          user ? <Notes /> : <Navigate to="/" replace />
        }
      />
      <Route
        path="/youtube-videos"
        element={
          user ? <YouTubeVideos /> : <Navigate to="/" replace />
        }
      />
      <Route
        path="/youtube-video-summarizer"
        element={
          user ? <YouTubeVideoSummarizer /> : <Navigate to="/" replace />
        }
      />
      <Route
        path="/doubt-clearance"
        element={
          user ? <DoubtClearance /> : <Navigate to="/" replace />
        }
      />
      <Route
        path="/teacher-login"
        element={<TeacherLogin />}
      />
      <Route
        path="/teacher-dashboard"
        element={<TeacherDashboard />}
      />
      <Route
        path="/course-videos/:courseId"
        element={<CourseVideos />}
      />
      <Route
        path="/teacher-guidance"
        element={
          user ? <TeacherGuidance /> : <Navigate to="/" replace />
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
