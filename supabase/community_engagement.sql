-- Community engagement: per-user reactions and comments.
--
-- Before this, `community_tips.likes` and `tourism_reviews.likes` were bare
-- integer counters. Nothing recorded who had reacted, so the UI could not show
-- whether you had already liked something, un-liking was impossible, and a
-- single account could increment a counter without limit. These two tables
-- make the counts derivable from real rows.
--
-- `target_id` is polymorphic (a tip or a review), so it carries no foreign
-- key; the (target_type, target_id) pair identifies what was reacted to.

CREATE TABLE IF NOT EXISTS community_reactions (
  id         text PRIMARY KEY,
  target_type varchar(20) NOT NULL,          -- 'tip' | 'review'
  target_id   text        NOT NULL,
  user_id     text        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kind        varchar(20) NOT NULL,          -- 'like' | 'bookmark' | 'helpful'
  created_at  timestamp   NOT NULL DEFAULT now()
);

-- The uniqueness guarantee lives here rather than in the route handler: two
-- concurrent taps would both pass an application-level existence check.
CREATE UNIQUE INDEX IF NOT EXISTS community_reactions_unique_idx
  ON community_reactions (target_type, target_id, user_id, kind);

CREATE INDEX IF NOT EXISTS community_reactions_target_idx
  ON community_reactions (target_type, target_id);

CREATE TABLE IF NOT EXISTS community_comments (
  id         text PRIMARY KEY,
  target_type varchar(20) NOT NULL,
  target_id   text        NOT NULL,
  user_id     text        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  user_name   text        NOT NULL,          -- denormalised, as tips/reviews already do
  content     text        NOT NULL,
  created_at  timestamp   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_comments_target_idx
  ON community_comments (target_type, target_id);
