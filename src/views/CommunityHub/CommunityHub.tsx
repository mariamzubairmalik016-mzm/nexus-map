"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  Heart,
  LoaderCircle,
  MessageCircle,
  Plus,
  Search,
  Send,
  Star,
  ThumbsUp,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";

import {
  communityHubService,
  type CommunityComment,
  type Engagement,
  type ReactionKind,
  type ReactionTarget,
} from "../../services/communityHubService";
import { api } from "../../services/api";

/** How often the feed re-reads from the server. */
const REFRESH_MS = 20_000;

type Engaged = { engagement: Engagement };
type Tip = {
  id: string;
  userName: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
} & Engaged;
type Review = {
  id: string;
  userName: string;
  placeId: string;
  placeName: string;
  rating: number;
  title: string;
  content: string;
  createdAt: string;
  mine: boolean;
} & Engaged;
type Group = {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  tags: string[];
  joined: boolean;
  isOwner: boolean;
};
type Poi = { id: string; name: string; city?: string };

const timeAgo = (iso: string): string => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

/** Comment thread — loaded on demand, so a 20-card feed doesn't fetch 20 threads. */
const CommentThread = ({
  targetType,
  targetId,
  signedIn,
  onCountChange,
}: {
  targetType: ReactionTarget;
  targetId: string;
  signedIn: boolean;
  onCountChange: (delta: number) => void;
}) => {
  const [comments, setComments] = useState<CommunityComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    communityHubService
      .getComments(targetType, targetId)
      .then((rows) => !cancelled && setComments(rows))
      .catch(() => !cancelled && setComments([]));
    return () => {
      cancelled = true;
    };
  }, [targetType, targetId]);

  const submit = async () => {
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    try {
      const created = await communityHubService.addComment(targetType, targetId, content);
      setComments((current) => [...(current ?? []), created]);
      onCountChange(1);
      setDraft("");
    } catch (error) {
      toast.error((error as Error).message || "Could not post your comment.");
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await communityHubService.deleteComment(id);
      setComments((current) => (current ?? []).filter((c) => c.id !== id));
      onCountChange(-1);
    } catch (error) {
      toast.error((error as Error).message || "Could not delete the comment.");
    }
  };

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      {comments === null ? (
        <p className="text-xs text-slate-500">Loading comments…</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-white">
                {comment.userName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 rounded-[14px] bg-white/[0.05] px-3 py-2">
                <p className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-white">{comment.userName}</span>
                  <span className="text-slate-500">{timeAgo(comment.createdAt)}</span>
                  {comment.mine && (
                    <button
                      onClick={() => void remove(comment.id)}
                      aria-label="Delete your comment"
                      className="ml-auto text-slate-500 transition-colors hover:text-[#ff453a]"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-300">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}

          {comments.length === 0 && (
            <p className="text-xs text-slate-500">No comments yet — be the first.</p>
          )}
        </div>
      )}

      {signedIn ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void submit()}
            placeholder="Write a comment…"
            maxLength={1000}
            className="nexus-input py-2.5 text-sm"
          />
          <button
            onClick={() => void submit()}
            disabled={sending || !draft.trim()}
            aria-label="Post comment"
            className="nexus-button-primary nexus-button-sm shrink-0"
          >
            <Send size={14} />
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">Sign in to join the conversation.</p>
      )}
    </div>
  );
};

