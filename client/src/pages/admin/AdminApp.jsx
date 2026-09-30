import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from '../../AdminAuthContext';
import RouteFallback from '../../components/RouteFallback';
import AdminLogin from './AdminLogin';

const Overview = lazy(() => import('./Overview'));
const RiskBoard = lazy(() => import('./RiskBoard'));
const AreaDetail = lazy(() => import('./AreaDetail'));
const AssessmentDetail = lazy(() => import('./AssessmentDetail'));
const LiveRun = lazy(() => import('./LiveRun'));
const Runs = lazy(() => import('./LiveRun').then((m) => ({ default: m.Runs })));
const ReportsInbox = lazy(() => import('./ReportsInbox'));
const AdminReportDetail = lazy(() => import('./ReportsInbox').then((m) => ({ default: m.AdminReportDetail })));
const Gateways = lazy(() => import('./Gateways'));
const GatewayDetail = lazy(() => import('./Gateways').then((m) => ({ default: m.GatewayDetail })));
const Users = lazy(() => import('./Users'));
const UserDetail = lazy(() => import('./Users').then((m) => ({ default: m.UserDetail })));
const Moderation = lazy(() => import('./Moderation'));
const FeaturesLimits = lazy(() => import('./FeaturesLimits'));
const Announcements = lazy(() => import('./Announcements'));
const AuditLog = lazy(() => import('./AuditLog'));
const Assistant = lazy(() => import('./Assistant'));

function AdminRoutes() {
  const { admin, restoring } = useAdminAuth();
  if (restoring) return <RouteFallback />;
  // Like the student app's protectedRoute, for admins: no admin session, back to the admin sign-in.
  const guarded = (element) => (admin ? element : <Navigate to="/admin/login" replace />);
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route index element={guarded(<Overview />)} />
        <Route path="risk" element={guarded(<RiskBoard />)} />
        <Route path="risk/assessments/:id" element={guarded(<AssessmentDetail />)} />
        <Route path="risk/:area" element={guarded(<AreaDetail />)} />
        <Route path="runs" element={guarded(<Runs />)} />
        <Route path="runs/:runId" element={guarded(<LiveRun />)} />
        <Route path="reports" element={guarded(<ReportsInbox />)} />
        <Route path="reports/:ref" element={guarded(<AdminReportDetail />)} />
        <Route path="gateways" element={guarded(<Gateways />)} />
        <Route path="gateways/:id" element={guarded(<GatewayDetail />)} />
        <Route path="users" element={guarded(<Users />)} />
        <Route path="users/:id" element={guarded(<UserDetail />)} />
        <Route path="moderation" element={guarded(<Moderation />)} />
        <Route path="settings" element={guarded(<FeaturesLimits />)} />
        <Route path="announcements" element={guarded(<Announcements />)} />
        <Route path="assistant" element={guarded(<Assistant />)} />
        <Route path="assistant/:id" element={guarded(<Assistant />)} />
        <Route path="audit" element={guarded(<AuditLog />)} />
        <Route path="*" element={<Navigate to={admin ? '/admin' : '/admin/login'} replace />} />
      </Routes>
    </Suspense>
  );
}

/** The admin console: its own session (AdminAuthProvider), inside the app's router. */
export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <AdminRoutes />
    </AdminAuthProvider>
  );
}
