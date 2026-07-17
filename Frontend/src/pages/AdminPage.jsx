import React, { useEffect, useState } from "react";
import { useAdminStore } from "../store/useAdminStore";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, 
  Video, 
  MessageSquare, 
  ShieldAlert, 
  Trash2, 
  RefreshCw, 
  Loader2, 
  TrendingUp, 
  Lock,
  CheckCircle,
  AlertTriangle
} from "lucide-react";

export default function AdminPage() {
  const { 
    stats, 
    users, 
    videos, 
    isLoading, 
    error, 
    fetchStats, 
    fetchUsers, 
    fetchVideos, 
    changeUserRole, 
    deleteUser, 
    deleteVideo, 
    reprocessVideo 
  } = useAdminStore();

  const [activeTab, setActiveTab] = useState("stats");
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchVideos();
  }, [fetchStats, fetchUsers, fetchVideos]);

  const handleRoleChange = async (userId, newRole) => {
    if (window.confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      setProcessingId(userId);
      try {
        await changeUserRole(userId, newRole);
      } catch (err) {
        alert("Failed to change user role.");
      } finally {
        setProcessingId(null);
      }
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm("Are you sure you want to delete this user? All their conversations will be permanently deleted!")) {
      setProcessingId(userId);
      try {
        await deleteUser(userId);
      } catch (err) {
        alert("Failed to delete user.");
      } finally {
        setProcessingId(null);
      }
    }
  };

  const handleDeleteVideo = async (videoId) => {
    if (window.confirm("Are you sure you want to delete this video? This will purge database logs and all vector store embeddings!")) {
      setProcessingId(videoId);
      try {
        await deleteVideo(videoId);
      } catch (err) {
        alert("Failed to delete video.");
      } finally {
        setProcessingId(null);
      }
    }
  };

  const handleReprocessVideo = async (videoId) => {
    setProcessingId(videoId);
    try {
      await reprocessVideo(videoId);
      alert("Reprocessing task dispatched successfully!");
    } catch (err) {
      alert("Failed to dispatch reprocessing task.");
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading && !stats) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-purple-600" size={48} />
          <p className="text-xl font-bold text-slate-600">Gathering system intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-pastel-yellow border-cartoon shadow-neubrutalism-sm text-slate-900 text-xs font-black mb-4 uppercase tracking-wider rounded-full transform -rotate-2">
            <Lock size={14} strokeWidth={3} /> System Admin
          </div>
          <h1 className="text-5xl font-heading font-black text-slate-900 tracking-tight mb-2">Admin Console</h1>
          <p className="text-slate-800 font-bold bg-white p-3 rounded-2xl border-cartoon shadow-neubrutalism-sm inline-block">Monitor system activity, moderate content, and manage user roles.</p>
        </div>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-sm">
            <ShieldAlert size={18} /> {error}
          </div>
        )}
      </div>

      {/* Tabs Switcher */}
      <div className="flex gap-3 p-2 bg-pastel-peach border-cartoon shadow-neubrutalism-sm rounded-3xl self-start">
        {[
          { id: "stats", label: "Overview", icon: <TrendingUp size={20} strokeWidth={3} /> },
          { id: "users", label: "Users", icon: <Users size={20} strokeWidth={3} /> },
          { id: "videos", label: "Videos", icon: <Video size={20} strokeWidth={3} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all border-cartoon ${
              activeTab === tab.id
                ? "bg-pastel-yellow text-slate-900 shadow-neubrutalism-sm transform -translate-y-1"
                : "bg-white text-slate-600 hover:bg-slate-50 hover:-translate-y-0.5"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tabs Content */}
      <div className="w-full">
        {activeTab === "stats" && stats && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* Users Stat Card */}
            <div className="card-cartoon p-6 bg-pastel-lavender flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-black text-slate-900 uppercase tracking-wider">Total Users</span>
                <span className="text-5xl font-heading font-black text-slate-900">{stats.total_users}</span>
              </div>
              <div className="w-16 h-16 bg-white rounded-full border-cartoon shadow-neubrutalism-sm flex items-center justify-center text-slate-900">
                <Users size={32} strokeWidth={3} />
              </div>
            </div>

            {/* Videos Stat Card */}
            <div className="card-cartoon p-6 bg-pastel-mint flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-black text-slate-900 uppercase tracking-wider">Indexed Videos</span>
                <span className="text-5xl font-heading font-black text-slate-900">{stats.total_videos}</span>
              </div>
              <div className="w-16 h-16 bg-white rounded-full border-cartoon shadow-neubrutalism-sm flex items-center justify-center text-slate-900">
                <Video size={32} strokeWidth={3} />
              </div>
            </div>

            {/* Chats Stat Card */}
            <div className="card-cartoon p-6 bg-pastel-yellow flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-black text-slate-900 uppercase tracking-wider">Study Chats</span>
                <span className="text-5xl font-heading font-black text-slate-900">{stats.total_chats}</span>
              </div>
              <div className="w-16 h-16 bg-white rounded-full border-cartoon shadow-neubrutalism-sm flex items-center justify-center text-slate-900">
                <MessageSquare size={32} strokeWidth={3} />
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "users" && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full bg-white rounded-3xl border-cartoon overflow-hidden shadow-neubrutalism"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 text-xs font-bold uppercase text-slate-500 tracking-wider">User Details</th>
                    <th className="p-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Permissions (Role)</th>
                    <th className="p-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Verified</th>
                    <th className="p-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Joined Date</th>
                    <th className="p-4 text-xs font-bold uppercase text-slate-500 tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-500 font-medium">No users found.</td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-55/30 transition-colors">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">
                              {user.first_name || user.last_name ? `${user.first_name || ""} ${user.last_name || ""}` : "Unnamed User"}
                            </span>
                            <span className="text-xs font-mono text-slate-400">{user.email}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <select 
                            disabled={processingId === user.id}
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                            user.is_verified 
                              ? "bg-green-50 text-green-700 border border-green-200" 
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {user.is_verified ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="p-4 text-sm font-medium text-slate-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            disabled={processingId === user.id}
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="Delete User"
                          >
                            {processingId === user.id ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === "videos" && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full bg-white rounded-3xl border-cartoon overflow-hidden shadow-neubrutalism"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Video Details</th>
                    <th className="p-4 text-xs font-bold uppercase text-slate-500 tracking-wider">YouTube ID</th>
                    <th className="p-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Processing Status</th>
                    <th className="p-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Indexed At</th>
                    <th className="p-4 text-xs font-bold uppercase text-slate-500 tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {videos.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-500 font-medium">No videos indexed yet.</td>
                    </tr>
                  ) : (
                    videos.map((vid) => (
                      <tr key={vid.id} className="hover:bg-slate-55/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3 max-w-sm">
                            <img 
                              src={`https://img.youtube.com/vi/${vid.youtube_video_id}/mqdefault.jpg`}
                              alt="Thumbnail"
                              className="w-16 h-10 object-cover rounded-lg border border-slate-200"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-slate-800 truncate" title={vid.title}>
                                {vid.title || "Untitled Video"}
                              </span>
                              <a 
                                href={vid.youtube_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-xs font-medium text-purple-600 hover:underline truncate"
                              >
                                View on YouTube
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm font-mono font-medium text-slate-500">
                          {vid.youtube_video_id}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase ${
                            vid.status === "READY"
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : vid.status === "FAILED"
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}>
                            {vid.status === "READY" && <CheckCircle size={12} />}
                            {vid.status === "FAILED" && <AlertTriangle size={12} />}
                            {vid.status !== "READY" && vid.status !== "FAILED" && <Loader2 className="animate-spin" size={12} />}
                            {vid.status}
                          </span>
                        </td>
                        <td className="p-4 text-sm font-medium text-slate-500">
                          {new Date(vid.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              disabled={processingId === vid.id}
                              onClick={() => handleReprocessVideo(vid.id)}
                              className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
                              title="Reprocess/Re-index Video"
                            >
                              {processingId === vid.id ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                            </button>
                            <button
                              disabled={processingId === vid.id}
                              onClick={() => handleDeleteVideo(vid.id)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              title="Delete/Purge Video"
                            >
                              {processingId === vid.id ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
