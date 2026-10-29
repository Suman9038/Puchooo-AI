import React, { useState, useRef, useMemo } from "react";
import { Play, Sparkles, Clock } from "lucide-react";
import { cn, formatTime } from "../lib/utils";

export default function VideoTimelineScrubber({
  duration = 600,
  currentTime = 0,
  markers = [],
  onSeek,
}) {
  const trackRef = useRef(null);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(null);
  const [activeHoverMarker, setActiveHoverMarker] = useState(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Safe duration ensuring at least 1s to prevent division by zero
  const safeDuration = useMemo(() => {
    if (!duration || duration <= 0) {
      // If duration is unknown, use max marker time + 60s or fallback 600s
      const maxMarker = markers.reduce((acc, m) => Math.max(acc, m.seconds || 0), 0);
      return Math.max(maxMarker + 60, 600);
    }
    return duration;
  }, [duration, markers]);

  const progressPercent = useMemo(() => {
    return Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));
  }, [currentTime, safeDuration]);

  // Handle Scrubbing & Clicking on Timeline Track
  const calculateSecondsFromEvent = (e) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const percent = clickX / rect.width;
    return Math.floor(percent * safeDuration);
  };

  const handleTrackClick = (e) => {
    e.stopPropagation();
    const targetSeconds = calculateSecondsFromEvent(e);
    if (onSeek) onSeek(targetSeconds, formatTime(targetSeconds));
  };

  const handleMouseMove = (e) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const percent = (mouseX / rect.width) * 100;
    const seconds = Math.floor((mouseX / rect.width) * safeDuration);

    setHoverPosition(percent);
    setHoverTime(seconds);

    if (isScrubbing && onSeek) {
      onSeek(seconds, formatTime(seconds));
    }
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
    setHoverPosition(null);
    setActiveHoverMarker(null);
    setIsScrubbing(false);
  };

  const handleMouseDown = (e) => {
    setIsScrubbing(true);
    handleTrackClick(e);
  };

  const handleMouseUp = () => {
    setIsScrubbing(false);
  };

  // Find currently active chapter/marker based on currentTime
  const currentChapter = useMemo(() => {
    if (!markers || markers.length === 0) return null;
    const sorted = [...markers].sort((a, b) => a.seconds - b.seconds);
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (currentTime >= sorted[i].seconds) {
        return sorted[i];
      }
    }
    return sorted[0] || null;
  }, [markers, currentTime]);

  return (
    <div className="w-full flex flex-col gap-2.5 bg-slate-900 border-2 border-slate-900 rounded-2xl p-3 shadow-neubrutalism-sm text-slate-100 select-none">
      
      {/* Top Header: Time indicators & Chapter title */}
      <div className="flex items-center justify-between text-xs font-mono font-bold">
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-pastel-mint shrink-0" />
          <span className="text-pastel-mint tracking-wider">
            {formatTime(currentTime)}
          </span>
          <span className="text-slate-500 font-sans">/</span>
          <span className="text-slate-400">
            {formatTime(safeDuration)}
          </span>
        </div>

        {/* Current Active Topic / Chapter Badge */}
        <div className="flex items-center gap-1.5 truncate max-w-[55%]">
          {currentChapter ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-sans font-bold bg-pastel-mint/20 text-pastel-mint border border-pastel-mint/30 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-pastel-mint animate-pulse shrink-0" />
              <span className="truncate">{currentChapter.label}</span>
            </span>
          ) : (
            <span className="text-slate-400 text-[11px] font-sans flex items-center gap-1">
              <Sparkles size={11} className="text-pastel-yellow" />
              Interactive Timeline
            </span>
          )}
        </div>
      </div>

      {/* Main Scrubber Track Bar */}
      <div
        ref={trackRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleTrackClick}
        className="relative w-full h-3.5 bg-slate-800 hover:h-4.5 rounded-full cursor-pointer transition-all duration-150 border border-slate-700/80 group overflow-visible my-1"
        title="Click or drag to scrub video"
      >
        {/* Progress Fill Bar */}
        <div
          className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-pastel-mint via-pastel-mint to-[#38bdf8] rounded-full transition-all duration-100 pointer-events-none"
          style={{ width: `${progressPercent}%` }}
        />

        {/* Playhead Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-slate-900 rounded-full shadow-md transition-transform duration-75 group-hover:scale-125 pointer-events-none"
          style={{ left: `calc(${progressPercent}% - 8px)` }}
        />

        {/* Hover Time Tooltip (Follows Cursor) */}
        {hoverPosition !== null && hoverTime !== null && !activeHoverMarker && (
          <div
            className="absolute -top-8 -translate-x-1/2 z-30 px-2 py-0.5 bg-slate-800 border border-slate-600 rounded-md text-[11px] font-mono font-bold text-white shadow-lg pointer-events-none whitespace-nowrap"
            style={{ left: `${hoverPosition}%` }}
          >
            {formatTime(hoverTime)}
          </div>
        )}

        {/* Interactive Colored Markers along the timeline */}
        {markers.map((marker) => {
          const markerPercent = Math.min(100, Math.max(0, (marker.seconds / safeDuration) * 100));
          const isMarkerActive = currentChapter?.id === marker.id;

          // Palette mapping for markers
          const markerColor = marker.color || (
            marker.category === "concept" ? "bg-pastel-mint" :
            marker.category === "question" ? "bg-pastel-peach" :
            marker.category === "intro" ? "bg-pastel-yellow" : "bg-pastel-blue"
          );

          return (
            <div
              key={marker.id}
              onClick={(e) => {
                e.stopPropagation();
                if (onSeek) onSeek(marker.seconds, marker.formattedTime || formatTime(marker.seconds));
              }}
              onMouseEnter={() => setActiveHoverMarker(marker)}
              onMouseLeave={() => setActiveHoverMarker(null)}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 group/marker cursor-pointer p-1"
              style={{ left: `${markerPercent}%` }}
            >
              {/* Pin Diamond / Circle with outline */}
              <div
                className={cn(
                  "w-3 h-3 rounded-full border-2 border-slate-900 transition-transform duration-200 group-hover/marker:scale-150 shadow-sm",
                  markerColor,
                  isMarkerActive && "ring-2 ring-white scale-125"
                )}
              />

              {/* Marker Tooltip on Hover */}
              {activeHoverMarker?.id === marker.id && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-40 bg-slate-900 border-2 border-cartoon rounded-xl px-2.5 py-1.5 shadow-neubrutalism-sm flex flex-col items-center gap-0.5 min-w-[130px] max-w-[200px] pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center gap-1.5 w-full justify-between">
                    <span className="text-[10px] font-mono font-black text-pastel-mint bg-slate-800 px-1.5 py-0.2 rounded">
                      {marker.formattedTime || formatTime(marker.seconds)}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-0.5">
                      <Play size={8} className="fill-pastel-mint text-pastel-mint" /> Jump
                    </span>
                  </div>
                  <p className="text-xs font-bold text-white truncate w-full text-center mt-0.5">
                    {marker.label}
                  </p>
                  {/* Tooltip triangle tail */}
                  <div className="w-2 h-2 bg-slate-900 border-r-2 border-b-2 border-black rotate-45 -mb-2.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Row: Quick-Jump Topic Chips */}
      {markers.length > 0 ? (
        <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5 pr-1 scrollbar-none" data-lenis-prevent>
          {markers.map((marker) => {
            const isChipActive = currentChapter?.id === marker.id;
            return (
              <button
                key={`chip-${marker.id}`}
                type="button"
                onClick={() => {
                  if (onSeek) onSeek(marker.seconds, marker.formattedTime || formatTime(marker.seconds));
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer border",
                  isChipActive
                    ? "bg-pastel-mint text-slate-900 border-slate-900 shadow-neubrutalism-sm -translate-y-0.5"
                    : "bg-slate-800/90 hover:bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:-translate-y-0.5"
                )}
                title={`Jump to ${marker.label} at ${marker.formattedTime || formatTime(marker.seconds)}`}
              >
                <Play
                  size={10}
                  className={cn(
                    "shrink-0",
                    isChipActive ? "fill-slate-900 text-slate-900" : "fill-slate-400 text-slate-400"
                  )}
                />
                <span className="font-mono text-[11px] font-black opacity-90">
                  {marker.formattedTime || formatTime(marker.seconds)}
                </span>
                <span className="truncate max-w-[120px] text-[11px]">
                  {marker.label}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5 font-medium">
          <span className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-pastel-mint" />
            Ask questions to automatically pin key topics on this timeline!
          </span>
          <button
            type="button"
            onClick={() => onSeek && onSeek(0, "00:00")}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold border border-slate-700 cursor-pointer"
          >
            <Play size={8} className="fill-slate-200" /> Start (00:00)
          </button>
        </div>
      )}
    </div>
  );
}
