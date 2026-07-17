import React, { useEffect } from "react";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { isExtension } from "./lib/utils";
import { useAuthStore } from "./store/useAuthStore";
import Layout from "./components/Layout";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ChatPage from "./pages/ChatPage";
import LandingPage from "./pages/LandingPage";
import AdminPage from "./pages/AdminPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

function ProtectedRoute({ children }) {
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [isChecking, setIsChecking] = React.useState(true);

  useEffect(() => {
    const verify = async () => {
      await checkAuth();
      setIsChecking(false);
    };
    verify();
  }, [checkAuth]);

  if (isChecking) {
    return <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] text-slate-500 font-bold">Loading...</div>;
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
    const verify = async () => {
      await checkAuth();
      setIsChecking(false);
    };
    verify();
  }, [checkAuth]);

  if (isChecking) {
    return <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] text-slate-500 font-bold">Verifying authorization...</div>;
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
      <Routes>
        <Route path="/login" element={
          <div className="bg-pastel-yellow min-h-[100dvh] pt-12 px-4 relative overflow-hidden">
            {/* Polka Dots */}
            <div 
              className="fixed inset-0 z-0 pointer-events-none opacity-20"
              style={{
                backgroundImage: 'radial-gradient(var(--border-color-cartoon) 3px, transparent 3px)',
                backgroundSize: '40px 40px',
              }}
            >
              <div 
                className="absolute inset-0 w-full h-full animate-[slide_4s_linear_infinite]"
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
    </Router>
  );
}
