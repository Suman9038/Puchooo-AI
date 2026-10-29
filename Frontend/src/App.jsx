import React, { useEffect, Suspense, lazy } from "react";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { isExtension } from "./lib/utils";
import { useAuthStore } from "./store/useAuthStore";
import Layout from "./components/Layout";
import { Loader2 } from "lucide-react";

// Lazy-loaded route pages for zero-waterfall bundle splitting
const AuthPage = lazy(() => import("./pages/AuthPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));

function PageLoader({ message = "Setting up your study desk..." }) {
  return (
    <div className="min-h-[60vh] w-full flex flex-col items-center justify-center gap-4 p-8 animate-fade-in">
      <div className="relative">
        <div className="w-16 h-16 bg-pastel-yellow border-cartoon rounded-2xl flex items-center justify-center shadow-neubrutalism animate-bounce">
          <Loader2 className="w-8 h-8 text-slate-900 animate-spin" strokeWidth={3} />
        </div>
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="font-heading font-black text-xl text-slate-800 tracking-tight">{message}</p>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Puchooo AI</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [isChecking, setIsChecking] = React.useState(true);

  useEffect(() => {
    let isMounted = true;
    const verify = async () => {
      await checkAuth();
      if (isMounted) setIsChecking(false);
    };
    verify();
    return () => { isMounted = false; };
  }, [checkAuth]);

  if (isChecking) {
    return <PageLoader message="Checking authentication..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { isAuthenticated, user, checkAuth } = useAuthStore();
  const [isChecking, setIsChecking] = React.useState(true);

  useEffect(() => {
    let isMounted = true;
    const verify = async () => {
      await checkAuth();
      if (isMounted) setIsChecking(false);
    };
    verify();
    return () => { isMounted = false; };
  }, [checkAuth]);

  if (isChecking) {
    return <PageLoader message="Verifying authorization..." />;
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

const Router = isExtension ? HashRouter : BrowserRouter;

if (isExtension) {
  // Enforce a fixed size for the Chrome Extension popup
  document.body.style.width = '420px';
  document.body.style.height = '600px';
  document.body.style.overflowX = 'hidden';
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={
            <div className="bg-pastel-yellow min-h-[100dvh] pt-12 px-4 relative overflow-hidden">
              {/* Animated Polka Dots */}
              <div 
                className="fixed inset-0 z-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage: 'radial-gradient(var(--border-color-cartoon) 3px, transparent 3px)',
                  backgroundSize: '40px 40px',
                }}
              >
                <div 
                  className="absolute inset-0 w-full h-full animate-[slide_20s_linear_infinite]"
                  style={{
                    backgroundImage: 'radial-gradient(var(--border-color-cartoon) 3px, transparent 3px)',
                    backgroundSize: '40px 40px',
                  }}
                />
              </div>
              <div className="relative z-10"><AuthPage /></div>
            </div>
          } />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          
          <Route element={<Layout />}>
            <Route path="/" element={isExtension ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/chat" element={
              <ProtectedRoute>
                <Navigate to="/dashboard" replace />
              </ProtectedRoute>
            } />
            <Route path="/chat/:id" element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            } />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}
