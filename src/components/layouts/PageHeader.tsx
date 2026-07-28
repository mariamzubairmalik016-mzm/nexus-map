import type { ReactNode } from "react";

/**
 * Page title block — eyebrow, heading, supporting line, optional actions.
 *
 * The app had twelve different `<h1>` treatments for what is structurally the
 * same element: `mt-2` through `mt-12`, sizes from `text-3xl` to `text-6xl`,
 * some using `text-hero-display` and others plain `font-bold`. Headings landed
 * at a different height and weight on nearly every page.
 *
 * One size ladder here, tied to how far down the page sits:
 *   `hero`    — landing surfaces
 *   `default` — ordinary pages
 *   `compact` — dense/utility pages that lead with content, not a title
 *
 * `text-wrap: balance` keeps multi-line headings from leaving one orphan word.
 */
const PageHeader = ({
  eyebrow,
  title,
  description,
  actions,
  size = "default",
  align = "start",
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons/links sat beside the title on wide screens, below it on mobile. */
  actions?: ReactNode;
  size?: "hero" | "default" | "compact";
  align?: "start" | "center";
  className?: string;
}) => {
  const titleClass =
    size === "hero"
      ? "text-hero-display text-4xl sm:text-5xl lg:text-6xl"
      : size === "compact"
        ? "font-display text-2xl font-bold sm:text-3xl"
        : "text-hero-display text-3xl sm:text-4xl lg:text-5xl";

  const centered = align === "center";

  return (
    <header
      className={`flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between ${
        centered ? "text-center" : ""
      } ${className}`.trim()}
    >
      <div className={`min-w-0 ${centered ? "mx-auto" : ""}`}>
        {eyebrow ? <p className="nexus-eyebrow">{eyebrow}</p> : null}

        <h1
          className={`${titleClass} ${eyebrow ? "mt-3" : ""}`}
          style={{ textWrap: "balance" }}
        >
          {title}
        </h1>

        {description ? (
          /* ~65ch is the readable measure; the old `max-w-2xl`/`max-w-3xl`
             split was arbitrary. text-base rather than text-sm — supporting
             copy is body text, not a caption. */
          <p
            className={`mt-4 text-base leading-7 text-slate-400 ${
              centered ? "mx-auto" : ""
            }`}
            style={{ maxWidth: "65ch" }}
          >
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className={`flex flex-wrap gap-3 ${centered ? "justify-center" : "lg:shrink-0"}`}>
          {actions}
        </div>
      ) : null}
    </header>
  );
};

export default PageHeader;
