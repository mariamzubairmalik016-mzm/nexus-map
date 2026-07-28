// Shared loading skeleton for App Router loading.tsx files. Uses the
// `nexus-shimmer` utility already defined in index.css so route transitions
// show a branded placeholder (and reserve layout space, avoiding CLS) instead
// of a flash of empty dark canvas.

type Props = {
  /** Show a large map-shaped block instead of the default card grid. */
  variant?: "page" | "map";
  label?: string;
};

const Bar = ({ className = "" }: { className?: string }) => (
  <div className={`nexus-shimmer rounded-xl bg-white/[0.05] ${className}`} />
);

export default function RouteSkeleton({ variant = "page", label = "Loading" }: Props) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="min-h-[calc(100dvh-80px)] px-4 py-8 sm:px-6 lg:px-8"
    >
      <span className="sr-only">{label}…</span>
      <div className="mx-auto max-w-7xl">
        <Bar className="h-9 w-64 max-w-full" />
        <Bar className="mt-4 h-4 w-96 max-w-full" />

        {variant === "map" ? (
          <Bar className="mt-8 h-[60vh] w-full rounded-[var(--r-xl)]" />
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Bar key={i} className="h-40 rounded-[var(--r-xl)]" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
