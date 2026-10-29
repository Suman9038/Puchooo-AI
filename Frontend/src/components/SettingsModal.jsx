import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

export default function SettingsModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("profile"); // 'profile' or 'security'

  // Profile State
  const { user, changePassword, updateProfile } = useAuthStore();
  const [username, setUsername] = useState(user?.username || "");
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");

  // Security State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Global State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Sync state when user prop changes or modal opens
  useEffect(() => {
    if (isOpen && user) {
      setUsername(user.username || "");
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
    }
  }, [isOpen, user]);

  const isMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*]/.test(newPassword);
  const isPasswordValid = isMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!username || !firstName || !lastName) return;

    setIsLoading(true);
    setError(null);
    try {
      await updateProfile({
        username,
        first_name: firstName,
        last_name: lastName
      });
      setIsSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSecuritySubmit = async (e) => {
    e.preventDefault();
    if (!isPasswordValid || !currentPassword) return;

    setIsLoading(true);
    setError(null);
    try {
      await changePassword(currentPassword, newPassword);
      setIsSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to change password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setCurrentPassword("");
      setNewPassword("");
      setError(null);
      setIsSuccess(false);
      setActiveTab("profile");
    }, 300); // clear state after exit animation
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-[2rem] border-cartoon shadow-neubrutalism overflow-hidden relative"
          >
            {/* Header / Tabs */}
            <div className="bg-slate-50 border-b-2 border-slate-200 px-6 pt-6 pb-0 flex items-end justify-between relative">
              <div className="flex gap-4">
                <button
                  onClick={() => { setActiveTab("profile"); setError(null); }}
                  className={`pb-4 px-2 font-bold text-lg cursor-pointer transition-colors border-b-4 relative top-[2px] ${activeTab === "profile" ? "border-slate-800 text-slate-800" : "border-transparent text-slate-400 hover:text-slate-600"}`}
                >
                  Profile
                </button>
                <button
                  onClick={() => { setActiveTab("security"); setError(null); }}
                  className={`pb-4 px-2 font-bold text-lg cursor-pointer transition-colors border-b-4 relative top-[2px] ${activeTab === "security" ? "border-slate-800 text-slate-800" : "border-transparent text-slate-400 hover:text-slate-600"}`}
                >
                  Security
                </button>
              </div>
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 bg-slate-200 hover:bg-slate-300 rounded-full transition-colors z-10"
              >
                <X size={20} className="text-slate-600" />
              </button>
            </div>

            <div className="p-6">
              {isSuccess ? (
                <div className="flex flex-col items-center justify-center text-center py-8">
                  <div className="w-20 h-20 bg-pastel-mint rounded-full flex items-center justify-center mb-6 border-cartoon shadow-neubrutalism-sm rotate-[-5deg]">
                    <CheckCircle2 size={40} className="text-slate-800" />
                  </div>
                  <h2 className="text-2xl font-heading text-slate-800 mb-2">Success!</h2>
                  <p className="text-slate-600 font-medium">Your changes have been saved.</p>
                </div>
              ) : (
                <>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 mb-4 rounded-xl border-2 font-semibold text-sm bg-red-100 border-red-400 text-red-800"
                    >
                      {error}
                    </motion.div>
                  )}

                  {activeTab === "profile" ? (
                    <motion.form
                      key="profile-form"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      onSubmit={handleProfileSubmit}
                      className="flex flex-col gap-4"
                    >
                      <div className="flex gap-4">
                        <div className="floating-label relative">
                          <input
                            type="text"
                            required
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="w-full px-4 py-3 rounded-2xl border-2 border-slate-300 focus:border-slate-800 focus:ring-0 outline-none transition-colors bg-slate-50 font-medium placeholder-shown:text-slate-400"
                            placeholder=" "
                          />
                          <label className="text-slate-500">First Name</label>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="floating-label relative">
                          <input
                            type="text"
                            required
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="w-full px-4 py-3 rounded-2xl border-2 border-slate-300 focus:border-slate-800 focus:ring-0 outline-none transition-colors bg-slate-50 font-medium placeholder-shown:text-slate-400"
                            placeholder=" "
                          />
                          <label className="text-slate-500">Last Name</label>
                        </div>
                      </div>

                      <div className="floating-label relative">
                        <input
                          type="text"
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full px-4 py-3 rounded-2xl border-2 border-slate-300 focus:border-slate-800 focus:ring-0 outline-none transition-colors bg-slate-50 font-medium placeholder-shown:text-slate-400"
                          placeholder=" "
                        />
                        <label className="text-slate-500">Username</label>
                      </div>
                    </motion.form>
                  ) : (
                    <motion.form
                      key="security-form"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      onSubmit={handleSecuritySubmit}
                      className="flex flex-col gap-4"
                    >
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-bold text-slate-700 ml-2">Current Password</label>
                        <div className="floating-label relative">
                          <input
                            type={showCurrentPassword ? "text" : "password"}
                            required
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full px-4 py-3 pr-12 rounded-2xl border-2 border-slate-300 focus:border-slate-800 focus:ring-0 outline-none transition-colors bg-slate-50 font-medium placeholder-shown:text-slate-400"
                            placeholder=" "
                          />
                          <label className="text-slate-500">Current Password</label>
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="password-toggle-btn"
                            aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                          >
                            {showCurrentPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-bold text-slate-700 ml-2">New Password</label>
                        <div className="floating-label relative">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-3 pr-12 rounded-2xl border-2 border-slate-300 focus:border-slate-800 focus:ring-0 outline-none transition-colors bg-slate-50 font-medium placeholder-shown:text-slate-400"
                            placeholder=" "
                          />
                          <label className="text-slate-500">New Password</label>
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="password-toggle-btn"
                            aria-label={showNewPassword ? "Hide password" : "Show password"}
                          >
                            {showNewPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>

                      <motion.button
                        type="submit"
                        disabled={isLoading || !isPasswordValid || !currentPassword}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-full py-3.5 mt-2 bg-slate-800 rounded-2xl border-cartoon shadow-neubrutalism-sm font-bold text-white hover:bg-slate-700 transition-colors disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                            "Saving..."
                          </>
                        ) : (
                          "Update Password"
                        )}
                      </motion.button>
                    </motion.form>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}