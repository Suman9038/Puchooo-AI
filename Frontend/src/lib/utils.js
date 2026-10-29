import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Check if running in a Chrome Extension
export const isExtension = typeof window !== "undefined" && typeof window.chrome !== "undefined" && Boolean(window.chrome?.runtime?.id);

/**
 * Formats seconds into MM:SS or HH:MM:SS
 */
export function formatTime(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds === null || totalSeconds < 0) return "00:00";
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);

  const secStr = s.toString().padStart(2, "0");
  const minStr = m.toString().padStart(2, "0");

  if (h > 0) {
    return `${h}:${minStr}:${secStr}`;
  }
  return `${minStr}:${secStr}`;
}
