import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { LockKeyhole, ArrowLeft, CheckCircle2 } from "lucide-react";
import gsap from "gsap";
import { useAuthStore } from "../store/useAuthStore";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);
  const { resetPassword } = useAuthStore();
  const iconRef = useRef(null);

  const isMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*]/.test(password);
  const isValid = isMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

  useEffect(() => {
    gsap.to(iconRef.current, {
      y: -10,
      rotation: 5,
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token || !isValid) return;
    setIsLoading(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setIsSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#FDFBF7] px-4">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Invalid Reset Link</h2>
        <p className="text-slate-500 mb-6">The password reset link is missing or invalid.</p>
        <Link to="/forgot-password" className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold border-cartoon shadow-neubrutalism-sm">
          Request new link
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#FDFBF7] px-4 py-12">
      <div className="w-full max-w-md">
        <motion.div 
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-white p-8 rounded-[2.5rem] border-cartoon shadow-neubrutalism"
        >
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center text-center py-6">
              <div className="w-24 h-24 bg-pastel-mint rounded-full flex items-center justify-center mb-6 border-cartoon shadow-neubrutalism-sm rotate-[-5deg]">
                <CheckCircle2 size={48} className="text-slate-800" />
              </div>
              <h2 className="text-3xl font-heading text-slate-800 mb-4 tracking-tight">Password Updated!</h2>
              <p className="text-slate-600 mb-8 font-medium px-2">
                Your password has been successfully reset. Redirecting to login...
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center text-center mb-8">
                <div ref={iconRef} className="w-16 h-16 bg-pastel-peach rounded-2xl flex items-center justify-center mb-6 border-cartoon shadow-neubrutalism-sm rotate-[10deg]">
                  <LockKeyhole size={32} className="text-slate-800" />
                </div>
                <h2 className="text-3xl font-heading text-slate-800 mb-2">Create New Password</h2>
                <p className="text-slate-500 font-medium">Please enter your new strong password.</p>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 mb-6 rounded-2xl border-2 font-semibold text-sm bg-red-100 border-red-400 text-red-800"
                >
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700 ml-2">New Password</label>
                  <div className="relative flex items-center">
                    <LockKeyhole size={20} className="absolute left-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-300 focus:border-slate-800 focus:ring-0 outline-none transition-colors bg-slate-50 font-medium"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {password.length > 0 && (
                  <div className="p-3 bg-slate-50 rounded-2xl border-2 border-slate-200 text-xs flex flex-col gap-1.5 transition-all">
                    <p className="font-bold text-slate-500 mb-0.5">Password Requirements:</p>
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className={isMinLength ? "text-green-600" : "text-slate-400"}>
                        {isMinLength ? "✓" : "○"} At least 8 characters
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className={hasUppercase ? "text-green-600" : "text-slate-400"}>
                        {hasUppercase ? "✓" : "○"} One uppercase letter (A-Z)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className={hasLowercase ? "text-green-600" : "text-slate-400"}>
                        {hasLowercase ? "✓" : "○"} One lowercase letter (a-z)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className={hasNumber ? "text-green-600" : "text-slate-400"}>
                        {hasNumber ? "✓" : "○"} One number (0-9)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className={hasSpecial ? "text-green-600" : "text-slate-400"}>
                        {hasSpecial ? "✓" : "○"} One special character (!@#$%^&*)
                      </span>
                    </div>
                  </div>
                )}

                <motion.button
                  type="submit"
                  disabled={isLoading || !isValid}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full py-4 mt-4 bg-slate-800 rounded-2xl border-cartoon shadow-neubrutalism-sm font-bold text-lg text-white hover:bg-slate-700 transition-colors disabled:opacity-70 disabled:hover:scale-100"
                >
                  {isLoading ? "Saving..." : "Update Password"}
                </motion.button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
