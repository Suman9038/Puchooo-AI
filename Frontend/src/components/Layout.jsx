import React, { useEffect, useRef, useState } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import Lenis from "lenis";
import { useAuthStore } from "../store/useAuthStore";
import { motion } from "framer-motion";
import { LogOut, Shield, Settings } from "lucide-react";
import { cn, isExtension } from "../lib/utils";
import SettingsModal from "./SettingsModal";
import logo from "../assets/logo.png";

export default function Layout() {
  const lenisRef = useRef(null);
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Only initialize smooth scrolling on non-touch desktop screens to preserve native touch scrolling on mobile
    const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 1024);
    if (isTouch) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smooth: true,
    });
    lenisRef.current = lenis;

    let rafId;

    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      cancelAnimationFrame(rafId);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col relative">
      {/* Floating Navbar Container */}
      <header className="fixed top-2 sm:top-4 inset-x-0 z-50 flex justify-center pointer-events-none px-2 sm:px-4">
        <motion.nav 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(
            "pointer-events-auto flex items-center justify-between bg-white/90 backdrop-blur-md border-cartoon shadow-neubrutalism-sm transition-all",
            isExtension 
              ? "w-full max-w-md p-2 rounded-2xl" 
              : "w-full max-w-4xl px-3 py-2 sm:px-5 sm:py-3 rounded-2xl sm:rounded-3xl"
          )}
        >
          <Link to="/dashboard" className="flex items-center gap-2 shrink-0 group">
            <img 
              src={logo} 
              alt="Puchooo.AI Logo" 
              className="h-8 sm:h-10 w-auto object-contain drop-shadow-sm transition-transform group-hover:scale-105" 
            />
            <span className="font-heading font-black text-lg sm:text-2xl text-slate-900 tracking-tight">
              Puchooo<span className="text-purple-600">.AI</span>
            </span>
          </Link>

          {isAuthenticated && (
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {user?.role === "admin" && (
                <Link to="/admin">
                  <motion.button 
                    whileHover={{ scale: 1.05, rotate: -5 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-1.5 sm:p-2 bg-pastel-blue rounded-xl border-2 border-slate-700 shadow-neubrutalism-sm text-slate-800 flex items-center justify-center hover:bg-blue-200 transition-colors"
                    title="Admin Panel"
                  >
                    <Shield size={18} className="sm:w-5 sm:h-5" />
                  </motion.button>
                </Link>
              )}
              <div className="flex items-center gap-1.5 sm:gap-2.5">
                <div 
                  className="w-8 h-8 sm:w-10 sm:h-10 bg-pastel-mint rounded-full border-2 border-slate-700 flex items-center justify-center font-black text-xs sm:text-sm text-slate-800 shadow-sm"
                  title={user?.username || "User"}
                >
                  {user?.username?.charAt(0).toUpperCase() || "U"}
                </div>
                <motion.button
                  whileHover={{ scale: 1.05, rotate: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-1.5 sm:p-2 bg-slate-100 rounded-xl border-2 border-slate-700 shadow-neubrutalism-sm text-slate-800 flex items-center justify-center hover:bg-slate-200 transition-colors"
                  title="Settings"
                >
                  <Settings size={18} className="sm:w-5 sm:h-5" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  className="p-1.5 sm:p-2 bg-pastel-peach rounded-xl border-2 border-slate-700 shadow-neubrutalism-sm text-slate-800 flex items-center justify-center hover:bg-red-200 transition-colors"
                  title="Logout"
                >
                  <LogOut size={18} className="sm:w-5 sm:h-5" />
                </motion.button>
              </div>
            </div>
          )}
        </motion.nav>
      </header>

      <main className="flex-grow w-full relative z-10 flex flex-col">
        <Outlet />
      </main>

      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden opacity-40">
        <div className="absolute top-[5%] left-[10%] w-[500px] h-[500px] bg-pastel-mint rounded-full mix-blend-multiply filter blur-[120px] animate-blob"></div>
        <div className="absolute top-[20%] right-[10%] w-[600px] h-[600px] bg-pastel-lavender rounded-full mix-blend-multiply filter blur-[120px] animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[5%] left-[20%] w-[700px] h-[700px] bg-pastel-peach rounded-full mix-blend-multiply filter blur-[120px] animate-blob animation-delay-4000"></div>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
