import { create } from "zustand";
import api from "../lib/axios";

export const useVideoStore = create((set) => ({
  videos: [],
  isProcessing: false,
  error: null,

  fetchVideos: async () => {
    try {
      const response = await api.get("/videos");
      set({ videos: response.data, error: null });
    } catch (err) {
      set({ error: err.response?.data?.detail || "Failed to fetch videos" });
    }
  },

  processNewVideo: async (video_url) => {
    set({ isProcessing: true, error: null });
    try {
      const response = await api.post("/videos", { video_url });
      set((state) => ({ 
        videos: [response.data, ...state.videos],
        isProcessing: false 
      }));
      return response.data;
    } catch (err) {
      set({ 
        error: err.response?.data?.detail || "Failed to process video",
        isProcessing: false 
      });
      throw err;
    }
  },

  deleteVideo: async (id) => {
    try {
      await api.delete(`/videos/${id}`);
      set((state) => ({ videos: state.videos.filter((v) => v.id !== id) }));
    } catch (err) {
      console.error("Failed to delete video", err);
    }
  }
}));
