import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { KeyRound, Mail, ArrowLeft, MailCheck } from "lucide-react";
import gsap from "gsap";
import { useAuthStore } from "../store/useAuthStore";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);
  const { forgotPassword } = useAuthStore();
  const iconRef = useRef(null);

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
    if (!email) return;
    setIsLoading(true);
    setError(null);
    try {
      await forgotPassword(email);
      setIsSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#FDFBF7] px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-2 mb-6 text-slate-500 font-bold hover:text-slate-800 transition-colors cursor-pointer">
          <ArrowLeft size={20} /> Back to login
        </Link>
        <motion.div
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-white p-8 rounded-[2.5rem] border-cartoon shadow-neubrutalism"
        >
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center text-center py-6">
              <div ref={iconRef} className="w-24 h-24 bg-pastel-mint rounded-full flex items-center justify-center mb-6 border-cartoon shadow-neubrutalism-sm rotate-[-5deg]">
                <MailCheck size={48} className="text-slate-800" />
              </div>
              <h2 className="text-3xl font-heading text-slate-800 mb-4 tracking-tight">Check your mail</h2>
              <p className="text-slate-600 mb-8 font-medium px-2">
                We've sent a password reset link to <br/><span className="font-bold text-slate-800">{email}</span>.
              </p>
              <button
                onClick={() => {
                  setIsSuccess(false);
                  setEmail("");
                }}
                className="w-full py-4 bg-pastel-yellow rounded-2xl border-cartoon shadow-neubrutalism-sm font-bold text-lg text-slate-800 hover:bg-[#fde047] transition-colors"
              >
                Try another email
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center text-center mb-8">
                <div ref={iconRef} className="w-16 h-16 bg-pastel-lavender rounded-2xl flex items-center justify-center mb-6 border-cartoon shadow-neubrutalism-sm rotate-[-10deg]">
                  <KeyRound size={32} className="text-slate-800" />
                </div>
                <h2 className="text-3xl font-heading text-slate-800 mb-2">Forgot Password?</h2>
                <p className="text-slate-500 font-medium">No worries, we'll send you reset instructions.</p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="floating-label relative">
                  <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-300 focus:border-slate-800 focus:ring-0 outline-none transition-colors bg-slate-50 font-medium placeholder-shown:text-slate-400"
                    placeholder=" "
                  />
                  <label className="ml-10 text-slate-500">Email Address</label>
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

                <motion.button
                  type="submit"
                  disabled={isLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full py-4 mt-4 bg-slate-800 rounded-2xl border-cartoon shadow-neubrutalism-sm font-bold text-lg text-white hover:bg-slate-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.747z" />
                      </svg>
                      "Sending..."
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </motion.button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}