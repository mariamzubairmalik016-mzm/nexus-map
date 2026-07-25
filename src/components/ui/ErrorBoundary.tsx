import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

/**
 * Catches render/lifecycle errors so one broken subtree cannot unmount the
 * whole application.
 *
 * Without a boundary, a single throw — a provider returning a record with no
 * coordinates, a map library rejecting a bad value — unmounts everything below
 * the router and the user gets a blank page with the failure only visible in
 * the console. React itself asks for this ("Consider adding an error boundary").
 *
 * Use it twice, deliberately:
 *   - once at the top of the app, as the last line of defence
 *   - around genuinely risky subtrees (the map), so a failure there degrades to
 *     an inline message while the rest of the page keeps working
 *
 * The message shown to users is always plain. Technical detail is rendered in
 * development only — never in a production bundle, where a stack can leak file
 * paths and internals.
 */

type Props = {
  children: ReactNode;
  /** Names the area in the fallback, e.g. "map". Keeps the copy specific. */
  label?: string;
  /** Replaces the default fallback entirely when supplied. */
  fallback?: (reset: () => void) => ReactNode;
  /** Compact styling for a boundary nested inside a page. */
  inline?: boolean;
};

type State = { error: Error | null };

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Development only: a stack in a production console is noise to the user
    // and useful detail to an attacker. Real reporting would hook in here.
    if (import.meta.env.DEV) {
      console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info.componentStack);
    }
  }

  private reset = () => this.setState({ error: null });

  private reload = () => window.location.reload();

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(this.reset);

    const what = this.props.label ? `the ${this.props.label}` : "this page";

    return (
      <div
        role="alert"
        className={
          this.props.inline
            ? "flex h-full min-h-[320px] w-full items-center justify-center p-6"
            : "flex min-h-[60vh] w-full items-center justify-center p-6"
        }
      >
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-2xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <AlertTriangle size={22} className="text-amber-300" />
          </div>

          <h2 className="text-lg font-medium text-white">Something went wrong loading {what}</h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            The rest of Nexus Map is still working. You can try again, or reload if the problem
            continues.
          </p>

          {/* Detail is developer-facing and stripped from production builds. */}
          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-xl bg-black/40 p-3 text-left text-[11px] leading-5 text-amber-200/80">
              {error.message}
            </pre>
          )}

          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.reset}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/90 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
            >
              <RotateCcw size={15} /> Try again
            </button>
            <button
              type="button"
              onClick={this.reload}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
            >
              <RefreshCw size={15} /> Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
