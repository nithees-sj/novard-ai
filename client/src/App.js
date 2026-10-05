import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import RouteFallback from "./components/RouteFallback";
import useStudyTimeTracker from "./hooks/useStudyTimeTracker";
import { AppStatusProvider } from "./context/AppStatusContext";
import { ReportProvider } from "./context/ReportContext";
import { ThemeProvider } from "./context/ThemeContext";
import { MaintenanceNotice } from "./components/FeatureNotice";

// Routes are code-split: the entry bundle previously contained every page,
// so the landing screen paid the download cost of the whole application.
// The student pages, loaded on demand and preloaded once signed in (see PrefetchPages).
const PAGE_LOADERS = {
  home: () => import("./pages/HomePage"),
  profile: () => import("./pages/Profile"),
  settings: () => import("./pages/Settings"),
  chatbot: () => import("./pages/Chatbot"),
  career: () => import("./pages/Career"),
  doubts: () => import("./pages/Doubts"),
  forum: () => import("./pages/Forum"),
  video: () => import("./pages/Video"),
  skillUnlocker: () => import("./pages/SkillUnlocker"),
  reports: () => import("./pages/Reports"),
};
const Landing = lazy(() => import("./pages/Landing"));
const HomePage = lazy(PAGE_LOADERS.home);
const Profile = lazy(PAGE_LOADERS.profile);
const Settings = lazy(PAGE_LOADERS.settings);
const Chatbot = lazy(PAGE_LOADERS.chatbot);
const Career = lazy(PAGE_LOADERS.career);
const Doubts = lazy(PAGE_LOADERS.doubts);
const Forum = lazy(PAGE_LOADERS.forum);
const Video = lazy(PAGE_LOADERS.video);
const SkillUnlocker = lazy(PAGE_LOADERS.skillUnlocker);
const Reports = lazy(PAGE_LOADERS.reports);

/**
 * Once a student is signed in, fetch the other pages' code in the
 * background (when the browser is idle), so moving between pages does not
 * wait on the network.
 */
function usePrefetchPages(signedIn) {
  useEffect(() => {
    if (!signedIn) return undefined;
    const run = () => Object.values(PAGE_LOADERS).forEach((load) => load().catch(() => {}));
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 4000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = setTimeout(run, 1500);
    return () => clearTimeout(t);
  }, [signedIn]);
}
const AdminApp = lazy(() => import("./pages/admin/AdminApp"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
  usePrefetchPages(!!user);

  if (loading) {
    return <RouteFallback />;
  }

  // Wraps a page that requires an authenticated user.
  const protectedRoute = (element) => (user ? element : <Navigate to="/" replace />);

  return (
    <Suspense fallback={<RouteFallback />}>
      <MaintenanceNotice />
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
        <Route path="/reports" element={protectedRoute(<Reports />)} />
        <Route path="/reports/:ref" element={protectedRoute(<Reports />)} />

        {/* The admin console: its own sign-in and session (pages/admin). */}
        <Route path="/admin/*" element={<AdminApp />} />

        {/* Old standalone copies of the hub tools were removed; their URLs (bookmarks,
            links in earlier Novard Agent chats) now open the same tool inside its hub. */}
        {Object.entries(LEGACY_ROUTES).map(([path, target]) => (
          <Route key={path} path={path} element={<LegacyRedirect to={target} />} />
        ))}

        {/* Anything else */}
        <Route path="*" element={<NotFound signedIn={!!user} />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    // v7_startTransition: navigation keeps the current page on screen while the
    // next one loads, instead of flashing the loading screen.
    <BrowserRouter future={{ v7_startTransition: true }}>
      <AuthProvider>
        <ThemeProvider>
          <AppStatusProvider>
            <ReportProvider>
              <AppRoutes />
            </ReportProvider>
          </AppStatusProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
