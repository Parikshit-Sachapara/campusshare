import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/ui';
import { AppShell } from './components/layout/AppShell';
import { ServerWakeupBanner } from './components/layout/ServerWakeupBanner';
import { ProtectedRoute } from './routes/ProtectedRoute';

// Public Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { StyleguidePage } from './pages/StyleguidePage';

// Student Pages
import { StudentDashboard } from './pages/student/StudentDashboard';
import { MarketplacePage } from './pages/student/MarketplacePage';
import { ResourceDetailsPage } from './pages/student/ResourceDetailsPage';
import { MyBookingsPage } from './pages/student/MyBookingsPage';
import { WaitlistPage } from './pages/student/WaitlistPage';
import { NotificationsPage } from './pages/student/NotificationsPage';
import { ProfilePage } from './pages/student/ProfilePage';

// Owner Pages
import { OwnerDashboard } from './pages/owner/OwnerDashboard';
import { OwnerResourcesPage } from './pages/owner/OwnerResourcesPage';
import { AddEditResourcePage } from './pages/owner/AddEditResourceModal';
import { HandoverScreen } from './pages/owner/HandoverScreen';
import { ReturnVerificationScreen } from './pages/owner/ReturnVerificationScreen';
import { OwnerRequestsPage } from './pages/owner/OwnerRequestsPage';
import { OwnerIncidentsPage } from './pages/owner/OwnerIncidentsPage';

// Manager Pages
import { ManagerDashboard } from './pages/manager/ManagerDashboard';
import { ManagerApprovalQueue } from './pages/manager/ManagerApprovalQueue';
import { IncidentReviewPage } from './pages/manager/IncidentReviewPage';
import { EligibilityReviewPage } from './pages/manager/EligibilityReviewPage';
import { RestrictedBookingsPage } from './pages/manager/RestrictedBookingsPage';
import { DepartmentStatsPage } from './pages/manager/DepartmentStatsPage';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminDepartmentsPage } from './pages/admin/AdminDepartmentsPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminBookingsPage } from './pages/admin/AdminBookingsPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30s
      refetchOnWindowFocus: false,
    },
  },
});

// Dynamic role-based dashboard switch
const DynamicDashboard: React.FC = () => {
  const { role } = useAuth();
  switch (role) {
    case 'OWNER':
      return <OwnerDashboard />;
    case 'MANAGER':
      return <ManagerDashboard />;
    case 'ADMIN':
      return <AdminDashboard />;
    case 'STUDENT':
    default:
      return <StudentDashboard />;
  }
};

// Dynamic role-based incident switch
const DynamicIncidents: React.FC = () => {
  const { role } = useAuth();
  if (role === 'MANAGER' || role === 'ADMIN') {
    return <IncidentReviewPage />;
  }
  return <OwnerIncidentsPage />;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <ServerWakeupBanner />
              <Routes>
                {/* Public Landing & Authentication */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />

                {/* Authenticated Platform App Shell */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppShell />
                    </ProtectedRoute>
                  }
                >
                  {/* Dynamic Dashboard */}
                  <Route path="/dashboard" element={<DynamicDashboard />} />

                  {/* Student Domain */}
                  <Route path="/marketplace" element={<MarketplacePage />} />
                  <Route path="/resources/:id" element={<ResourceDetailsPage />} />
                  <Route path="/bookings" element={<MyBookingsPage />} />
                  <Route path="/waitlist" element={<WaitlistPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />

                  {/* Owner Domain */}
                  <Route path="/resources" element={<OwnerResourcesPage />} />
                  <Route path="/resources/new" element={<AddEditResourcePage />} />
                  <Route path="/handover" element={<HandoverScreen />} />
                  <Route path="/returns" element={<ReturnVerificationScreen />} />
                  <Route path="/requests" element={<OwnerRequestsPage />} />

                  {/* Manager Domain */}
                  <Route path="/approvals" element={<ManagerApprovalQueue />} />
                  <Route path="/eligibility" element={<EligibilityReviewPage />} />
                  <Route path="/restricted" element={<RestrictedBookingsPage />} />
                  <Route path="/stats" element={<DepartmentStatsPage />} />

                  {/* Dynamic Incident Center (Owner reports, Manager/Admin resolves) */}
                  <Route path="/incidents" element={<DynamicIncidents />} />

                  {/* Admin Domain */}
                  <Route path="/users" element={<AdminUsersPage />} />
                  <Route path="/departments" element={<AdminDepartmentsPage />} />
                  <Route path="/categories" element={<AdminCategoriesPage />} />
                  <Route path="/admin/bookings" element={<AdminBookingsPage />} />
                  <Route path="/audit" element={<AdminAuditPage />} />
                  <Route path="/settings" element={<AdminSettingsPage />} />

                  {/* Design System Reference */}
                  <Route path="/styleguide" element={<StyleguidePage />} />
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
