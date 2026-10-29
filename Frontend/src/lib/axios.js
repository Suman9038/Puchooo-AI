import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location.hostname) {
    const hostname = window.location.hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `http://${hostname}:8000`;
    }
  }
  return "http://localhost:8000";
};

export const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url || "";
    if (
      error.response?.status === 401 && 
      !originalRequest?._retry &&
      !url.includes("/auth/refresh_token") &&
      !url.includes("/auth/logout") &&
      !url.includes("/auth/login")
    ) {
      originalRequest._retry = true;
      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) throw new Error("No refresh token");

        const response = await axios.get(`${API_BASE_URL}/auth/refresh_token`, {
          headers: {
            Authorization: `Bearer ${refreshToken}`
          }
        });
        const { access_token } = response.data;
        useAuthStore.getState().setAccessToken(access_token);
        api.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
