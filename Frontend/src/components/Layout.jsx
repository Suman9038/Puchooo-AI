import React, { useEffect, useRef, useState } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import Lenis from "lenis";
import { useAuthStore } from "../store/useAuthStore";
import { motion } from "framer-motion";
import { LogOut, BookOpen, MessageSquare, Video, Shield, Settings } from "lucide-react";
import { cn, isExtension } from "../lib/utils";
import SettingsModal from "./SettingsModal";
import logo from "../assets/logo.png";

export default function Layout() {
  const lenisRef = useRef(null);
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smooth: true,
    });
    lenisRef.current = lenis;

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col relative">
      {/* Floating Navbar */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className={cn(
          "fixed left-1/2 -translate-x-1/2 z-50 flex items-center justify-between bg-white/70 backdrop-blur-md border-cartoon shadow-neubrutalism-sm",
          isExtension ? "top-2 w-[95%] p-2 rounded-2xl" : "top-4 w-11/12 max-w-4xl p-4 rounded-3xl"
        )}
      >
        <Link to="/dashboard" className="flex items-center">
          <img src={logo} alt="Puchooo.AI Logo" className="h-12 w-auto object-contain drop-shadow-sm transition-transform hover:scale-105" />
        </Link>

        {isAuthenticated && (
          <div className="flex items-center gap-4">
            {user?.role === "admin" && (
              <Link to="/admin">
                <motion.button 
                  whileHover={{ scale: 1.05, rotate: -5 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 bg-pastel-blue rounded-xl border-2 border-slate-700 shadow-neubrutalism-sm text-slate-800 flex items-center justify-center hover:bg-blue-200 transition-colors"
                  title="Admin Panel"
                >
                  <Shield size={20} />
                </motion.button>
              </Link>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-pastel-mint rounded-full border-2 border-slate-700 flex items-center justify-center font-bold text-slate-800 shadow-sm">
                {user?.username?.charAt(0).toUpperCase() || "U"}
              </div>
              <motion.button
                whileHover={{ scale: 1.05, rotate: -5 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 bg-slate-100 rounded-xl border-2 border-slate-700 shadow-neubrutalism-sm text-slate-800 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <Settings size={20} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLogout}
                className="p-2 bg-pastel-peach rounded-xl border-2 border-slate-700 shadow-neubrutalism-sm text-slate-800 flex items-center justify-center hover:bg-red-200 transition-colors"
              >
                <LogOut size={20} />
              </motion.button>
            </div>
          </div>
        )}
      </motion.nav>

      <main className={cn(
        "flex-grow relative z-10 mx-auto w-full",
        isExtension ? "pt-20 pb-4 px-2" : "pt-28 pb-12 px-4 sm:px-6 md:px-8 max-w-7xl"
      )}>
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
