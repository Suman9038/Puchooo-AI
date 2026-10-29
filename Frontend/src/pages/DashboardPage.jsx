import React, { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useVideoStore } from "../store/useVideoStore";
import { useChatStore } from "../store/useChatStore";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { Search, Loader2, PlaySquare, MessageSquare, ArrowRight, Sparkles } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { videos, fetchVideos, isProcessing, error: videoError } = useVideoStore();
  const { conversations, myVideos, fetchConversations, fetchMyVideos, createConversation, isFetchingVideos } = useChatStore();
  
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [activeProcessUrl, setActiveProcessUrl] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchVideos();
    fetchConversations();
    fetchMyVideos();

    // Extension Auto-Detect YouTube URL
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0]?.url;
        if (url && url.includes("youtube.com/watch")) {
          setYoutubeUrl(url);
          handleProcessVideo(url);
        }
      });
    }
  }, [fetchVideos, fetchConversations, fetchMyVideos]);

  const extractYoutubeId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleProcessVideo = async (url) => {
    if (!url) return;
    
    const videoId = extractYoutubeId(url);
    if (videoId) {
      const existingConv = conversations?.find(
        c => c.video?.youtube_video_id === videoId
      );
      if (existingConv) {
        navigate(`/chat/${existingConv.id}`);
        return;
      }
    }

    setActiveProcessUrl(url);
    try {
      const conv = await createConversation(url);
      if (conv && conv.conversation_id) {
        navigate(`/chat/${conv.conversation_id}`);
      }
    } catch (err) {
      console.error("Failed to start chat", err);
    } finally {
      setActiveProcessUrl(null);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const springBounce = {
    type: "spring", stiffness: 400, damping: 15, bounce: 0.6
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.9 },
    show: { opacity: 1, y: 0, scale: 1, transition: springBounce }
  };

  return (
    <div className="w-full flex flex-col gap-12 relative min-h-screen bg-pastel-blue">
      
      {/* Background Cartoon Polka Dots */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(var(--border-color-cartoon) 3px, transparent 3px)',
          backgroundSize: '40px 40px',
        }}
      >
        <motion.div 
          animate={{ backgroundPosition: ['0px 0px', '40px 40px'] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundImage: 'radial-gradient(var(--border-color-cartoon) 3px, transparent 3px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative z-10 w-full flex flex-col gap-12 p-4">
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20, rotate: -5 }}
          animate={{ opacity: 1, y: 0, rotate: -2 }}
          transition={springBounce}
          className="flex flex-col items-center text-center mt-12 transform -rotate-2"
        >
          <div className="inline-flex items-center justify-center p-3 px-6 bg-pastel-yellow border-cartoon shadow-neubrutalism-sm rounded-full mb-6">
             <Sparkles className="text-slate-900 mr-2" size={24}/>
             <span className="font-black text-slate-900 uppercase tracking-wider">Dashboard</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-heading font-black text-slate-900 mb-6 tracking-tight px-2">
            Welcome back, {user?.first_name || user?.username}!
          </h1>
          <p className="text-base sm:text-xl text-slate-800 font-bold max-w-lg bg-white border-cartoon shadow-neubrutalism-sm rounded-2xl p-4 transform rotate-2 mx-2">
            Ready to dive into a new topic? Drop a YouTube link below and let's start learning.
          </p>
        </motion.div>

        {/* Minimalist Magic Search Bar -> Cartoon Search Bar */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={springBounce}
          className="max-w-3xl w-full mx-auto"
        >
          <form 
            onSubmit={(e) => { e.preventDefault(); handleProcessVideo(youtubeUrl); }} 
            className="relative flex flex-col sm:block items-center group px-2 sm:px-0"
          >
            <div className="relative w-full">
              <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-slate-900">
                <Search size={24} strokeWidth={3} className="sm:w-7 sm:h-7" />
              </div>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                required
                placeholder="Paste YouTube link..."
                className="w-full py-4 sm:py-6 pl-12 sm:pl-16 pr-4 sm:pr-44 bg-white border-cartoon shadow-neubrutalism rounded-2xl sm:rounded-[2rem] text-base sm:text-xl font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-pastel-peach focus:-translate-y-1 focus:shadow-neubrutalism-hover transition-all placeholder:text-slate-400"
              />
            </div>
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full sm:w-auto mt-4 sm:mt-0 sm:absolute sm:right-3 sm:top-2 sm:bottom-2 bg-pastel-mint border-cartoon text-slate-900 font-black py-4 px-8 rounded-2xl sm:rounded-full shadow-neubrutalism hover:bg-pastel-yellow hover:-translate-y-1 hover:shadow-neubrutalism-hover active:translate-y-0 active:shadow-neubrutalism-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-base sm:text-lg"
            >
              {(isProcessing && activeProcessUrl === youtubeUrl) ? <Loader2 className="animate-spin sm:w-6 sm:h-6" size={20} /> : "Process"}
              <ArrowRight size={20} strokeWidth={3} />
            </button>
          </form>
          {videoError && <p className="text-white bg-red-500 font-bold mt-6 text-center border-cartoon shadow-neubrutalism-sm p-3 rounded-xl">{videoError}</p>}
        </motion.div>

        {/* Bento Grid layout */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col w-full max-w-4xl mx-auto mt-4"
        >
          {/* Your Chats */}
          <motion.div variants={itemVariants} className="flex flex-col gap-6 bg-white border-cartoon shadow-neubrutalism rounded-3xl p-6 md:p-8">
            <div className="flex items-center gap-4 border-b-cartoon pb-4 mb-2">
              <div className="p-3 bg-pastel-lavender border-cartoon shadow-neubrutalism-sm rounded-full transform -rotate-6">
                <PlaySquare className="text-slate-900" size={32} />
              </div>
              <h2 className="text-3xl font-heading font-black text-slate-900 tracking-tight">Your Videos</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {isFetchingVideos ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <motion.div
                    key={`skeleton-${idx}`}
                    variants={itemVariants}
                    className="card-cartoon flex flex-col p-4 gap-4 bg-white opacity-90"
                  >
                    <div className="w-full h-48 bg-slate-200 border-cartoon rounded-xl overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer" />
                    </div>

                    <div className="flex flex-col flex-grow justify-between gap-6 px-2 pb-2">
                      <div className="flex flex-col gap-2">
                        <div className="h-6 bg-slate-200 rounded-md w-3/4 relative overflow-hidden">
                           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer" />
                        </div>
                        <div className="h-6 bg-slate-200 rounded-md w-1/2 relative overflow-hidden">
                           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer" />
                        </div>
                      </div>

                      <div className="w-full h-14 bg-slate-200 border-cartoon rounded-xl relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer" />
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (!myVideos || myVideos.length === 0) ? (
                <div className="empty-state-card">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border-cartoon shadow-neubrutalism-sm">
                      <PlaySquare size={32} className="text-slate-800" />
                    </div>
                    <span>No videos processed yet</span>
                    <span className="text-sm font-medium">Paste a YouTube link above to get started!</span>
                  </div>
                </div>
              ) : (
                myVideos.map((video) => (
                  <motion.div 
                    key={video.id}
                    variants={itemVariants}
                    className="card-cartoon flex flex-col p-4 gap-4 group cursor-pointer bg-white"
                  >
                    <div className="w-full h-48 bg-slate-200 border-cartoon rounded-xl overflow-hidden relative">
                      <img 
                        src={`https://img.youtube.com/vi/${video.youtube_video_id}/maxresdefault.jpg`}
                        onError={(e) => { e.target.src = `https://img.youtube.com/vi/${video.youtube_video_id}/mqdefault.jpg` }}
                        alt="Thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    <div className="flex flex-col flex-grow justify-between gap-6 px-2 pb-2">
                      <div className="flex flex-col gap-2">
                        <h3 className="font-black text-slate-900 text-xl line-clamp-2 leading-tight" title={video.title}>
                          {video.title}
                        </h3>
                      </div>
                      
                      <button 
                        onClick={() => {
                          const existingConv = conversations?.find(c => c.video?.id === video.id);
                          if (existingConv) {
                            navigate(`/chat/${existingConv.id}`);
                          } else {
                            navigate(`/chat?video_id=${video.id}`);
                          }
                        }}
                        className="w-full py-4 bg-pastel-peach border-cartoon text-slate-900 font-black rounded-xl shadow-neubrutalism-sm hover:bg-pastel-yellow hover:-translate-y-1 hover:shadow-neubrutalism-hover active:translate-y-0 active:shadow-neubrutalism-sm transition-all flex items-center justify-center gap-3 text-lg"
                      >
                        <MessageSquare size={24} />
                        Open Chats
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
