import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import RouteFallback from "./components/RouteFallback";
import useStudyTimeTracker from "./hooks/useStudyTimeTracker";

// Routes are code-split: the entry bundle previously contained every page,
// so the landing screen paid the download cost of the whole application.
const Landing = lazy(() => import("./pages/Landing"));
const HomePage = lazy(() => import("./pages/HomePage"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Chatbot = lazy(() => import("./pages/Chatbot"));
const Career = lazy(() => import("./pages/Career"));
const Doubts = lazy(() => import("./pages/Doubts"));
const Forum = lazy(() => import("./pages/Forum"));
const Video = lazy(() => import("./pages/Video"));
const SkillUnlocker = lazy(() => import("./pages/SkillUnlocker"));

const LEGACY_ROUTES = {
  '/roadmap': '/career?tool=roadmap',
  '/skills-required': '/career?tool=skills',
  '/doubt-clearance': '/doubts?tool=doubts',
  '/notes': '/doubts?tool=notes',
  '/youtube-video-summarizer': '/video?tool=summarizer',
  '/youtube-videos': '/video?tool=library',
};

/** Redirect an old URL to its hub, keeping ?open=<id> so the same item opens. */
function LegacyRedirect({ to }) {
  const { search } = useLocation();
  const open = new URLSearchParams(search).get('open');
  return <Navigate to={open ? `${to}&open=${encodeURIComponent(open)}` : to} replace />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  // Records real time-in-app for the study-time charts, on every page, while signed in.
  useStudyTimeTracker(user?.email);

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
        <Route path="/chatbot" element={protectedRoute(<Chatbot />)} />
        <Route path="/career" element={protectedRoute(<Career />)} />
        <Route path="/skill-unlocker" element={protectedRoute(<SkillUnlocker />)} />
        <Route path="/doubts" element={protectedRoute(<Doubts />)} />
        <Route path="/forum" element={protectedRoute(<Forum />)} />
        <Route path="/video" element={protectedRoute(<Video />)} />

        {/* Old standalone copies of the hub tools were removed; their URLs (bookmarks,
            links in earlier Novard Agent chats) now open the same tool inside its hub. */}
        {Object.entries(LEGACY_ROUTES).map(([path, target]) => (
          <Route key={path} path={path} element={<LegacyRedirect to={target} />} />
        ))}

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
