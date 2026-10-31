import React, { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useVideoStore } from "../store/useVideoStore";
import { useChatStore } from "../store/useChatStore";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, PlaySquare, MessageSquare, ArrowRight, Sparkles, Play } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { fetchVideos, isProcessing, error: videoError } = useVideoStore();
  const { conversations, myVideos, fetchConversations, fetchMyVideos, createConversation, isFetchingVideos } = useChatStore();
  
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [activeProcessUrl, setActiveProcessUrl] = useState(null);
  const navigate = useNavigate();
  const [openingVideoId, setOpeningVideoId] = useState(null);

  const getConversationsForVideo = (v) => {
    if (!conversations || conversations.length === 0) return [];
    return conversations.filter(c => 
      (c.video?.id && String(c.video.id) === String(v.id)) ||
      (c.video?.youtube_video_id && c.video.youtube_video_id === v.youtube_video_id)
    );
  };

  const handleOpenVideoChat = async (v, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const matches = getConversationsForVideo(v);
    if (matches.length > 0) {
      const sorted = [...matches].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      navigate(`/chat/${sorted[0].id}`);
      return;
    }

    setOpeningVideoId(v.id);
    try {
      const conv = await createConversation(`https://youtube.com/watch?v=${v.youtube_video_id}`);
      if (conv && conv.conversation_id) {
        navigate(`/chat/${conv.conversation_id}`);
      }
    } catch (err) {
      console.error("Failed to start chat session:", err);
    } finally {
      setOpeningVideoId(null);
    }
  };

  const extractYoutubeId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleProcessVideo = useCallback(async (url) => {
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
  }, [conversations, createConversation, navigate]);

  useEffect(() => {
    fetchConversations();
    fetchMyVideos();

    // Extension Auto-Detect YouTube URL
    if (typeof window !== "undefined" && window.chrome?.tabs?.query) {
      window.chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0]?.url;
        if (url && url.includes("youtube.com/watch")) {
          setYoutubeUrl(url);
          handleProcessVideo(url);
        }
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const springBounce = {
    type: "spring", stiffness: 300, damping: 25
  };

  const gentleTransition = {
    duration: 0.25,
    ease: "easeOut"
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: gentleTransition }
  };

  const hasVideos = Array.isArray(myVideos) && myVideos.length > 0;
  const showSkeleton = isFetchingVideos && !hasVideos;

  return (
    <div className="w-full flex-grow flex flex-col relative min-h-screen bg-pastel-blue">
      
      {/* Background Cartoon Polka Dots */}
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

      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col gap-8 sm:gap-12 px-3 sm:px-6 pt-20 sm:pt-28 pb-12">
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20, rotate: -3 }}
          animate={{ opacity: 1, y: 0, rotate: -1.5 }}
          transition={springBounce}
          className="flex flex-col items-center text-center mt-2 sm:mt-4 transform -rotate-1"
        >
          <div className="inline-flex items-center justify-center p-2.5 px-5 bg-pastel-yellow border-cartoon shadow-neubrutalism-sm rounded-full mb-4">
             <Sparkles className="text-slate-900 mr-2" size={20}/>
             <span className="font-black text-slate-900 uppercase tracking-wider text-sm">Dashboard</span>
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-heading font-black text-slate-900 mb-4 sm:mb-6 tracking-tight px-2">
            Welcome back, {user?.first_name || user?.username}!
          </h1>
          <p className="text-base sm:text-xl text-slate-800 font-bold max-w-lg bg-white border-cartoon shadow-neubrutalism-sm rounded-2xl p-3.5 sm:p-4 transform rotate-1 mx-2">
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
              {showSkeleton ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={`skeleton-${idx}`}
                    className="card-cartoon flex flex-col p-4 gap-4 bg-white opacity-90"
                  >
                    <div className="w-full aspect-video bg-slate-200 border-cartoon rounded-xl overflow-hidden relative">
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
                  </div>
                ))
              ) : !hasVideos ? (
                <div className="col-span-full w-full py-10 sm:py-14 px-4 sm:px-8 flex flex-col items-center justify-center text-center bg-pastel-yellow border-cartoon shadow-neubrutalism rounded-3xl">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center border-cartoon shadow-neubrutalism-sm mb-4 transform -rotate-3">
                    <PlaySquare size={36} className="text-slate-900" />
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-heading font-black text-slate-900 mb-2 tracking-tight">
                    No videos processed yet
                  </h3>
                  <p className="text-base sm:text-lg font-bold text-slate-700 max-w-md">
                    Paste a YouTube link above and click <span className="underline decoration-slate-900 decoration-2">Process</span> to start learning!
                  </p>
                </div>
              ) : (
                myVideos.map((video) => {
                  const matchingConvs = getConversationsForVideo(video);
                  const isOpeningThis = openingVideoId === video.id;

                  return (
                    <motion.div 
                      key={video.id}
                      initial={false}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={(e) => handleOpenVideoChat(video, e)}
                      className="card-cartoon flex flex-col p-4 gap-4 group cursor-pointer bg-white hover:-translate-y-1 transition-all"
                    >
                      <div className="w-full aspect-video bg-slate-900 border-cartoon rounded-xl overflow-hidden relative shadow-inner">
                        <img 
                          src={`https://img.youtube.com/vi/${video.youtube_video_id}/hqdefault.jpg`}
                          onError={(e) => { 
                            if (!e.target.dataset.triedFallback) {
                              e.target.dataset.triedFallback = "true";
                              e.target.src = `https://img.youtube.com/vi/${video.youtube_video_id}/mqdefault.jpg`;
                            }
                          }}
                          alt={video.title || "Video thumbnail"}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent flex items-end justify-between p-2.5">
                          <span className="px-2.5 py-1 bg-pastel-mint border border-slate-900 text-slate-900 font-bold text-xs rounded-full shadow-sm flex items-center gap-1.5">
                            <Play size={10} className="fill-slate-900 text-slate-900" />
                            <span>
                              {matchingConvs.length > 0
                                ? `${matchingConvs.length} ${matchingConvs.length === 1 ? 'Session' : 'Sessions'}`
                                : 'Ready'}
                            </span>
                          </span>
                          <span className="px-2 py-0.5 bg-black/75 backdrop-blur-sm text-white font-mono text-[10px] font-bold rounded-md">
                            YouTube
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col flex-grow justify-between gap-4 px-1 pb-1">
                        <div className="flex flex-col gap-1.5">
                          <h3 className="font-black text-slate-900 text-lg sm:text-xl line-clamp-2 leading-tight group-hover:text-purple-700 transition-colors" title={video.title}>
                            {video.title}
                          </h3>
                        </div>
                        
                        <button 
                          type="button"
                          disabled={isOpeningThis}
                          onClick={(e) => handleOpenVideoChat(video, e)}
                          className="w-full py-3.5 sm:py-4 bg-pastel-peach border-cartoon text-slate-900 font-black rounded-xl shadow-neubrutalism-sm hover:bg-pastel-yellow hover:-translate-y-0.5 hover:shadow-neubrutalism-hover active:translate-y-0 active:shadow-neubrutalism-sm transition-all flex items-center justify-center gap-2.5 text-base sm:text-lg cursor-pointer disabled:opacity-75"
                        >
                          {isOpeningThis ? (
                            <>
                              <Loader2 size={20} className="animate-spin text-slate-900" />
                              <span>Opening Session...</span>
                            </>
                          ) : (
                            <>
                              <MessageSquare size={20} />
                              <span>{matchingConvs.length > 0 ? "Continue Chat" : "Start Chat"}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
