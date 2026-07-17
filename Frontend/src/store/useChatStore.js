import { create } from "zustand";
import api from "../lib/axios";

export const useChatStore = create((set, get) => ({
  conversations: [],
  myVideos: [],
  activeConversation: null,
  isLoading: false,
  isAsking: false,
  isFetchingVideos: false,
  error: null,

  fetchMyVideos: async () => {
    set({ isFetchingVideos: true });
    try {
      const response = await api.get("/chat/videos");
      set({ myVideos: response.data, isFetchingVideos: false });
    } catch (err) {
      console.error("Failed to fetch videos", err);
      set({ isFetchingVideos: false });
    }
  },

  fetchConversations: async (videoId = null) => {
    try {
      const url = videoId ? `/chat/conversations?video_id=${videoId}` : "/chat/conversations";
      const response = await api.get(url);
      set({ conversations: response.data });
    } catch (err) {
      console.error("Failed to fetch conversations", err);
    }
  },

  createConversation: async (youtube_url) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post("/chat/conversations", { youtube_url });
      set({ isLoading: false });
      return response.data;
    } catch (err) {
      set({ 
        error: err.response?.data?.detail || "Failed to create conversation",
        isLoading: false 
      });
      throw err;
    }
  },

  loadConversation: async (id) => {
    set({ isLoading: true, activeConversation: null, error: null });
    try {
      let convs = get().conversations;
      
      // If empty, or if we just want to be sure, we can fetch. But let's try local first.
      if (!convs || convs.length === 0) {
        const res = await api.get("/chat/conversations");
        convs = res.data;
        set({ conversations: convs });
      }
      
      let conv = convs.find(c => c.id === id);
      
      // If still not found, our local state might be stale (e.g. just created a new one)
      if (!conv) {
        const res = await api.get("/chat/conversations");
        convs = res.data;
        set({ conversations: convs });
        conv = convs.find(c => c.id === id);
      }

      if (!conv) {
        set({ error: "Conversation not found", isLoading: false });
        return;
      }
      
      const messagesRes = await api.get(`/chat/conversations/${id}/messages`);
      set({ activeConversation: { ...conv, messages: messagesRes.data }, isLoading: false });
    } catch (err) {
      set({ error: "Failed to load chat", isLoading: false });
    }
  },

  pollConversationStatus: async (videoId, conversationId) => {
    try {
      const res = await api.get(`/videos/${videoId}/status`);
      const { status } = res.data;
      
      set((state) => {
        if (state.activeConversation?.id === conversationId && state.activeConversation.video.status !== status) {
           return {
             activeConversation: {
               ...state.activeConversation,
               video: {
                 ...state.activeConversation.video,
                 status: status
               }
             },
             conversations: state.conversations.map(c => 
               c.video?.id === videoId 
                 ? { ...c, video: { ...c.video, status: status } } 
                 : c
             )
           };
        }
        return state;
      });
    } catch (err) {
      console.error("Failed to poll video status", err);
    }
  },

  sendMessage: async (conversationId, question) => {
    const currentActive = get().activeConversation;
    if (!currentActive) return;

    // Optimistic UI update
    const userMessage = { role: "user", content: question, id: Date.now() };
    const aiMessageId = Date.now() + 1;
    const initialAiMessage = { role: "assistant", content: "", id: aiMessageId };

    const updatedTitle = currentActive.title || question.substring(0, 80).trim();
    
    set((state) => ({ 
      isAsking: true, 
      activeConversation: {
        ...currentActive,
        title: updatedTitle,
        messages: [...(currentActive.messages || []), userMessage, initialAiMessage]
      },
      conversations: state.conversations.map(c => 
        c.id === conversationId ? { ...c, title: updatedTitle } : c
      )
    }));

    try {
      const { useAuthStore } = await import("./useAuthStore");
      const token = useAuthStore.getState().accessToken;

      const response = await fetch(`${api.defaults.baseURL}/chat/conversations/${conversationId}/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ question })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let buffer = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          
          // Keep the last partial line in the buffer
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            if (line.trim().startsWith('data: ')) {
              const dataStr = line.substring(line.indexOf('data: ') + 6).trim();
              if (!dataStr) continue;
              
              try {
                const data = JSON.parse(dataStr);
                
                if (data.error) {
                  console.error("Stream error:", data.error);
                  break;
                }
                
                if (data.done) {
                  done = true;
                  break;
                }
                
                if (data.token) {
                  set((state) => {
                    if (!state.activeConversation) return state;
                    const msgs = state.activeConversation.messages;
                    const newMsgs = msgs.map(msg => 
                      msg.id === aiMessageId ? { ...msg, content: msg.content + data.token } : msg
                    );
                    return {
                      activeConversation: {
                        ...state.activeConversation,
                        messages: newMsgs
                      }
                    };
                  });
                }
              } catch (e) {
                console.error("Error parsing stream data", e, dataStr);
              }
            }
          }
        }
      }
      
      set({ isAsking: false });
    } catch (err) {
      console.error("Failed to stream message", err);
      set({ error: "Failed to send message", isAsking: false });
    }
  },

  deleteConversation: async (id) => {
    try {
      await api.delete(`/chat/conversations/${id}`);
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        activeConversation: state.activeConversation?.id === id ? null : state.activeConversation
      }));
    } catch (err) {
      console.error("Failed to delete conversation", err);
      throw err;
    }
  }
}));
