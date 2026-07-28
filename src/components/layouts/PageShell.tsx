import type { ReactNode } from "react";

/**
 * Standard page wrapper — the shell every view sits inside.
 *
 * This replaces the wrapper that used to be retyped in each view:
 *
 *   <section className="min-h-[calc(100vh-80px)] px-4 py-14 sm:px-6 lg:px-8">
 *     <div className="mx-auto max-w-7xl">
 *
 * Retyping it let the pages drift — Dashboard settled on `py-8` while the rest
 * used `py-14`, and some views reached for `nexus-page` (which paints the page
 * gradient) while others skipped it, so the background changed as you moved
 * between them. Padding and max-width now come from tokens in `index.css`.
 *
 * `width` covers the three cases actually present in the app; `bleed` is for
 * the map, which needs the full viewport with no clamp.
 */
const PageShell = ({
  children,
  width = "default",
  bleed = false,
  gradient = true,
  className = "",
}: {
  children: ReactNode;
  /** default = 80rem (was max-w-7xl) · narrow = reading width · wide = data-dense */
  width?: "default" | "narrow" | "wide";
  /** Skip the width clamp and page padding entirely — full-bleed views. */
  bleed?: boolean;
  /** The ambient cyan/purple page glow. Turn off behind a live map. */
  gradient?: boolean;
  className?: string;
}) => {
  const widthClass =
    width === "narrow"
      ? "mx-auto w-full max-w-3xl"
      : width === "wide"
        ? "mx-auto w-full max-w-[96rem]"
        : "nexus-container";

  if (bleed) {
    return (
      <section className={`${gradient ? "nexus-page" : ""} ${className}`.trim()}>
        {children}
      </section>
    );
  }

  return (
    <section className={`${gradient ? "nexus-page" : ""} nexus-page-body ${className}`.trim()}>
      <div className={widthClass}>{children}</div>
    </section>
  );
};

export default PageShell;
