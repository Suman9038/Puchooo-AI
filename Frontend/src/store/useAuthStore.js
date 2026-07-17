import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "../lib/axios";

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAccessToken: (token) => set({ accessToken: token, isAuthenticated: !!token }),
      setRefreshToken: (token) => set({ refreshToken: token }),
      setUser: (user) => set({ user }),

      login: async (email, password) => {
        const response = await api.post("/auth/login", { email, password });
        set({
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          user: response.data.user,
          isAuthenticated: true,
        });
        return response.data;
      },

      signup: async (userData) => {
        const response = await api.post("/auth/signup", userData);
        return response.data;
      },

      verifyEmail: async (token) => {
        const response = await api.get(`/auth/verify-email?token=${token}`);
        return response.data;
      },

      forgotPassword: async (email) => {
        const response = await api.post("/auth/forgot-password", { email });
        return response.data;
      },

      resetPassword: async (token, new_password) => {
        const response = await api.post("/auth/reset-password", { token, new_password });
        return response.data;
      },

      changePassword: async (current_password, new_password) => {
        const response = await api.post("/auth/change-password", { current_password, new_password });
        return response.data;
      },

      updateProfile: async (data) => {
        const response = await api.patch("/auth/update-profile", data);
        if (response.data?.user) {
           set({ user: response.data.user });
        }
        return response.data;
      },




      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
        api.get("/auth/logout").catch(() => {});
      },

      checkAuth: async () => {
        try {
          const response = await api.get("/auth/me");
          set({ user: response.data, isAuthenticated: true });
        } catch (error) {
          set({ user: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ accessToken: state.accessToken, refreshToken: state.refreshToken }),
    }
  )
);