/** The like / bookmark / comment row shared by tips and reviews. */
const EngagementBar = ({
  targetType,
  item,
  signedIn,
  onChange,
  openComments,
  onToggleComments,
}: {
  targetType: ReactionTarget;
  item: Engaged & { id: string };
  signedIn: boolean;
  onChange: (id: string, next: Engagement) => void;
  openComments: boolean;
  onToggleComments: () => void;
}) => {
  const e = item.engagement;

  const react = async (kind: ReactionKind) => {
    if (!signedIn) {
      toast.error("Sign in to react.");
      return;
    }
    const key = kind === "like" ? "liked" : kind === "bookmark" ? "bookmarked" : "helpful";
    const countKey = kind === "like" ? "likes" : kind === "bookmark" ? "bookmarks" : "helpful";
    const wasActive = e.viewer[key as keyof typeof e.viewer];

    // Optimistic: the tap should feel instant. The server response is
    // authoritative and reconciles the count below.
    onChange(item.id, {
      ...e,
      [countKey]: Math.max(0, (e[countKey as keyof Engagement] as number) + (wasActive ? -1 : 1)),
      viewer: { ...e.viewer, [key]: !wasActive },
    } as Engagement);

    try {
      const { active, count } = await communityHubService.react(targetType, item.id, kind);
      onChange(item.id, {
        ...e,
        [countKey]: count,
        viewer: { ...e.viewer, [key]: active },
      } as Engagement);
    } catch (error) {
      onChange(item.id, e); // roll back to the pre-tap state
      toast.error((error as Error).message || "Could not save your reaction.");
    }
  };

  return (
    <div className="mt-4 flex items-center gap-4 text-xs">
      <button
        onClick={() => void react("like")}
        className={`flex items-center gap-1.5 transition-colors ${
          e.viewer.liked ? "text-[#ff453a]" : "text-slate-500 hover:text-white"
        }`}
      >
        <Heart size={15} fill={e.viewer.liked ? "currentColor" : "none"} />
        {e.likes}
      </button>

      <button
        onClick={onToggleComments}
        className={`flex items-center gap-1.5 transition-colors ${
          openComments ? "text-[#64d2ff]" : "text-slate-500 hover:text-white"
        }`}
      >
        <MessageCircle size={15} />
        {e.comments}
      </button>

      <button
        onClick={() => void react("bookmark")}
        className={`flex items-center gap-1.5 transition-colors ${
          e.viewer.bookmarked ? "text-[#30d158]" : "text-slate-500 hover:text-white"
        }`}
      >
        <Bookmark size={15} fill={e.viewer.bookmarked ? "currentColor" : "none"} />
        {e.bookmarks}
      </button>

      {targetType === "review" && (
        <button
          onClick={() => void react("helpful")}
          className={`flex items-center gap-1.5 transition-colors ${
            e.viewer.helpful ? "text-[#ffd60a]" : "text-slate-500 hover:text-white"
          }`}
        >
          <ThumbsUp size={15} />
          {e.helpful} helpful
        </button>
      )}
    </div>
  );
};

