import React, { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useChatStore } from "../store/useChatStore";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft, Loader2, Bot, User, MessageSquare, Trash2, AlertTriangle, Cpu, Play, Lightbulb } from "lucide-react";
import { cn, isExtension } from "../lib/utils";
import ReactMarkdown from "react-markdown";

/**
 * Extracts timestamp in seconds from any URL or string.
 * Supports:
 *  - URL parameters: t=125, t=125s, start=125, t=1h2m3s, t=2m15s
 *  - String patterns: 02:05, 1:02:05, [02:05], 125s, etc.
 */
const extractTimestampFromUrl = (url) => {
  if (!url) return null;
  const match = url.match(/[?&#](?:t|start)=([0-9hms]+)/i);
  if (match) {
    const val = match[1];
    let total = 0;
    if (/[hms]/i.test(val)) {
      const h = val.match(/(\d+)h/i);
      const m = val.match(/(\d+)m/i);
      const s = val.match(/(\d+)s/i);
      if (h) total += parseInt(h[1], 10) * 3600;
      if (m) total += parseInt(m[1], 10) * 60;
      if (s) total += parseInt(s[1], 10);
      return total;
    }
    const num = parseInt(val.replace(/\D/g, ""), 10);
    return isNaN(num) ? null : num;
  }
  return null;
};

const extractTimestampFromText = (text) => {
  if (!text) return null;
  const str = String(text).trim();
  const timeMatch = str.match(/(?:(\d{1,2}):)?(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hours = timeMatch[1] ? parseInt(timeMatch[1], 10) : 0;
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = parseInt(timeMatch[3], 10);
    return hours * 3600 + minutes * 60 + seconds;
  }
  const secMatch = str.match(/(\d+(?:\.\d+)?)s/i);
  if (secMatch) {
    return Math.floor(parseFloat(secMatch[1]));
  }
  return null;
};

/**
 * Converts timestamps in LLM text into clickable links if not already wrapped in markdown links.
 */
const processTimestamps = (text, videoId) => {
  if (!text) return "";
  const vid = videoId || "";
  
  // 1. Match [HH:MM:SS] or [MM:SS] NOT followed by (
  let result = text.replace(
    /\[((?:(\d{1,2}):)?(\d{1,2}):(\d{2}))\](?!\()/g,
    (match, time, h, m, s) => {
      const hours = h ? parseInt(h, 10) : 0;
      const minutes = parseInt(m, 10);
      const seconds = parseInt(s, 10);
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;
      return `[${time}](https://www.youtube.com/watch?v=${vid}&t=${totalSeconds}s)`;
    }
  );

  // 2. Match [125s] or [125.0s] NOT followed by (
  result = result.replace(
    /\[(\d+(?:\.\d+)?)s\](?!\()/g,
    (match, secStr) => {
      const totalSeconds = Math.floor(parseFloat(secStr));
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      return `[${formatted}](https://www.youtube.com/watch?v=${vid}&t=${totalSeconds}s)`;
    }
  );

  return result;
};

export default function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeConversation, loadConversation, sendMessage, deleteConversation, createConversation, isAsking, isLoading, error, conversations, pollConversationStatus } = useChatStore();
  const [question, setQuestion] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const messagesEndRef = useRef(null);
  const [seekTime, setSeekTime] = useState(null);
  const [activeTimestampBadge, setActiveTimestampBadge] = useState(null);
  const iframeRef = useRef(null);

  const handleSeek = (seconds, label = null) => {
    setSeekTime(seconds);
    if (label) {
      setActiveTimestampBadge(label);
    } else {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      setActiveTimestampBadge(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }

    // Send postMessage command to YouTube iframe to seek & play smoothly
    const iframe = iframeRef.current;
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: "seekTo",
            args: [seconds, true]
          }),
          "*"
        );
        iframe.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: "playVideo",
            args: []
          }),
          "*"
        );
      } catch (err) {
        console.warn("postMessage seek error:", err);
      }
    }

    // Smooth scroll video player into view on mobile
    if (typeof window !== "undefined" && window.innerWidth < 1024 && iframe) {
      iframe.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  useEffect(() => {
    if (id) loadConversation(id);
  }, [id, loadConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isAsking ? "auto" : "smooth" });
  }, [activeConversation?.messages, isAsking]);

  useEffect(() => {
    let intervalId;
    if (activeConversation?.video && (activeConversation.video.status === "PENDING" || activeConversation.video.status === "PROCESSING")) {
      intervalId = setInterval(() => {
        pollConversationStatus(activeConversation.video.id, activeConversation.id);
      }, 5000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeConversation?.video?.status, activeConversation?.video?.id, activeConversation?.id, pollConversationStatus]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!question.trim() || isAsking) return;
    
    const q = question;
    setQuestion("");
    await sendMessage(id, q);
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [chatToDelete, setChatToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = (chatId) => {
    setChatToDelete(chatId);
    setShowDeleteModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-pastel-mint" size={48} />
          <p className="text-xl font-heading text-slate-600 font-bold">Setting up your study desk...</p>
        </div>
      </div>
    );
  }

  if (error || !activeConversation) {
    return (
      <div className="flex h-[70vh] items-center justify-center flex-col gap-6">
        <p className="text-xl font-bold text-red-500 bg-red-100 p-4 rounded-3xl border-cartoon shadow-sm">{error || "Conversation not found."}</p>
        <Link to="/dashboard">
          <button className="px-6 py-3 bg-white border-cartoon rounded-2xl font-bold shadow-neubrutalism hover:bg-slate-50 transition-colors">
            Back to Dashboard
          </button>
        </Link>
      </div>
    );
  }

  const { video } = activeConversation;

  return (
    <div className="h-[85vh] w-full flex flex-col lg:flex-row gap-6 mt-4 pb-4 px-2">
      
      {/* Left Sidebar: Recent Chats (Hidden on small screens) */}
      <div className="hidden lg:flex w-1/4 h-full flex-col gap-4 bg-pastel-yellow rounded-3xl p-4 border-cartoon shadow-neubrutalism">
        <Link to="/dashboard" className="self-start mb-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border-cartoon shadow-neubrutalism-sm font-black text-sm text-slate-900 hover:bg-slate-100 hover:-translate-y-1 transition-all active:translate-y-0">
            <ArrowLeft size={16} strokeWidth={3} /> Dashboard
          </button>
        </Link>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <MessageSquare size={24} className="text-slate-900" />
            <h2 className="font-heading font-black text-xl text-slate-900">Recent Chats</h2>
          </div>
          <button 
            disabled={isCreatingNew}
            onClick={() => setShowNewChatModal(true)}
            className="px-4 py-2 bg-pastel-peach text-slate-900 border-cartoon shadow-neubrutalism-sm hover:bg-pastel-lavender rounded-full font-black text-sm hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-50"
            title="Create a new study session for this video"
          >
            + New
          </button>
        </div>
        <div className="flex flex-col gap-3 overflow-y-auto pr-1" data-lenis-prevent>
          {(() => {
            const sidebarConversations = conversations?.filter(c => c.video?.id === video?.id) || [];
            if (sidebarConversations.length === 0) {
              return <p className="text-sm text-slate-500 p-2">No other chats found.</p>;
            }
            return sidebarConversations.map(chat => (
              <div 
                key={chat.id}
                className={`p-3 rounded-2xl cursor-pointer transition-all border-cartoon flex items-center justify-between group/item hover:-translate-y-1 active:translate-y-0 ${
                  chat.id === id 
                    ? 'bg-pastel-mint shadow-neubrutalism-sm' 
                    : 'bg-white shadow-sm hover:shadow-neubrutalism-sm'
                }`}
              >
                <div onClick={() => navigate(`/chat/${chat.id}`)} className="flex-grow min-w-0 pr-2">
                  <p className="font-bold text-slate-700 text-sm line-clamp-2 leading-tight">
                    {chat.title || "New Study Session"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(chat.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button 
                  onClick={() => confirmDelete(chat.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg lg:opacity-0 group-hover/item:opacity-100 transition-opacity"
                  title="Delete Conversation"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Middle Panel: Video Player (Hidden in Extension) */}
      {!isExtension && (
        <div className="w-full lg:w-1/3 h-full flex flex-col gap-4">
        
        <div className="flex-grow bg-white border-cartoon rounded-3xl shadow-neubrutalism overflow-hidden flex flex-col">
          {/* Mac-style Window Header */}
          <div className="w-full bg-slate-100 p-3 border-b border-slate-200 flex gap-2 items-center">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
          </div>
          <div className="w-full aspect-video bg-black relative">
            <iframe 
              ref={iframeRef}
              key={seekTime}
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${video?.youtube_video_id || ''}?enablejsapi=1${seekTime !== null ? `&start=${seekTime}&autoplay=1` : ''}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
            {activeTimestampBadge && (
              <div className="absolute top-3 right-3 z-10 px-3 py-1 bg-slate-900/85 backdrop-blur-sm text-pastel-mint border border-pastel-mint/40 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-pastel-mint animate-pulse" />
                Playing at {activeTimestampBadge}
              </div>
            )}
          </div>
          <div className="p-6 flex-grow flex flex-col gap-3 overflow-y-auto" data-lenis-prevent>
            <div className="inline-block px-3 py-1 bg-pastel-mint/30 rounded-full text-xs font-bold text-green-700 uppercase tracking-wider self-start">
              {video.status}
            </div>
            <h2 className="text-lg font-heading font-black text-slate-800 leading-snug">{video.title}</h2>
          </div>
        </div>
        </div>
      )}

      {/* Right Panel: Chat Interface */}
      <div className="w-full lg:flex-1 h-full flex flex-col bg-white border-cartoon rounded-3xl shadow-neubrutalism overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b-cartoon bg-pastel-blue flex items-center gap-3 z-10">
          {/* Mobile/Extension Back Button */}
          <div className="lg:hidden mr-1">
            <Link to="/dashboard" className="p-2 bg-white rounded-xl border-cartoon shadow-neubrutalism-sm text-slate-800 flex items-center justify-center hover:bg-slate-100 transition-colors">
              <ArrowLeft size={18} strokeWidth={3} />
            </Link>
          </div>
          
          <div className="w-12 h-12 bg-pastel-yellow border-cartoon shadow-neubrutalism-sm rounded-full flex items-center justify-center hidden sm:flex">
            <Bot size={28} className="text-slate-900" />
          </div>
          <div>
            <h3 className="font-heading font-black text-lg text-slate-800">Study Buddy</h3>
            <div className="flex items-center gap-2">
              {video?.status === "READY" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <p className="text-xs font-bold text-slate-400">Online & Ready to help!</p>
                </>
              ) : video?.status === "FAILED" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <p className="text-xs font-bold text-slate-400">Processing Failed</p>
                </>
              ) : (
                <>
                  <Loader2 className="w-3 h-3 text-yellow-600 animate-spin" />
                  <p className="text-xs font-bold text-yellow-600">Processing video...</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-grow p-4 md:p-6 overflow-y-auto flex flex-col gap-6 bg-[#FDFBF7]" data-lenis-prevent>
          <AnimatePresence>
            {activeConversation.messages?.length === 0 && (
              <div className="m-auto flex flex-col w-full max-w-md gap-6">
                {video?.status === "READY" ? (
                   <motion.div 
                     initial={{ scale: 0.9, opacity: 0 }}
                     animate={{ scale: 1, opacity: 1 }}
                     transition={{ type: "spring", stiffness: 400, damping: 15 }}
                     className="text-center p-10 bg-white border-cartoon shadow-neubrutalism rounded-[2.5rem]"
                   >
                     <div className="w-20 h-20 bg-pastel-mint rounded-full flex items-center justify-center mx-auto mb-6 border-cartoon shadow-neubrutalism-sm">
                       <Bot size={40} strokeWidth={2.5} className="text-slate-900"/>
                     </div>
                     <h4 className="font-black font-heading text-2xl text-slate-900 mb-4 tracking-tight">I've watched the video!</h4>
                     <p className="text-base text-slate-600 font-bold leading-relaxed">Ask me anything about it—summaries, specific concepts, or step-by-step explanations.</p>
                   </motion.div>
                ) : video?.status === "FAILED" ? (
                   <motion.div 
                     initial={{ scale: 0.9, opacity: 0 }}
                     animate={{ scale: 1, opacity: 1 }}
                     transition={{ type: "spring", stiffness: 400, damping: 15 }}
                     className="text-center p-8 bg-red-50 border-cartoon shadow-neubrutalism rounded-[2.5rem]"
                   >
                     <div className="w-20 h-20 bg-red-400 rounded-full flex items-center justify-center mx-auto mb-6 border-cartoon shadow-neubrutalism-sm">
                       <AlertTriangle size={40} strokeWidth={2.5} className="text-slate-900"/>
                     </div>
                     <h4 className="font-black font-heading text-2xl text-slate-900 mb-4 tracking-tight">Processing Failed</h4>
                     <p className="text-base text-slate-600 font-bold leading-relaxed mb-6">Something went wrong while processing the video. It might be too long or lack subtitles.</p>
                     
                     <div className="p-4 bg-white rounded-xl border-cartoon shadow-neubrutalism-sm text-left">
                        <div className="flex items-center gap-2 mb-2">
                           <Bot size={16} className="text-slate-900" />
                           <span className="font-bold text-sm text-slate-900">What you can do:</span>
                        </div>
                        <ul className="text-sm text-slate-600 font-medium list-disc list-inside space-y-1">
                          <li>Check if the video has English captions.</li>
                          <li>Ensure the video is public.</li>
                          <li>Delete this and try submitting again.</li>
                        </ul>
                     </div>
                   </motion.div>
                ) : (
                   <motion.div 
                     initial={{ scale: 0.9, opacity: 0 }}
                     animate={{ scale: 1, opacity: 1 }}
                     transition={{ type: "spring", stiffness: 400, damping: 15 }}
                     className="relative text-center p-8 bg-pastel-yellow border-cartoon shadow-neubrutalism rounded-[2.5rem] overflow-hidden"
                   >
                     {/* Shimmer overlay */}
                     <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                     
                     <div className="relative z-10">
                       <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 border-cartoon shadow-neubrutalism-sm">
                         <Loader2 size={32} strokeWidth={3} className="text-slate-900 animate-spin"/>
                       </div>
                       <h4 className="font-black font-heading text-2xl text-slate-900 mb-6 tracking-tight">Analyzing Video...</h4>
                       
                       <div className="flex flex-col gap-4 text-left bg-white/50 p-5 border-cartoon shadow-neubrutalism-sm rounded-2xl relative z-10">
                          <div className="flex items-center gap-3">
                             <div className="w-3 h-3 rounded-full bg-pastel-mint animate-pulse" />
                             <span className="font-bold text-slate-800">Fetching transcript</span>
                          </div>
                          <div className="flex items-center gap-3">
                             <div className="w-3 h-3 rounded-full bg-pastel-mint animate-pulse" style={{ animationDelay: '200ms' }} />
                             <span className="font-bold text-slate-800">Extracting key concepts</span>
                          </div>
                          <div className="flex items-center gap-3">
                             <div className="w-3 h-3 rounded-full bg-pastel-mint animate-pulse" style={{ animationDelay: '400ms' }} />
                             <span className="font-bold text-slate-800">Building knowledge base</span>
                          </div>
                       </div>
                       
                       <div className="mt-6 bg-slate-900/5 rounded-xl p-3 border border-slate-900/10 relative z-10">
                          <p className="text-xs font-bold text-slate-600 leading-relaxed">
                            <Lightbulb size={14} className="text-amber-500 inline mr-1 shrink-0" />
                            <strong>Tip:</strong> Longer videos take a bit more time to fetch transcripts and generate the knowledge base. Please wait!
                          </p>
                       </div>
                     </div>
                   </motion.div>
                )}
              </div>
            )}
            
            {activeConversation.messages?.map((msg) => {
              if (msg.role?.toLowerCase() === "assistant" && msg.content === "" && isAsking) {
                return (
                  <motion.div
                    key={`typing-${msg.id}`}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4 w-full justify-start"
                  >
                    <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-pastel-yellow border-cartoon shadow-neubrutalism-sm mt-1 z-10">
                      <Bot size={20} strokeWidth={2.5} className="text-slate-900" />
                    </div>
                    <div className="py-3 flex gap-1.5 items-center h-[40px]">
                      <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-2 h-2 bg-slate-400 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-slate-400 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-slate-400 rounded-full" />
                    </div>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex gap-4 min-w-0 w-full ${msg.role?.toLowerCase() === "user" ? "justify-end" : "justify-start"}`}
                >
                  {/* Assistant Avatar */}
                  {msg.role?.toLowerCase() === "assistant" && (
                    <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-pastel-yellow border-cartoon shadow-neubrutalism-sm mt-1 z-10">
                      <Bot size={20} strokeWidth={2.5} className="text-slate-900"/>
                    </div>
                  )}
                  
                  {/* Message Bubble Column */}
                  <div className={`flex flex-col gap-1 min-w-0 ${msg.role?.toLowerCase() === "user" ? "max-w-[85%]" : "max-w-[90%]"}`}>
                    <div className={`min-w-0 break-words ${
                      msg.role?.toLowerCase() === "user" 
                        ? "px-5 py-4 shadow-neubrutalism-sm bg-pastel-peach text-slate-900 font-bold border-cartoon rounded-3xl rounded-tr-sm" 
                        : "py-2 px-5 w-full bg-slate-50 border-cartoon shadow-neubrutalism-sm rounded-3xl rounded-tl-sm text-slate-900 overflow-x-auto prose prose-slate prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:text-slate-50 prose-pre:border-cartoon prose-pre:rounded-xl prose-code:text-[#9333ea] prose-code:bg-[#9333ea]/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-mono prose-code:before:content-none prose-code:after:content-none prose-headings:font-heading prose-headings:font-black prose-a:text-[#9333ea]"
                    }`} data-lenis-prevent>
                      {msg.role?.toLowerCase() === "user" ? (
                        <p className="font-medium whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <ReactMarkdown
                          components={{
                            a: ({ href, children, ...props }) => {
                              const timeFromUrl = extractTimestampFromUrl(href);
                              const timeFromText = extractTimestampFromText(children);
                              const targetSeconds = timeFromUrl !== null ? timeFromUrl : timeFromText;
                              
                              // Check if this is a YouTube link or timestamp link
                              const isYt = href && (href.includes("youtube.com") || href.includes("youtu.be"));
                              
                              if (targetSeconds !== null || isYt) {
                                const finalSec = targetSeconds !== null ? targetSeconds : 0;
                                const displayLabel = typeof children === "string" ? children : `${Math.floor(finalSec / 60)}:${(finalSec % 60).toString().padStart(2, '0')}`;
                                
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleSeek(finalSec, displayLabel);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mx-1 my-0.5 bg-pastel-mint/50 hover:bg-pastel-mint text-slate-900 border border-slate-900/40 hover:border-slate-900 rounded-full text-xs font-mono font-bold shadow-neubrutalism-sm hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer select-none"
                                    title={`Play in video player at ${displayLabel}`}
                                  >
                                    <Play size={10} className="fill-slate-800 text-slate-800" />
                                    <span>{children}</span>
                                  </button>
                                );
                              }

                              // Regular external links open in new tab
                              return (
                                <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                                  {children}
                                </a>
                              );
                            }
                          }}
                        >
                          {processTimestamps(msg.content, video?.youtube_video_id)}
                        </ReactMarkdown>
                      )}
                    </div>

                    {/* Model Indicator for Assistant */}
                    {msg.role?.toLowerCase() === "assistant" && msg.content && (
                      <div className="flex items-center gap-1.5 px-2.5 py-0.5 self-start text-[11px] font-mono font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-full">
                        <Cpu size={12} className="text-purple-600" />
                        <span>{msg.model || "GPT-OSS 120B (Groq)"}</span>
                      </div>
                    )}
                  </div>

                  {/* User Avatar */}
                  {msg.role?.toLowerCase() === "user" && (
                    <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-pastel-mint border-cartoon shadow-neubrutalism-sm mt-1 z-10">
                      <User size={20} strokeWidth={3} className="text-slate-900"/>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t-cartoon bg-white z-10 relative">
          {video?.status !== "READY" && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
               <div className="px-5 py-2.5 bg-slate-900 text-pastel-yellow font-black rounded-full border-cartoon text-sm flex items-center gap-3 shadow-neubrutalism-sm">
                 <Loader2 size={18} className="animate-spin" /> Processing Video...
               </div>
            </div>
          )}
          <form onSubmit={handleSend} className="relative flex items-center">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={video?.status !== "READY"}
              placeholder={video?.status === "READY" ? "Ask anything..." : "Waiting for video to be processed..."}
              className="w-full py-4 pl-6 pr-16 bg-white border-cartoon shadow-neubrutalism-sm rounded-full font-bold text-lg text-slate-900 focus:outline-none focus:ring-4 focus:ring-pastel-peach focus:-translate-y-1 focus:shadow-neubrutalism transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <motion.button
              type="submit"
              disabled={isAsking || !question.trim() || video?.status !== "READY"}
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              className="absolute right-2 p-3 bg-pastel-mint border-cartoon rounded-full text-slate-900 font-black shadow-neubrutalism-sm disabled:opacity-50 transition-all hover:bg-pastel-yellow"
            >
              <Send size={24} strokeWidth={3} />
            </motion.button>
          </form>
        </div>
      </div>

      {/* Custom New Chat Confirmation Modal */}
      <AnimatePresence>
        {showNewChatModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewChatModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-full max-w-sm bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-6 z-10 flex flex-col gap-4 text-center"
            >
              <div className="w-16 h-16 bg-[#9333ea]/10 text-[#9333ea] rounded-full flex items-center justify-center mx-auto shadow-inner">
                <MessageSquare size={28} />
              </div>
              <div>
                <h3 className="font-heading font-black text-xl text-slate-800">New Study Session</h3>
                <p className="text-sm text-slate-500 font-medium mt-2">
                  Start a fresh chat session for this video?
                </p>
              </div>
              <div className="flex gap-3 mt-2">
                <button 
                  onClick={() => setShowNewChatModal(false)}
                  className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-xl border border-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  disabled={isCreatingNew}
                  onClick={async () => {
                    setIsCreatingNew(true);
                    try {
                      const conv = await createConversation(`https://youtube.com/watch?v=${video.youtube_video_id}`);
                      setShowNewChatModal(false);
                      if (conv && conv.conversation_id) {
                        navigate(`/chat/${conv.conversation_id}`);
                      }
                    } catch (err) {
                      alert(err.response?.data?.detail || "Failed to start a new chat session.");
                    } finally {
                      setIsCreatingNew(false);
                    }
                  }}
                  className="flex-1 py-3 bg-[#9333ea] hover:bg-[#7e22ce] text-white font-bold rounded-xl shadow-md shadow-[#9333ea]/20 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {isCreatingNew ? "Creating..." : "Start Chat"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            {/* Modal Box */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-full max-w-sm bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-6 z-10 flex flex-col gap-4 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Trash2 size={28} />
              </div>
              <div>
                <h3 className="font-heading font-black text-xl text-slate-800">Delete Conversation?</h3>
                <p className="text-sm text-slate-400 font-medium mt-2">
                  Are you sure you want to delete this study session? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 mt-2">
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-xl border border-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  disabled={isDeleting}
                  onClick={async () => {
                    if (!chatToDelete) return;
                    setIsDeleting(true);
                    try {
                      await deleteConversation(chatToDelete);
                      setShowDeleteModal(false);
                      setIsDeleting(false);
                      if (chatToDelete === id) {
                        navigate("/dashboard");
                      }
                    } catch (err) {
                      setIsDeleting(false);
                      alert(err.response?.data?.detail || "Failed to delete conversation. Please try again.");
                    }
                  }}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-md shadow-red-500/20 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
