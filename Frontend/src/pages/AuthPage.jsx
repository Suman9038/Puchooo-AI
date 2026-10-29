import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import gsap from "gsap";
import { BookOpen, Sparkles, Pencil, MailCheck } from "lucide-react";
import logo from "../assets/logo.png";

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [isSignupSuccess, setIsSignupSuccess] = useState(false);
  const { login, signup, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const illustrationRef = useRef(null);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "signup") {
      setIsLogin(false);
    } else {
      setIsLogin(true);
    }
  }, [searchParams]);

  // Form states
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const password = formData.password || "";
  const isMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*]/.test(password);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    // GSAP Floating Animation for the illustration container
    gsap.to(".float-element", {
      y: -20,
      rotation: 5,
      duration: 3,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      stagger: 0.2
    });
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!isLogin) {
      const password = formData.password;
      if (password.length < 8) {
        setError("Password must be at least 8 characters long");
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setError("Password must contain at least one uppercase letter");
        return;
      }
      if (!/[a-z]/.test(password)) {
        setError("Password must contain at least one lowercase letter");
        return;
      }
      if (!/[0-9]/.test(password)) {
        setError("Password must contain at least one number");
        return;
      }
      if (!/[!@#$%^&*]/.test(password)) {
        setError("Password must contain at least one special character (!@#$%^&*)");
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        navigate("/dashboard");
      } else {
        await signup(formData);
        setIsSignupSuccess(true);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] sm:min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
        
        {/* Left Side: GSAP Animated Illustration */}
        <div ref={illustrationRef} className="hidden md:flex flex-col items-center justify-center relative h-full min-h-[400px]">
          <div className="absolute inset-0 bg-pastel-lavender/30 rounded-full filter blur-[100px] z-0"></div>
          
          <div className="relative z-10 w-full h-full flex items-center justify-center">
            {/* Mascot / Icons */}
            <div className="float-element absolute top-10 left-10 p-6 bg-pastel-yellow rounded-3xl border-cartoon shadow-neubrutalism rotate-[-12deg]">
              <BookOpen size={48} className="text-slate-800" />
            </div>
            
            <div className="float-element absolute bottom-20 right-10 p-6 bg-pastel-peach rounded-full border-cartoon shadow-neubrutalism rotate-[15deg]">
              <Sparkles size={48} className="text-slate-800" />
            </div>

            <div className="float-element absolute top-32 right-20 p-4 bg-pastel-mint rounded-xl border-cartoon shadow-neubrutalism rotate-[8deg]">
              <Pencil size={32} className="text-slate-800" />
            </div>

            <div className="text-center mt-32 z-20 flex flex-col items-center">
              <img src={logo} alt="Puchooo.AI" className="w-64 mb-6 drop-shadow-sm" />
              <h1 className="text-5xl font-heading text-slate-800 mb-4 tracking-tighter">
                Study Smarter,<br/> Not Harder!
              </h1>
              <p className="text-xl text-slate-600 font-medium">
                Chat with any YouTube video in seconds.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Framer Motion Form */}
        <div className="flex flex-col items-center w-full max-w-md mx-auto">
          <motion.div 
            layout
            className="w-full bg-white p-6 md:p-8 rounded-[2.5rem] border-cartoon shadow-neubrutalism"
          >
            {isSignupSuccess ? (
              <div className="flex flex-col items-center justify-center text-center py-6">
                <div className="w-24 h-24 bg-pastel-mint rounded-full flex items-center justify-center mb-6 border-cartoon shadow-neubrutalism-sm rotate-[-5deg]">
                  <MailCheck size={48} className="text-slate-800" />
                </div>
                <h2 className="text-3xl font-heading text-slate-800 mb-4">You're Almost There!</h2>
                <p className="text-slate-600 mb-8 font-medium px-2">
                  We've sent a verification link to <br/><span className="font-bold text-slate-800">{formData.email}</span>.<br/><br/>
                  Please check your inbox and verify your email before logging in.
                </p>
                <button
                  onClick={() => {
                    setIsSignupSuccess(false);
                    setIsLogin(true);
                    setFormData({ ...formData, password: "" });
                  }}
                  className="w-full py-4 bg-pastel-yellow rounded-2xl border-cartoon shadow-neubrutalism-sm font-bold text-lg text-slate-800 hover:bg-[#fde047] transition-colors"
                >
                  Proceed to Login
                </button>
              </div>
            ) : (
              <>
                <motion.div layout className="mb-8 text-center">
                  <h2 className="text-3xl font-heading text-slate-800 mb-2">
                {isLogin ? "Welcome Back!" : "Create Account"}
              </h2>
              <p className="text-slate-500">
                {isLogin ? "Log in to access your study materials." : "Sign up to start chatting with videos."}
              </p>
            </motion.div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 mb-6 rounded-2xl border-2 font-semibold text-sm ${
                  error.includes("successfully") 
                    ? "bg-pastel-mint/50 border-green-400 text-green-800"
                    : "bg-red-100 border-red-400 text-red-800"
                }`}
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <AnimatePresence mode="popLayout">
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-col gap-4 overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-bold text-slate-700 ml-2">First Name</label>
                        <input
                          type="text"
                          name="first_name"
                          required={!isLogin}
                          value={formData.first_name}
                          onChange={handleChange}
                          className="w-full px-4 py-3 rounded-2xl border-cartoon shadow-neubrutalism-sm focus:border-slate-900 focus:shadow-neubrutalism outline-none transition-all bg-white font-bold placeholder-slate-400"
                          placeholder="John"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-bold text-slate-700 ml-2">Last Name</label>
                        <input
                          type="text"
                          name="last_name"
                          required={!isLogin}
                          value={formData.last_name}
                          onChange={handleChange}
                          className="w-full px-4 py-3 rounded-2xl border-cartoon shadow-neubrutalism-sm focus:border-slate-900 focus:shadow-neubrutalism outline-none transition-all bg-white font-bold"
                          placeholder="Doe"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-bold text-slate-700 ml-2">Username</label>
                      <input
                        type="text"
                        name="username"
                        required={!isLogin}
                        value={formData.username}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-2xl border-cartoon shadow-neubrutalism-sm focus:border-slate-900 focus:shadow-neubrutalism outline-none transition-all bg-white font-bold"
                        placeholder="johndoe123"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-bold text-slate-700 ml-2">Email Address</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-2xl border-cartoon shadow-neubrutalism-sm focus:border-slate-900 focus:shadow-neubrutalism outline-none transition-all bg-white font-bold"
                  placeholder="hello@example.com"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-bold text-slate-700 ml-2">Password</label>
                <input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-2xl border-cartoon shadow-neubrutalism-sm focus:border-slate-900 focus:shadow-neubrutalism outline-none transition-all bg-white font-bold"
                  placeholder="••••••••"
                />
                {isLogin && (
                  <div className="flex justify-end mt-1">
                    <Link to="/forgot-password" className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">
                      Forgot Password?
                    </Link>
                  </div>
                )}
              </div>

              {!isLogin && password.length > 0 && (
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
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                className="w-full py-4 mt-4 bg-pastel-mint rounded-2xl border-cartoon shadow-neubrutalism-sm font-bold text-lg text-slate-800 hover:bg-[#86efac] transition-colors disabled:opacity-70"
              >
                {isLoading ? "Please wait..." : isLogin ? "Log In" : "Sign Up"}
              </motion.button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-slate-500 font-medium">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError(null);
                  }}
                  className="ml-2 text-pastel-primary text-[#9333ea] font-bold hover:underline"
                >
                  {isLogin ? "Sign up here" : "Log in instead"}
                </button>
              </p>
            </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
