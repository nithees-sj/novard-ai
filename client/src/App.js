import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import RouteFallback from "./components/RouteFallback";

// Routes are code-split: the entry bundle previously contained every page,
// so the landing screen paid the download cost of the whole application.
const Landing = lazy(() => import("./pages/Landing"));
const HomePage = lazy(() => import("./pages/HomePage"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Roadmap = lazy(() => import("./pages/Roadmap"));
const Skills = lazy(() => import("./pages/Skills"));
const Chatbot = lazy(() => import("./pages/Chatbot"));
const Career = lazy(() => import("./pages/Career"));
const Doubts = lazy(() => import("./pages/Doubts"));
const Forum = lazy(() => import("./pages/Forum"));
const Video = lazy(() => import("./pages/Video"));
const YouTubeVideos = lazy(() => import("./pages/YouTubeVideos"));
const Notes = lazy(() => import("./pages/Notes"));
const YouTubeVideoSummarizer = lazy(() => import("./pages/YouTubeVideoSummarizer"));
const DoubtClearance = lazy(() => import("./pages/DoubtClearance"));
const TeacherLogin = lazy(() => import("./pages/TeacherLogin"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const CourseVideos = lazy(() => import("./pages/CourseVideos"));
const TeacherGuidance = lazy(() => import("./pages/TeacherGuidance"));
const SkillUnlocker = lazy(() => import("./pages/SkillUnlocker"));

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <RouteFallback />;
  }

  // Wraps a page that requires an authenticated user.
  const protectedRoute = (element) => (user ? element : <Navigate to="/" replace />);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public route */}
        <Route path="/" element={user ? <Navigate to="/home" replace /> : <Landing />} />

        {/* Protected routes */}
        <Route path="/home" element={protectedRoute(<HomePage />)} />
        <Route path="/profile" element={protectedRoute(<Profile />)} />
        <Route path="/settings" element={protectedRoute(<Settings />)} />
        <Route path="/roadmap" element={protectedRoute(<Roadmap />)} />
        <Route path="/skills-required" element={protectedRoute(<Skills />)} />
        <Route path="/chatbot" element={protectedRoute(<Chatbot />)} />
        <Route path="/career" element={protectedRoute(<Career />)} />
        <Route path="/skill-unlocker" element={protectedRoute(<SkillUnlocker />)} />
        <Route path="/doubts" element={protectedRoute(<Doubts />)} />
        <Route path="/forum" element={protectedRoute(<Forum />)} />
        <Route path="/video" element={protectedRoute(<Video />)} />
        <Route path="/notes" element={protectedRoute(<Notes />)} />
        <Route path="/youtube-videos" element={protectedRoute(<YouTubeVideos />)} />
        <Route path="/youtube-video-summarizer" element={protectedRoute(<YouTubeVideoSummarizer />)} />
        <Route path="/doubt-clearance" element={protectedRoute(<DoubtClearance />)} />
        <Route path="/teacher-guidance" element={protectedRoute(<TeacherGuidance />)} />

        {/* Teacher routes (separate credential check) */}
        <Route path="/teacher-login" element={<TeacherLogin />} />
        <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
        <Route path="/course-videos/:courseId" element={<CourseVideos />} />

        {/* Anything else */}
        <Route path="*" element={<Navigate to={user ? "/home" : "/"} replace />} />
      </Routes>
    </Suspense>
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
