"use client";
import { useState, useEffect } from "react";
import {
  Bookmark,
  Heart,
  LoaderCircle,
  MessageCircle,
  Plus,
  Search,
  ThumbsUp,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { communityHubService } from "../../services/communityHubService";
import type {
  Review,
  TravelGroup,
  CommunityTip,
} from "../../types/tourism";

const CommunityHub = () => {
  const [activeTab, setActiveTab] = useState<"tips" | "reviews" | "groups">("tips");
  const [tips, setTips] = useState<CommunityTip[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [groups, setGroups] = useState<TravelGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [tipForm, setTipForm] = useState({
    title: "",
    content: "",
    category: "travel_tip" as const,
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      communityHubService.getTips(),
      communityHubService.getReviews(),
      communityHubService.getGroups(),
    ])
      .then(([tipsData, reviewsData, groupsData]) => {
        setTips(tipsData);
        setReviews(reviewsData);
        setGroups(groupsData);
      })
      .catch(() => toast.error("Failed to load community content"))
      .finally(() => setLoading(false));
  }, []);

  const submitTip = async () => {
    if (!tipForm.title.trim() || !tipForm.content.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    try {
      const newTip = await communityHubService.submitTip({
        userId: "current-user",
        userName: "You",
        title: tipForm.title,
        content: tipForm.content,
        category: tipForm.category,
      });
      setTips((prev) => [newTip, ...prev]);
      setShowForm(false);
      setTipForm({ title: "", content: "", category: "travel_tip" });
      toast.success("Tip submitted successfully!");
    } catch {
      toast.error("Failed to submit tip");
    }
  };

  return (
    <section className="min-h-[calc(100vh-80px)] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="nexus-eyebrow">Community Hub</p>
          <h1 className="text-hero-display mt-4 text-5xl sm:text-6xl">
            Powered by <span className="nexus-gradient-text">Travelers</span>
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-slate-400">
            Share tips, write reviews, join travel groups, and connect with fellow explorers.
          </p>
        </motion.div>

        {/* Search */}
        <div className="mx-auto mt-8 flex max-w-2xl gap-3">
          <div className="nexus-card-elevated flex flex-1 items-center gap-3 px-4">
            <Search className="text-cyan-400" size={18} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search travel tips, places, groups..."
              className="min-w-0 flex-1 bg-transparent py-3.5 outline-none text-sm"
            />
          </div>
          <button onClick={() => setShowForm(!showForm)} className="nexus-button-primary px-5 py-3.5">
            <Plus size={18} /> Share
          </button>
        </div>

        {/* Share Form */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="nexus-card-elevated mx-auto mt-4 max-w-2xl p-6"
          >
            <h3 className="text-lg font-bold text-white">Share a Travel Tip</h3>
            <div className="mt-4 space-y-4">
              <input
                value={tipForm.title}
                onChange={(e) => setTipForm({ ...tipForm, title: e.target.value })}
                placeholder="Tip title"
                className="nexus-input"
              />
              <textarea
                value={tipForm.content}
                onChange={(e) => setTipForm({ ...tipForm, content: e.target.value })}
                placeholder="Share your travel knowledge..."
                className="nexus-input"
                rows={4}
              />
              <select
                value={tipForm.category}
                onChange={(e) => setTipForm({ ...tipForm, category: e.target.value as typeof tipForm.category })}
                className="nexus-input"
              >
                <option value="travel_tip">Travel Tip</option>
                <option value="road_report">Road Report</option>
                <option value="scam_alert">Scam Alert</option>
                <option value="recommendation">Recommendation</option>
              </select>
              <button onClick={submitTip} className="nexus-button-primary w-full py-4">
                <Plus size={18} /> Publish Tip
              </button>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="mt-10 flex gap-2 border-b border-white/[0.06] pb-2">
          {[
            { id: "tips", label: "Travel Tips", icon: MessageCircle },
            { id: "reviews", label: "Reviews", icon: Heart },
            { id: "groups", label: "Groups", icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`inline-flex items-center gap-2 rounded-t-xl px-5 py-3 text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-white/[0.04] text-cyan-300 border-t border-l border-r border-white/[0.06]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <LoaderCircle size={36} className="animate-spin text-cyan-400" />
          </div>
        )}

        {!loading && activeTab === "tips" && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {tips.map((tip) => (
              <motion.article
                key={tip.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="nexus-card-elevated p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-cyan-400/10 p-2 text-cyan-300">
                      <Users size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{tip.userName}</p>
                      <p className="text-xs text-slate-500">{new Date(tip.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-purple-400/10 px-2.5 py-1 text-xs capitalize text-purple-300">
                    {tip.category.replace("_", " ")}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-white">{tip.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{tip.content}</p>
                <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                  <button className="flex items-center gap-1 hover:text-cyan-300 transition-colors">
                    <ThumbsUp size={14} /> {tip.likes}
                  </button>
                  <button className="flex items-center gap-1 hover:text-emerald-300 transition-colors">
                    <Bookmark size={14} /> {tip.bookmarks}
                  </button>
                  <button className="flex items-center gap-1 hover:text-purple-300 transition-colors">
                    <MessageCircle size={14} /> {(tip.comments || []).length}
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        )}

        {!loading && activeTab === "reviews" && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {reviews.map((review) => (
              <motion.article
                key={review.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="nexus-card-elevated p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-gradient-to-br from-cyan-400/15 to-purple-600/10 p-2 text-cyan-300">
                      <Users size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{review.userName}</p>
                      <p className="text-xs text-slate-500">{review.placeName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-yellow-300">
                    <span className="text-sm font-bold">{review.rating}</span>
                    <Heart size={12} fill="currentColor" />
                  </div>
                </div>
                <h3 className="mt-3 text-base font-bold text-white">{review.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{review.content}</p>
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <ThumbsUp size={14} /> {review.helpfulCount} found helpful
                  </span>
                </div>
              </motion.article>
            ))}
          </div>
        )}

        {!loading && activeTab === "groups" && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <motion.article
                key={group.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="nexus-card-elevated p-5 cursor-pointer hover:border-cyan-400/20"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-gradient-to-br from-cyan-400/15 to-blue-600/10 p-3 text-cyan-400">
                    <Users size={22} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-white truncate">{group.name}</h3>
                    <p className="text-xs text-slate-500">{group.memberCount.toLocaleString()} members</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-400 line-clamp-2">{group.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {group.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-white/[0.04] px-2 py-0.5 text-xs text-slate-400">
                      #{tag}
                    </span>
                  ))}
                </div>
                <button className="nexus-button-glossy mt-4 w-full text-sm py-2.5">
                  Join Group
                </button>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default CommunityHub;
