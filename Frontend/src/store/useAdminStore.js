import { create } from "zustand";
import api from "../lib/axios";

export const useAdminStore = create((set) => ({
  stats: null,
  users: [],
  videos: [],
  isLoading: false,
  error: null,

  fetchStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/admin/stats");
      set({ stats: response.data, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.detail || "Failed to fetch stats", isLoading: false });
    }
  },

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/admin/users");
      set({ users: response.data, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.detail || "Failed to fetch users", isLoading: false });
    }
  },

  fetchVideos: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/admin/videos");
      set({ videos: response.data, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.detail || "Failed to fetch videos", isLoading: false });
    }
  },

  changeUserRole: async (userId, role) => {
    set({ error: null });
    try {
      await api.patch(`/admin/users/${userId}/role`, { role });
      set((state) => ({
        users: state.users.map((user) =>
          user.id === userId ? { ...user, role } : user
        ),
      }));
    } catch (err) {
      set({ error: err.response?.data?.detail || "Failed to change user role" });
      throw err;
    }
  },

  deleteUser: async (userId) => {
    set({ error: null });
    try {
      await api.delete(`/admin/users/${userId}`);
      set((state) => ({
        users: state.users.filter((user) => user.id !== userId),
      }));
    } catch (err) {
      set({ error: err.response?.data?.detail || "Failed to delete user" });
      throw err;
    }
  },

  deleteVideo: async (videoId) => {
    set({ error: null });
    try {
      await api.delete(`/admin/videos/${videoId}`);
      set((state) => ({
        videos: state.videos.filter((video) => video.id !== videoId),
      }));
    } catch (err) {
      set({ error: err.response?.data?.detail || "Failed to delete video" });
      throw err;
    }
  },

  reprocessVideo: async (videoId) => {
    set({ error: null });
    try {
      const response = await api.post(`/admin/videos/${videoId}/reprocess`);
      set((state) => ({
        videos: state.videos.map((video) =>
          video.id === videoId ? { ...video, status: response.data.status } : video
        ),
      }));
    } catch (err) {
      set({ error: err.response?.data?.detail || "Failed to reprocess video" });
      throw err;
    }
  },
}));
