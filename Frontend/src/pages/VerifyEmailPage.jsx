import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { CheckCircle, XCircle, Loader } from "lucide-react";
import { motion } from "framer-motion";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { verifyEmail } = useAuthStore();
  const navigate = useNavigate();

  const [status, setStatus] = useState("loading"); // loading, success, error
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Invalid or missing token.");
      return;
    }

    const verify = async () => {
      try {
        await verifyEmail(token);
        setStatus("success");
      } catch (error) {
        setStatus("error");
        setErrorMessage(error.response?.data?.detail || "Verification failed. The link might be expired.");
      }
    };
    verify();
  }, [token, verifyEmail]);

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-8 rounded-[2.5rem] border-cartoon shadow-neubrutalism text-center"
      >
        {status === "loading" && (
          <div className="flex flex-col items-center">
            <Loader size={48} className="text-slate-400 animate-spin mb-4" />
            <h2 className="text-2xl font-heading text-slate-800 mb-2">Verifying Email...</h2>
            <p className="text-slate-500 font-medium">Please wait a moment while we verify your account.</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 border-cartoon shadow-neubrutalism-sm">
              <CheckCircle size={40} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-heading text-slate-800 mb-2">Email Verified!</h2>
            <p className="text-slate-500 font-medium mb-8">
              Your account has been successfully verified. You can now log in and start chatting with videos.
            </p>
            <Link 
              to="/login"
              className="w-full py-4 bg-pastel-mint rounded-2xl border-cartoon shadow-neubrutalism-sm font-bold text-lg text-slate-800 hover:bg-[#86efac] transition-colors inline-block"
            >
              Go to Login
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6 border-cartoon shadow-neubrutalism-sm">
              <XCircle size={40} className="text-red-600" />
            </div>
            <h2 className="text-2xl font-heading text-slate-800 mb-2">Verification Failed</h2>
            <p className="text-red-500 font-bold mb-8">
              {errorMessage}
            </p>
            <Link 
              to="/login?tab=signup"
              className="w-full py-4 bg-pastel-yellow rounded-2xl border-cartoon shadow-neubrutalism-sm font-bold text-lg text-slate-800 hover:bg-[#fde047] transition-colors inline-block"
            >
              Try Signing Up Again
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
