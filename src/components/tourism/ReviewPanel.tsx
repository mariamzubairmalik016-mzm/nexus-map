"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, Star } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import toast from "react-hot-toast";

type Review = {
  id: string;
  userId: string;
  userName: string;
  placeId: string;
  rating: number;
  title: string;
  content: string;
  createdAt?: string;
};

/**
 * Reviews for a place — read and write.
 *
 * The POST endpoint existed but nothing in the app ever called it, so the
 * `tourism_reviews` table stayed empty and the community pages fell back to
 * invented posts. There was no way for a real person to leave a review at all.
 *
 * Ratings shown here are computed from the rows that exist. When there are
 * none it says so, rather than displaying a placeholder score.
 */

const StarRow = ({
  value,
  onChange,
  size = 18,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) => (
  <div className="flex items-center gap-1" role={onChange ? "radiogroup" : undefined} aria-label={onChange ? "Rating" : undefined}>
    {[1, 2, 3, 4, 5].map((star) => {
      const filled = star <= value;
      const icon = (
        <Star
          size={size}
          className={filled ? "fill-amber-400 text-amber-400" : "text-slate-600"}
          aria-hidden="true"
        />
      );
      return onChange ? (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          onClick={() => onChange(star)}
          /* 44px target: these sit close together and are easy to mis-tap. */
          className="flex h-11 w-11 items-center justify-center rounded-[var(--r-sm)] transition-transform hover:scale-110"
        >
          {icon}
        </button>
      ) : (
        <span key={star}>{icon}</span>
      );
    })}
  </div>
);

const ReviewPanel = ({ placeId, placeName }: { placeId: string; placeName: string }) => {
  const { data: session } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/community/reviews?placeId=${encodeURIComponent(placeId)}`);
      const payload = await response.json();
      setReviews(Array.isArray(payload?.data) ? payload.data : []);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Prefill when this person has already reviewed, so submitting edits their
  // own review instead of silently doing nothing.
  const mine = reviews.find((r) => r.userName === session?.user?.name);
  useEffect(() => {
    if (mine) {
      setRating(mine.rating);
      setTitle(mine.title);
      setContent(mine.content);
    }
  }, [mine?.id]);

  const average =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (rating < 1) return setError("Pick a rating from 1 to 5.");
    if (title.trim().length < 3) return setError("Give your review a short title.");
    if (content.trim().length < 10) return setError("Tell us a little more — at least 10 characters.");

    try {
      setSaving(true);
      const response = await fetch("/api/community/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, placeName, rating, title: title.trim(), content: content.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.message || "Could not post your review.");

      toast.success(payload.meta?.updated ? "Your review was updated." : "Thanks for your review.");
      await load();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not post your review.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="nexus-card p-5 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold">Reviews</h3>
        {average !== null ? (
          <div className="flex items-center gap-2">
            <StarRow value={Math.round(average)} size={15} />
            <span className="text-sm text-slate-400" style={{ fontVariantNumeric: "tabular-nums" }}>
              {average.toFixed(1)} · {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
            </span>
          </div>
        ) : (
          <span className="text-sm text-slate-500">No reviews yet</span>
        )}
      </header>

      {session?.user ? (
        <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
          {error && (
            <p role="alert" className="rounded-[var(--r-sm)] border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-300">Your rating</span>
            <StarRow value={rating} onChange={setRating} />
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sum it up in a few words"
            maxLength={120}
            className="nexus-input"
          />

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={`What was ${placeName} like?`}
            className="nexus-input"
          />

          <button disabled={saving} className="nexus-button-primary nexus-button-sm">
            {saving && <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />}
            {saving ? "Posting…" : mine ? "Update review" : "Post review"}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-slate-400">
          <Link href="/login" className="text-cyan-300 underline-offset-4 hover:underline">
            Sign in
          </Link>{" "}
          to leave a review.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {loading && (
          <div className="flex justify-center py-6" role="status" aria-label="Loading reviews">
            <LoaderCircle size={22} className="animate-spin text-cyan-400" />
          </div>
        )}

        {!loading &&
          reviews.map((review) => (
            <article key={review.id} className="rounded-[var(--r-md)] border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">{review.userName}</span>
                <StarRow value={review.rating} size={14} />
              </div>
              <h4 className="mt-2 font-medium">{review.title}</h4>
              <p className="mt-1 text-sm leading-6 text-slate-400">{review.content}</p>
              {review.createdAt && (
                <time dateTime={review.createdAt} className="mt-2 block text-xs text-slate-500">
                  {new Date(review.createdAt).toLocaleDateString()}
                </time>
              )}
            </article>
          ))}

        {!loading && reviews.length === 0 && (
          <p className="rounded-[var(--r-md)] border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
            Be the first to review {placeName}.
          </p>
        )}
      </div>
    </section>
  );
};

export default ReviewPanel;
