import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useChatStore } from "../store/useChatStore";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft, Loader2, Bot, User, MessageSquare, Trash2, AlertTriangle, Cpu, Play, Lightbulb, History, X } from "lucide-react";
import { cn, isExtension, formatTime } from "../lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import VideoTimelineScrubber from "../components/VideoTimelineScrubber";

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
 * Formats LLM markdown: converts raw timestamps into playable links and repairs table spacing.
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

  // 2. Match [125s] or [125.0s] or [769.48 s] (with optional spaces before s) NOT followed by (
  result = result.replace(
    /\[(\d+(?:\.\d+)?)\s*s\](?!\()/gi,
    (match, secStr) => {
      const totalSeconds = Math.floor(parseFloat(secStr));
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      return `[${formatted}](https://www.youtube.com/watch?v=${vid}&t=${totalSeconds}s)`;
    }
  );

  // 3. Repair table rows where newline was omitted or collapsed into | |
  // e.g. "| Col A | | Col B |" -> "| Col A |\n| Col B |"
  result = result.replace(/\|\s*\|\s*(?=[-\w#1-9\u{1F300}-\u{1F9FF}:])/gu, "|\n| ");

  // 4. Ensure there is a blank line before any markdown table so GFM parser recognizes it
  // e.g. "These are:\n| # |" -> "These are:\n\n| # |"
  result = result.replace(/([^\n])\n(\|.*\|\s*\n\|[-:| ]+\|)/g, "$1\n\n$2");

  return result;
};

export default function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { 
    activeConversation, 
    loadConversation, 
    sendMessage, 
    deleteConversation, 
    createConversation, 
    isAsking, 
    isLoading, 
    error, 
    conversations, 
    pollConversationStatus 
  } = useChatStore();

  const [question, setQuestion] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [mobileTab, setMobileTab] = useState("chat");
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [jumpToast, setJumpToast] = useState(null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  
  // Video player & Scrubbing bar state
  const [activeTimestampBadge, setActiveTimestampBadge] = useState(null);
  const [videoDuration, setVideoDuration] = useState(600);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const iframeRef = useRef(null);

  // Filter conversations belonging to the active video
  const videoConversations = useMemo(() => {
    const v = activeConversation?.video;
    if (!conversations || !v) return [];
    return conversations.filter(c => 
      (c.video?.id && String(c.video.id) === String(v.id)) ||
      (c.video?.youtube_video_id && c.video.youtube_video_id === v.youtube_video_id)
    );
  }, [conversations, activeConversation?.video]);

  // Listen to YouTube player messages for live duration & currentTime synchronization
  useEffect(() => {
    const handleWindowMessage = (event) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.event === "infoDelivery" && data.info) {
          if (typeof data.info.duration === "number" && data.info.duration > 0) {
            setVideoDuration(data.info.duration);
          }
          if (typeof data.info.currentTime === "number") {
            setCurrentPlaybackTime(data.info.currentTime);
          }
        }
      } catch {
        // Ignore non-JSON postMessages
      }
    };

    window.addEventListener("message", handleWindowMessage);
    return () => window.removeEventListener("message", handleWindowMessage);
  }, []);

  const handleIframeLoad = () => {
    if (iframeRef.current?.contentWindow) {
      try {
        // Instruct YouTube player to send playback events
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "listening" }),
          "*"
        );
      } catch (err) {
        console.warn("postMessage listening error:", err);
      }
    }
  };

  const handleSeek = (seconds, label = null) => {
    const cleanSeconds = Math.max(0, Math.floor(seconds));
    setCurrentPlaybackTime(cleanSeconds);

    const badge = label || formatTime(cleanSeconds);
    setActiveTimestampBadge(badge);

    // Send postMessage command to YouTube iframe to seek & play smoothly without remounting iframe
    const iframe = iframeRef.current;
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: "seekTo",
            args: [cleanSeconds, true]
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

    // On mobile screens: smoothly switch to video tab and scroll player into view
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileTab("video");
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 120);
    }
  };

  const scrollToBottom = (behavior = "smooth") => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior
      });
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
    }
  };

  useEffect(() => {
    if (id) loadConversation(id);
  }, [id, loadConversation]);

  // When switching to the chat tab on mobile, ensure it reliably scrolls to the bottom
  useEffect(() => {
    if (mobileTab === "chat") {
      scrollToBottom("auto");
      const timer = setTimeout(() => {
        scrollToBottom("smooth");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mobileTab]);

  // When active messages change or when streaming, auto-scroll to the bottom
  useEffect(() => {
    if (mobileTab === "chat") {
      scrollToBottom(isAsking ? "auto" : "smooth");
    }
  }, [activeConversation?.messages?.length, isAsking]);

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

  // Extract timeline markers dynamically from conversation questions & LLM responses
  const timelineMarkers = useMemo(() => {
    const markers = [];
    const seenTimes = new Set();

    markers.push({
      id: "start-0",
      seconds: 0,
      formattedTime: "00:00",
      label: "Intro & Overview",
      category: "intro",
      color: "bg-pastel-yellow"
    });
    seenTimes.add(0);

    const msgs = activeConversation?.messages;
    if (!msgs || msgs.length === 0) return markers;

    msgs.forEach((msg, idx) => {
      const content = msg.content || "";
      const regex = /(?:\[((?:(\d{1,2}):)?(\d{1,2}):(\d{2}))\]|\[(\d+(?:\.\d+)?)\s*s\]|(?:[?&#](?:t|start)=([0-9hms]+)))/gi;
      let match;

      while ((match = regex.exec(content)) !== null) {
        let totalSeconds = null;
        let displayLabel = null;

        if (match[1]) {
          const h = match[2] ? parseInt(match[2], 10) : 0;
          const m = parseInt(match[3], 10);
          const s = parseInt(match[4], 10);
          totalSeconds = h * 3600 + m * 60 + s;
          displayLabel = match[1];
        } else if (match[5]) {
          totalSeconds = Math.floor(parseFloat(match[5]));
        } else if (match[6]) {
          const val = match[6];
          let t = 0;
          if (/[hms]/i.test(val)) {
            const h = val.match(/(\d+)h/i);
            const m = val.match(/(\d+)m/i);
            const s = val.match(/(\d+)s/i);
            if (h) t += parseInt(h[1], 10) * 3600;
            if (m) t += parseInt(m[1], 10) * 60;
            if (s) t += parseInt(s[1], 10);
            totalSeconds = t;
          } else {
            totalSeconds = parseInt(val.replace(/\D/g, ""), 10);
          }
        }

        if (totalSeconds !== null && !isNaN(totalSeconds) && !seenTimes.has(totalSeconds)) {
          seenTimes.add(totalSeconds);

          const surrounding = content.substring(Math.max(0, match.index - 35), Math.min(content.length, match.index + 70));
          const cleanSnippet = surrounding
            .replace(/\[.*?\](\(.*?\))?/g, "")
            .replace(/[#*`>-]/g, "")
            .trim();

          const fallbackLabel = msg.role === "user"
            ? (content.slice(0, 26) + (content.length > 26 ? "..." : ""))
            : (cleanSnippet ? (cleanSnippet.slice(0, 30) + "...") : `Key Concept @ ${formatTime(totalSeconds)}`);

          markers.push({
            id: `marker-${idx}-${totalSeconds}`,
            seconds: totalSeconds,
            formattedTime: displayLabel || formatTime(totalSeconds),
            label: fallbackLabel,
            category: msg.role === "user" ? "question" : "concept",
            color: msg.role === "user" ? "bg-pastel-peach" : "bg-pastel-mint"
          });
        }
      }
    });

    return markers.sort((a, b) => a.seconds - b.seconds);
  }, [activeConversation?.messages]);

  const effectiveDuration = useMemo(() => {
    let maxSec = videoDuration;
    if (timelineMarkers && timelineMarkers.length > 0) {
      const highestMarker = timelineMarkers.reduce((acc, m) => Math.max(acc, m.seconds || 0), 0);
      if (highestMarker > maxSec) maxSec = highestMarker + 60;
    }
    return Math.max(videoDuration, maxSec);
  }, [videoDuration, timelineMarkers]);

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
    <div className="h-[calc(100dvh-4.75rem)] sm:h-[calc(100dvh-6.5rem)] lg:h-[85vh] w-full flex flex-col lg:flex-row gap-2 lg:gap-6 pb-1 lg:pb-4 px-1 sm:px-2 overflow-hidden">
      
      {/* Mobile Top Navigation & Tab Switcher Bar */}
      <div className="lg:hidden flex items-center justify-between gap-1.5 p-1 bg-white border-cartoon shadow-neubrutalism-sm rounded-2xl shrink-0">
        <button
          onClick={() => navigate("/dashboard")}
          className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-300 flex items-center justify-center transition-all cursor-pointer"
          title="Back to Dashboard"
          aria-label="Back to Dashboard"
        >
          <ArrowLeft size={16} strokeWidth={3} />
        </button>

        {/* Segmented Tab Switcher */}
        <div className="flex-1 flex p-0.5 bg-slate-100 rounded-xl border border-slate-200">
          <button
            onClick={() => setMobileTab("chat")}
            className={cn(
              "flex-1 py-1.5 sm:py-2 px-2.5 rounded-lg font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer",
              mobileTab === "chat"
                ? "bg-pastel-peach text-slate-900 border-2 border-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <MessageSquare size={14} />
            <span>Chat</span>
            {activeConversation.messages?.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-slate-900 text-white rounded-full text-[10px] font-mono font-bold">
                {activeConversation.messages.length}
              </span>
            )}
          </button>

          {!isExtension && (
            <button
              onClick={() => setMobileTab("video")}
              className={cn(
                "flex-1 py-1.5 sm:py-2 px-2.5 rounded-lg font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                mobileTab === "video"
                  ? "bg-pastel-mint text-slate-900 border-2 border-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Play size={12} className="fill-current" />
              <span>Video</span>
              {timelineMarkers.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-slate-900 text-white rounded-full text-[10px] font-mono font-bold">
                  {timelineMarkers.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* History Drawer Trigger */}
        <button
          onClick={() => setShowMobileDrawer(true)}
          className="p-2 sm:p-2.5 bg-pastel-yellow hover:bg-yellow-200 text-slate-900 rounded-xl border-2 border-slate-900 shadow-neubrutalism-sm flex items-center gap-1 transition-all cursor-pointer relative"
          title="Conversation Sessions"
          aria-label="Conversation Sessions"
        >
          <History size={16} strokeWidth={2.5} />
          {videoConversations.length > 0 && (
            <span className="font-mono text-xs font-black">{videoConversations.length}</span>
          )}
        </button>
      </div>

      {/* Left Sidebar: Recent Chats (Hidden on small screens) */}
      <div className="hidden lg:flex w-1/4 h-full flex-col gap-4 bg-pastel-yellow rounded-3xl p-4 border-cartoon shadow-neubrutalism shrink-0">
        <Link to="/dashboard" className="self-start mb-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border-cartoon shadow-neubrutalism-sm font-black text-sm text-slate-900 hover:bg-slate-100 hover:-translate-y-1 transition-all active:translate-y-0 cursor-pointer">
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
            className="px-4 py-2 bg-pastel-peach text-slate-900 border-cartoon shadow-neubrutalism-sm hover:bg-pastel-lavender rounded-full font-black text-sm hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-50 cursor-pointer"
            title="Create a new study session for this video"
          >
            + New
          </button>
        </div>
        <div className="flex flex-col gap-3 overflow-y-auto pr-1" data-lenis-prevent>
          {videoConversations.length === 0 ? (
            <p className="text-sm text-slate-500 p-2">No other chats found.</p>
          ) : (
            videoConversations.map(chat => (
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
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg lg:opacity-0 group-hover/item:opacity-100 transition-opacity cursor-pointer"
                  title="Delete Conversation"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Middle Panel: Video Player & Timeline Console (Hidden in Extension) */}
      {!isExtension && (
        <div className={cn(
          "w-full lg:w-5/12 xl:w-4/12 h-full flex flex-col gap-4 min-h-0",
          mobileTab !== "video" && "hidden lg:flex"
        )}>
          <div className="flex-grow bg-white border-cartoon rounded-3xl shadow-neubrutalism overflow-hidden flex flex-col">
            {/* Mac-style Window Header */}
            <div className="w-full bg-slate-100 p-3 border-b border-slate-200 flex gap-2 items-center shrink-0">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
              <span className="text-xs font-mono font-bold text-slate-500 ml-2">Video Console</span>
            </div>
            
            {/* YouTube Player (No key remounting for ultra-smooth postMessage seeking) */}
            <div className="w-full aspect-video bg-black relative shrink-0">
              <iframe 
                ref={iframeRef}
                onLoad={handleIframeLoad}
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${video?.youtube_video_id || ''}?enablejsapi=1`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
              {/* Mobile Quick Return to Chat Pill */}
              <button
                type="button"
                onClick={() => setMobileTab("chat")}
                className="lg:hidden absolute top-3 left-3 z-10 px-3 py-1 bg-white/95 backdrop-blur-sm text-slate-900 border-2 border-slate-900 rounded-full text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                title="Return to Chat"
              >
                <MessageSquare size={13} />
                <span>Back to Chat</span>
              </button>

              {activeTimestampBadge && (
                <div className="absolute top-3 right-3 z-10 px-3 py-1 bg-slate-900/85 backdrop-blur-sm text-pastel-mint border border-pastel-mint/40 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-pastel-mint animate-pulse" />
                  Playing at {activeTimestampBadge}
                </div>
              )}
            </div>

            {/* Pillar 2.3: Interactive Timestamp Scrubbing Bar */}
            <div className="p-3 bg-slate-50 border-t border-b border-slate-200 shrink-0">
              <VideoTimelineScrubber
                duration={effectiveDuration}
                currentTime={currentPlaybackTime}
                markers={timelineMarkers}
                onSeek={handleSeek}
                activeLabel={activeTimestampBadge}
              />
            </div>

            {/* Video Details */}
            <div className="p-4 flex-grow flex flex-col gap-2 overflow-y-auto" data-lenis-prevent>
              <div className="flex items-center gap-2">
                <div className="inline-block px-3 py-0.5 bg-pastel-mint/30 rounded-full text-xs font-bold text-green-700 uppercase tracking-wider self-start">
                  {video.status}
                </div>
                <span className="text-xs font-bold text-slate-400">
                  {timelineMarkers.length} timeline milestones
                </span>
              </div>
              <h2 className="text-base font-heading font-black text-slate-800 leading-snug">{video.title}</h2>
            </div>

            {/* Mobile Switch Back to Chat Action */}
            <div className="lg:hidden p-3 bg-slate-50 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setMobileTab("chat")}
                className="w-full py-3 bg-pastel-peach border-cartoon text-slate-900 font-black rounded-xl shadow-neubrutalism-sm flex items-center justify-center gap-2 text-sm hover:bg-pastel-yellow transition-all cursor-pointer"
              >
                <MessageSquare size={16} />
                <span>Ask Study Buddy About This</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Right Panel: Chat Interface */}
      <div className={cn(
        "w-full lg:flex-1 h-full min-h-0 flex flex-col bg-white border-cartoon rounded-3xl shadow-neubrutalism overflow-hidden relative",
        mobileTab !== "chat" && "hidden lg:flex"
      )}>
        {/* Floating Jump Toast on mobile */}
        <AnimatePresence>
          {jumpToast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-3.5 py-2 bg-slate-900 text-white border-2 border-pastel-mint rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold whitespace-nowrap"
            >
              <Play size={12} className="fill-pastel-mint text-pastel-mint shrink-0" />
              <span>Jumped to {jumpToast.label}</span>
              <button
                type="button"
                onClick={() => {
                  setMobileTab("video");
                  setJumpToast(null);
                }}
                className="px-2.5 py-1 bg-pastel-mint text-slate-900 rounded-lg font-bold text-[11px] hover:bg-white transition-colors cursor-pointer"
              >
                Watch Video 🎬
              </button>
              <button
                type="button"
                onClick={() => setJumpToast(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Header */}
        <div className="p-3 sm:p-4 border-b-cartoon bg-pastel-blue flex items-center justify-between gap-3 z-10 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Mobile Back Button */}
            <div className="lg:hidden shrink-0">
              <Link to="/dashboard" className="p-2 bg-white rounded-xl border-cartoon shadow-neubrutalism-sm text-slate-800 flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer">
                <ArrowLeft size={16} strokeWidth={3} />
              </Link>
            </div>
            
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-pastel-yellow border-cartoon shadow-neubrutalism-sm rounded-full flex items-center justify-center shrink-0">
              <Bot size={24} className="text-slate-900 sm:w-7 sm:h-7" />
            </div>
            
            <div className="min-w-0">
              <h3 className="font-heading font-black text-base sm:text-lg text-slate-800 leading-tight">Study Buddy</h3>
              <div className="flex items-center gap-1.5">
                {video?.status === "READY" ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <p className="text-[11px] sm:text-xs font-bold text-slate-500">Ready</p>
                  </>
                ) : video?.status === "FAILED" ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    <p className="text-[11px] sm:text-xs font-bold text-red-500">Failed</p>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-3 h-3 text-yellow-600 animate-spin" />
                    <p className="text-[11px] sm:text-xs font-bold text-yellow-600">Processing...</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Header Actions on Mobile */}
          <div className="flex items-center gap-1.5 lg:hidden shrink-0">
            <button
              onClick={() => setShowMobileDrawer(true)}
              className="p-2 bg-white rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
              title="Sessions"
            >
              <History size={15} />
              <span>{videoConversations.length}</span>
            </button>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="p-2 bg-pastel-peach rounded-xl border-cartoon shadow-neubrutalism-sm text-slate-900 font-black text-xs hover:bg-pastel-lavender transition-all cursor-pointer"
              title="New Chat Session"
            >
              + New
            </button>
          </div>
        </div>

        {/* Mobile Mini Video Status Bar (Tapping jumps to Video Tab) */}
        {!isExtension && (
          <div 
            onClick={() => setMobileTab("video")}
            className="lg:hidden flex items-center justify-between px-3 py-1.5 bg-slate-900 text-white cursor-pointer hover:bg-slate-800 transition-colors shrink-0 border-b border-slate-700"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-pastel-mint animate-pulse shrink-0" />
              <span className="text-[11px] font-mono font-bold truncate text-pastel-yellow">{video?.title || "Video Console"}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-pastel-mint uppercase tracking-wider shrink-0 ml-2">
              <span>View Player</span>
              <Play size={9} className="fill-pastel-mint" />
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-grow p-3 sm:p-4 md:p-6 overflow-y-auto flex flex-col gap-4 sm:gap-6 bg-[#FDFBF7]" 
          data-lenis-prevent
        >
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

              if (msg.role?.toLowerCase() === "assistant" && !msg.content && !isAsking) {
                return (
                  <motion.div
                    key={`empty-${msg.id}`}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2 sm:gap-4 w-full justify-start"
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center bg-pastel-yellow border-cartoon shadow-neubrutalism-sm mt-1">
                      <Bot size={18} strokeWidth={2.5} className="text-slate-900 sm:w-5 sm:h-5"/>
                    </div>
                    <div className="py-2.5 px-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs sm:text-sm text-amber-800 font-bold">
                      ⚠️ Response was interrupted or empty. You can ask this question again.
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
                  className={`flex gap-2 sm:gap-4 min-w-0 w-full ${msg.role?.toLowerCase() === "user" ? "justify-end" : "justify-start"}`}
                >
                  {/* Assistant Avatar */}
                  {msg.role?.toLowerCase() === "assistant" && (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center bg-pastel-yellow border-cartoon shadow-neubrutalism-sm mt-1 z-10">
                      <Bot size={18} strokeWidth={2.5} className="text-slate-900 sm:w-5 sm:h-5"/>
                    </div>
                  )}
                  
                  {/* Message Bubble Column */}
                  <div className={`flex flex-col gap-1 min-w-0 ${msg.role?.toLowerCase() === "user" ? "max-w-[90%] sm:max-w-[85%]" : "max-w-[95%] sm:max-w-[90%]"}`}>
                    <div className={`min-w-0 break-words ${
                      msg.role?.toLowerCase() === "user" 
                        ? "px-4 sm:px-5 py-3 sm:py-4 shadow-neubrutalism-sm bg-pastel-peach text-slate-900 font-bold border-cartoon rounded-2xl sm:rounded-3xl rounded-tr-sm text-sm sm:text-base" 
                        : "py-2.5 sm:py-3 px-3.5 sm:px-5 w-full bg-slate-50 border-cartoon shadow-neubrutalism-sm rounded-2xl sm:rounded-3xl rounded-tl-sm text-slate-900 overflow-x-auto text-sm sm:text-base prose prose-slate prose-sm sm:prose-base prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:text-slate-50 prose-pre:border-cartoon prose-pre:rounded-xl prose-code:text-[#9333ea] prose-code:bg-[#9333ea]/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-mono prose-code:before:content-none prose-code:after:content-none prose-headings:font-heading prose-headings:font-black prose-a:text-[#9333ea]"
                    }`} data-lenis-prevent>
                      {msg.role?.toLowerCase() === "user" ? (
                        <p className="font-medium whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ href, children, ...props }) => {
                              const timeFromUrl = extractTimestampFromUrl(href);
                              const timeFromText = extractTimestampFromText(children);
                              const targetSeconds = timeFromUrl !== null ? timeFromUrl : timeFromText;
                              
                              // Check if this is a YouTube link or timestamp link
                              const isYt = href && (href.includes("youtube.com") || href.includes("youtu.be"));
                              
                              if (targetSeconds !== null || isYt) {
                                const finalSec = targetSeconds !== null ? targetSeconds : 0;
                                const displayLabel = typeof children === "string" ? children : formatTime(finalSec);
                                
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
                                <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#9333ea] underline font-semibold hover:text-[#7e22ce] transition-colors" {...props}>
                                  {children}
                                </a>
                              );
                            },
                            table: ({ children, ...props }) => (
                              <div className="w-full my-3.5 overflow-x-auto rounded-2xl border-2 border-slate-900 bg-white shadow-neubrutalism-sm max-w-full" data-lenis-prevent>
                                <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[320px]" {...props}>
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children, ...props }) => (
                              <thead className="bg-pastel-yellow border-b-2 border-slate-900 text-slate-900 font-heading font-black" {...props}>
                                {children}
                              </thead>
                            ),
                            tbody: ({ children, ...props }) => (
                              <tbody className="divide-y divide-slate-200 bg-white" {...props}>
                                {children}
                              </tbody>
                            ),
                            tr: ({ children, ...props }) => (
                              <tr className="hover:bg-slate-50 transition-colors" {...props}>
                                {children}
                              </tr>
                            ),
                            th: ({ children, ...props }) => (
                              <th className="px-3.5 py-2.5 font-black text-slate-900 uppercase tracking-wider text-[11px] sm:text-xs border-r border-slate-300 last:border-r-0 whitespace-nowrap" {...props}>
                                {children}
                              </th>
                            ),
                            td: ({ children, ...props }) => (
                              <td className="px-3.5 py-2.5 text-slate-800 font-medium border-r border-slate-100 last:border-r-0 leading-relaxed text-xs sm:text-sm" {...props}>
                                {children}
                              </td>
                            ),
                            blockquote: ({ children, ...props }) => (
                              <blockquote className="my-2.5 border-l-4 border-pastel-peach bg-amber-50/70 pl-3.5 py-1.5 rounded-r-xl italic text-slate-800" {...props}>
                                {children}
                              </blockquote>
                            ),
                            ul: ({ children, ...props }) => (
                              <ul className="my-2 ml-4 list-disc space-y-1 text-slate-800" {...props}>
                                {children}
                              </ul>
                            ),
                            ol: ({ children, ...props }) => (
                              <ol className="my-2 ml-4 list-decimal space-y-1 text-slate-800" {...props}>
                                {children}
                              </ol>
                            ),
                            li: ({ children, ...props }) => (
                              <li className="leading-relaxed" {...props}>
                                {children}
                              </li>
                            ),
                            code: ({ inline, className, children, ...props }) => {
                              if (inline) {
                                return (
                                  <code className="px-1.5 py-0.5 rounded-md bg-[#9333ea]/10 text-[#9333ea] font-mono text-xs sm:text-sm font-semibold border border-[#9333ea]/20" {...props}>
                                    {children}
                                  </code>
                                );
                              }
                              return (
                                <code className={className} {...props}>
                                  {children}
                                </code>
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
                    <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center bg-pastel-mint border-cartoon shadow-neubrutalism-sm mt-1 z-10">
                      <User size={18} strokeWidth={3} className="text-slate-900 sm:w-5 sm:h-5"/>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={messagesEndRef} className="h-4 shrink-0" />
        </div>

        {/* Chat Input */}
        <div className="p-2.5 sm:p-4 pb-[max(0.625rem,env(safe-area-inset-bottom))] border-t-cartoon bg-white z-10 relative shrink-0">
          {video?.status !== "READY" && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
               <div className="px-4 py-2 bg-slate-900 text-pastel-yellow font-black rounded-full border-cartoon text-xs sm:text-sm flex items-center gap-2 shadow-neubrutalism-sm">
                 <Loader2 size={16} className="animate-spin" /> Processing Video...
               </div>
            </div>
          )}
          <form onSubmit={handleSend} className="relative flex items-center">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={video?.status !== "READY"}
              enterKeyHint="send"
              autoComplete="off"
              placeholder={video?.status === "READY" ? "Ask anything about this video..." : "Waiting for video to be processed..."}
              className="w-full py-3 sm:py-4 pl-4 sm:pl-6 pr-14 sm:pr-16 bg-white border-cartoon shadow-neubrutalism-sm rounded-full font-bold text-base md:text-lg text-slate-900 focus:outline-none focus:ring-4 focus:ring-pastel-peach focus:-translate-y-0.5 focus:shadow-neubrutalism transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <motion.button
              type="submit"
              disabled={isAsking || !question.trim() || video?.status !== "READY"}
              whileHover={{ scale: 1.08, rotate: 4 }}
              whileTap={{ scale: 0.92 }}
              className="absolute right-1.5 sm:right-2 p-2 sm:p-3 bg-pastel-mint border-cartoon rounded-full text-slate-900 font-black shadow-neubrutalism-sm disabled:opacity-50 transition-all hover:bg-pastel-yellow cursor-pointer flex items-center justify-center"
              aria-label="Send message"
            >
              <Send size={18} strokeWidth={3} className="sm:w-5 sm:h-5" />
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
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm cursor-pointer"
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
                  className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
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
                  className="flex-1 py-3 bg-[#9333ea] hover:bg-[#7e22ce] text-white font-bold rounded-xl shadow-md shadow-[#9333ea]/20 transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer"
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
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm cursor-pointer"
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
                  className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
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
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-md shadow-red-500/20 transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Slide-over Drawer for Conversation History */}
      <AnimatePresence>
        {showMobileDrawer && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileDrawer(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
            />
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="relative w-4/5 max-w-sm h-full bg-pastel-yellow border-r-cartoon shadow-2xl flex flex-col p-4 z-10"
            >
              <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900 mb-3">
                <div className="flex items-center gap-2">
                  <History size={20} className="text-slate-900" />
                  <h3 className="font-heading font-black text-lg text-slate-900">Study Sessions</h3>
                </div>
                <button 
                  onClick={() => setShowMobileDrawer(false)}
                  className="p-1.5 bg-white rounded-full border-2 border-slate-900 hover:bg-slate-100 cursor-pointer"
                  title="Close Drawer"
                >
                  <X size={16} />
                </button>
              </div>

              <button 
                onClick={() => {
                  setShowMobileDrawer(false);
                  setShowNewChatModal(true);
                }}
                className="w-full py-2.5 px-4 bg-pastel-peach border-cartoon text-slate-900 font-black rounded-xl shadow-neubrutalism-sm hover:bg-pastel-lavender flex items-center justify-center gap-2 text-sm mb-3 cursor-pointer"
              >
                + New Study Session
              </button>

              <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1" data-lenis-prevent>
                {videoConversations.length === 0 ? (
                  <p className="text-sm text-slate-500 p-2">No other sessions found.</p>
                ) : (
                  videoConversations.map(chat => (
                    <div 
                      key={chat.id}
                      onClick={() => {
                        setShowMobileDrawer(false);
                        if (chat.id !== id) {
                          navigate(`/chat/${chat.id}`);
                        }
                      }}
                      className={cn(
                        "p-3 rounded-2xl cursor-pointer transition-all border-cartoon flex items-center justify-between",
                        chat.id === id 
                          ? "bg-pastel-mint shadow-neubrutalism-sm border-slate-900" 
                          : "bg-white shadow-sm hover:bg-slate-50"
                      )}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-bold text-slate-800 text-sm line-clamp-2 leading-tight">
                          {chat.title || "New Study Session"}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(chat.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDelete(chat.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                        title="Delete Session"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