const CommunityHub = () => {
  const { data: session } = useSession();
  const signedIn = Boolean(session?.user);

  const [activeTab, setActiveTab] = useState<"tips" | "reviews" | "groups">("tips");
  const [tips, setTips] = useState<Tip[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [pois, setPois] = useState<Poi[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [openThread, setOpenThread] = useState<string | null>(null);

  const [composer, setComposer] = useState<"none" | "tip" | "review" | "group">("none");
  const [submitting, setSubmitting] = useState(false);
  const [tipForm, setTipForm] = useState({ title: "", content: "", category: "travel_tip" });
  const [reviewForm, setReviewForm] = useState({ placeId: "", rating: 5, title: "", content: "" });
  const [groupForm, setGroupForm] = useState({ name: "", description: "", tags: "" });

  /** Skip a refresh while a composer is open so typing isn't disturbed. */
  const composerOpen = composer !== "none";
  const composerOpenRef = useRef(composerOpen);
  composerOpenRef.current = composerOpen;

  const load = useCallback(async () => {
    const [tipsData, reviewsData, groupsData] = await Promise.all([
      communityHubService.getTips().catch(() => []),
      communityHubService.getReviews().catch(() => []),
      communityHubService.getGroups().catch(() => []),
    ]);
    setTips(tipsData as unknown as Tip[]);
    setReviews(reviewsData as unknown as Review[]);
    setGroups(groupsData as unknown as Group[]);
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
    api
      .get<Poi[]>("/tourism/pois")
      .then(setPois)
      .catch(() => setPois([]));
  }, [load]);

  // Live feed: other people's posts, likes and comments appear without a
  // manual reload. Previously the page fetched once on mount and never again.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!composerOpenRef.current) void load();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // ─── Search (the box used to filter nothing at all) ──────
  const query = searchQuery.trim().toLowerCase();
  const matches = (...fields: Array<string | undefined>) =>
    !query || fields.some((f) => (f ?? "").toLowerCase().includes(query));

  const visibleTips = useMemo(
    () => tips.filter((t) => matches(t.title, t.content, t.userName, t.category)),
    [tips, query],
  );
  const visibleReviews = useMemo(
    () => reviews.filter((r) => matches(r.title, r.content, r.placeName, r.userName)),
    [reviews, query],
  );
  const visibleGroups = useMemo(
    () => groups.filter((g) => matches(g.name, g.description, g.tags.join(" "))),
    [groups, query],
  );

  // ─── Engagement patching ─────────────────────────────────
  const patchTip = (id: string, engagement: Engagement) =>
    setTips((current) => current.map((t) => (t.id === id ? { ...t, engagement } : t)));
  const patchReview = (id: string, engagement: Engagement) =>
    setReviews((current) => current.map((r) => (r.id === id ? { ...r, engagement } : r)));

  const bumpComments = (targetType: ReactionTarget, id: string, delta: number) => {
    const apply = (item: Engaged) => ({
      ...item,
      engagement: {
        ...item.engagement,
        comments: Math.max(0, item.engagement.comments + delta),
      },
    });
    if (targetType === "tip") {
      setTips((current) => current.map((t) => (t.id === id ? (apply(t) as Tip) : t)));
    } else {
      setReviews((current) => current.map((r) => (r.id === id ? (apply(r) as Review) : r)));
    }
  };

  // ─── Composers ───────────────────────────────────────────
  const requireAuth = () => {
    if (!signedIn) {
      toast.error("Sign in to post to the community.");
      return false;
    }
    return true;
  };

  const submitTip = async () => {
    if (!requireAuth()) return;
    if (!tipForm.title.trim() || !tipForm.content.trim()) {
      toast.error("Add a title and some detail.");
      return;
    }
    setSubmitting(true);
    try {
      await communityHubService.submitTip(tipForm as never);
      setTipForm({ title: "", content: "", category: "travel_tip" });
      setComposer("none");
      toast.success("Tip published.");
      await load();
      setActiveTab("tips");
    } catch (error) {
      toast.error((error as Error).message || "Could not publish your tip.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitReview = async () => {
    if (!requireAuth()) return;
    const place = pois.find((p) => p.id === reviewForm.placeId);
    if (!place) {
      toast.error("Pick a place to review.");
      return;
    }
    if (reviewForm.title.trim().length < 3 || reviewForm.content.trim().length < 10) {
      toast.error("Add a short title and at least a sentence.");
      return;
    }
    setSubmitting(true);
    try {
      await communityHubService.submitReview({
        placeId: place.id,
        placeName: place.name,
        rating: reviewForm.rating,
        title: reviewForm.title.trim(),
        content: reviewForm.content.trim(),
      } as never);
      setReviewForm({ placeId: "", rating: 5, title: "", content: "" });
      setComposer("none");
      // The API updates an existing review rather than stacking a second one
      // for the same place, so this is deliberately not "posted".
      toast.success("Your review is saved.");
      await load();
      setActiveTab("reviews");
    } catch (error) {
      toast.error((error as Error).message || "Could not save your review.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitGroup = async () => {
    if (!requireAuth()) return;
    if (!groupForm.name.trim() || !groupForm.description.trim()) {
      toast.error("Give the group a name and a description.");
      return;
    }
    setSubmitting(true);
    try {
      await communityHubService.createGroup({
        name: groupForm.name.trim(),
        description: groupForm.description.trim(),
        tags: groupForm.tags
          .split(",")
          .map((t) => t.trim().replace(/^#/, ""))
          .filter(Boolean),
        isPublic: true,
      } as never);
      setGroupForm({ name: "", description: "", tags: "" });
      setComposer("none");
      toast.success("Group created — you're the admin.");
      await load();
      setActiveTab("groups");
    } catch (error) {
      toast.error((error as Error).message || "Could not create the group.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMembership = async (group: Group) => {
    if (!requireAuth()) return;
    try {
      const result = group.joined
        ? await communityHubService.leaveGroup(group.id)
        : await communityHubService.joinGroup(group.id);
      setGroups((current) =>
        current.map((g) =>
          g.id === group.id ? { ...g, joined: result.joined, memberCount: result.memberCount } : g,
        ),
      );
      toast.success(result.joined ? `Joined ${group.name}.` : `Left ${group.name}.`);
    } catch (error) {
      toast.error((error as Error).message || "Could not update your membership.");
    }
  };

  const threadKey = (type: ReactionTarget, id: string) => `${type}:${id}`;

  return (
    <section className="nexus-page nexus-page-body">
      <div className="nexus-container">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <p className="nexus-eyebrow">Community Hub</p>
          <h1 className="text-hero-display mt-4 text-5xl sm:text-6xl">
            Powered by <span className="nexus-gradient-text">Travelers</span>
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-slate-400">
            Share tips, review places, join travel groups, and connect with fellow explorers.
          </p>
        </motion.div>

        {/* Search + composer triggers */}
        <div className="mx-auto mt-8 max-w-3xl">
          <div className="flex flex-wrap gap-3">
            <div className="nexus-card flex min-w-[240px] flex-1 items-center gap-3 px-4">
              <Search className="text-slate-400" size={18} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tips, reviews, groups…"
                className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} aria-label="Clear search" className="text-slate-500 hover:text-white">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {([
              { id: "tip", label: "Share a tip", icon: MessageCircle },
              { id: "review", label: "Write a review", icon: Star },
              { id: "group", label: "Create a group", icon: Users },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setComposer(composer === id ? "none" : id)}
                className={composer === id ? "nexus-button-primary nexus-button-sm" : "nexus-button-secondary nexus-button-sm"}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Composers */}
        {composer === "tip" && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="nexus-card mx-auto mt-4 max-w-3xl p-6">
            <h3 className="text-lg font-semibold text-white">Share a travel tip</h3>
            <div className="mt-4 space-y-3">
              <input
                value={tipForm.title}
                onChange={(e) => setTipForm({ ...tipForm, title: e.target.value })}
                placeholder="Tip title"
                className="nexus-input"
              />
              <textarea
                value={tipForm.content}
                onChange={(e) => setTipForm({ ...tipForm, content: e.target.value })}
                placeholder="Share what you learned…"
                className="nexus-input"
                rows={4}
              />
              <select
                value={tipForm.category}
                onChange={(e) => setTipForm({ ...tipForm, category: e.target.value })}
                className="nexus-input"
              >
                <option value="travel_tip">Travel tip</option>
                <option value="road_report">Road report</option>
                <option value="scam_alert">Scam alert</option>
                <option value="recommendation">Recommendation</option>
              </select>
              <button onClick={() => void submitTip()} disabled={submitting} className="nexus-button-primary nexus-button-block">
                {submitting ? "Publishing…" : "Publish tip"}
              </button>
            </div>
          </motion.div>
        )}

        {composer === "review" && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="nexus-card mx-auto mt-4 max-w-3xl p-6">
            <h3 className="text-lg font-semibold text-white">Write a review</h3>
            <p className="mt-1 text-sm text-slate-400">
              One review per place — posting again updates the one you already wrote.
            </p>
            <div className="mt-4 space-y-3">
              <select
                value={reviewForm.placeId}
                onChange={(e) => setReviewForm({ ...reviewForm, placeId: e.target.value })}
                className="nexus-input"
              >
                <option value="">Choose a place…</option>
                {pois.map((poi) => (
                  <option key={poi.id} value={poi.id}>
                    {poi.name}
                    {poi.city ? ` — ${poi.city}` : ""}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">Rating</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                    className={star <= reviewForm.rating ? "text-[#ffd60a]" : "text-slate-600"}
                  >
                    <Star size={22} fill={star <= reviewForm.rating ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>

              <input
                value={reviewForm.title}
                onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                placeholder="Review title"
                className="nexus-input"
              />
              <textarea
                value={reviewForm.content}
                onChange={(e) => setReviewForm({ ...reviewForm, content: e.target.value })}
                placeholder="What was it like?"
                className="nexus-input"
                rows={4}
              />
              <button onClick={() => void submitReview()} disabled={submitting} className="nexus-button-primary nexus-button-block">
                {submitting ? "Saving…" : "Save review"}
              </button>
            </div>
          </motion.div>
        )}

        {composer === "group" && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="nexus-card mx-auto mt-4 max-w-3xl p-6">
            <h3 className="text-lg font-semibold text-white">Create a travel group</h3>
            <div className="mt-4 space-y-3">
              <input
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                placeholder="Group name"
                className="nexus-input"
              />
              <textarea
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                placeholder="What is this group for?"
                className="nexus-input"
                rows={3}
              />
              <input
                value={groupForm.tags}
                onChange={(e) => setGroupForm({ ...groupForm, tags: e.target.value })}
                placeholder="Tags, comma separated — hiking, north, budget"
                className="nexus-input"
              />
              <button onClick={() => void submitGroup()} disabled={submitting} className="nexus-button-primary nexus-button-block">
                {submitting ? "Creating…" : "Create group"}
              </button>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="mt-10 flex flex-wrap gap-2 border-b border-white/[0.06] pb-2">
          {([
            { id: "tips", label: "Travel Tips", icon: MessageCircle, count: visibleTips.length },
            { id: "reviews", label: "Reviews", icon: Star, count: visibleReviews.length },
            { id: "groups", label: "Groups", icon: Users, count: visibleGroups.length },
          ] as const).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <Icon size={16} />
                {tab.label}
                <span className="tabular-nums text-xs text-slate-500">{tab.count}</span>
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <LoaderCircle size={36} className="animate-spin text-[#64d2ff]" />
          </div>
        )}

        {/* Tips */}
        {!loading && activeTab === "tips" && (
          <div className="mt-6 grid items-start gap-4 sm:grid-cols-2">
            {visibleTips.map((tip) => {
              const key = threadKey("tip", tip.id);
              return (
                <article key={tip.id} className="nexus-card-elevated p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-sm font-semibold text-white">
                        {tip.userName.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{tip.userName}</p>
                        <p className="text-xs text-slate-500">{timeAgo(tip.createdAt)}</p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-purple-400/15 px-2.5 py-1 text-xs capitalize text-purple-300">
                      {tip.category.replace("_", " ")}
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-semibold text-white">{tip.title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">{tip.content}</p>

                  <EngagementBar
                    targetType="tip"
                    item={tip}
                    signedIn={signedIn}
                    onChange={patchTip}
                    openComments={openThread === key}
                    onToggleComments={() => setOpenThread(openThread === key ? null : key)}
                  />

                  {openThread === key && (
                    <CommentThread
                      targetType="tip"
                      targetId={tip.id}
                      signedIn={signedIn}
                      onCountChange={(d) => bumpComments("tip", tip.id, d)}
                    />
                  )}
                </article>
              );
            })}

            {visibleTips.length === 0 && (
              <p className="nexus-card col-span-full p-10 text-center text-slate-400">
                {query ? "No tips match that search." : "No tips yet — share the first one."}
              </p>
            )}
          </div>
        )}

        {/* Reviews */}
        {!loading && activeTab === "reviews" && (
          <div className="mt-6 grid items-start gap-4 sm:grid-cols-2">
            {visibleReviews.map((review) => {
              const key = threadKey("review", review.id);
              return (
                <article key={review.id} className="nexus-card-elevated p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-sm font-semibold text-white">
                        {review.userName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold text-white">
                          {review.userName}
                          {review.mine && (
                            <span className="rounded-full bg-[#0a84ff]/20 px-2 py-0.5 text-[11px] font-medium text-[#9addff]">
                              You
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {review.placeName} · {timeAgo(review.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5 text-[#ffd60a]">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={13}
                          fill={star <= review.rating ? "currentColor" : "none"}
                          className={star <= review.rating ? "" : "text-slate-600"}
                        />
                      ))}
                    </div>
                  </div>

                  <h3 className="mt-3 text-base font-semibold text-white">{review.title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">{review.content}</p>

                  <EngagementBar
                    targetType="review"
                    item={review}
                    signedIn={signedIn}
                    onChange={patchReview}
                    openComments={openThread === key}
                    onToggleComments={() => setOpenThread(openThread === key ? null : key)}
                  />

                  {openThread === key && (
                    <CommentThread
                      targetType="review"
                      targetId={review.id}
                      signedIn={signedIn}
                      onCountChange={(d) => bumpComments("review", review.id, d)}
                    />
                  )}
                </article>
              );
            })}

            {visibleReviews.length === 0 && (
              <p className="nexus-card col-span-full p-10 text-center text-slate-400">
                {query ? "No reviews match that search." : "No reviews yet — write the first one."}
              </p>
            )}
          </div>
        )}

        {/* Groups */}
        {!loading && activeTab === "groups" && (
          <div className="mt-6 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleGroups.map((group) => (
              <article key={group.id} className="nexus-card-elevated flex flex-col p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-b from-[#3aa0ff] to-[#0a84ff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                    <Users size={22} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-white">{group.name}</h3>
                    <p className="text-xs tabular-nums text-slate-500">
                      {group.memberCount.toLocaleString()} member{group.memberCount === 1 ? "" : "s"}
                      {group.isOwner && " · you created this"}
                    </p>
                  </div>
                </div>

                <p className="mt-3 line-clamp-3 flex-1 text-sm text-slate-400">{group.description}</p>

                {group.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {group.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-slate-400">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => void toggleMembership(group)}
                  className={`mt-4 w-full ${group.joined ? "nexus-button-secondary" : "nexus-button-primary"}`}
                >
                  <UserPlus size={15} />
                  {group.joined ? "Leave group" : "Join group"}
                </button>
              </article>
            ))}

            {visibleGroups.length === 0 && (
              <p className="nexus-card col-span-full p-10 text-center text-slate-400">
                {query ? "No groups match that search." : "No groups yet — create the first one."}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default CommunityHub;
