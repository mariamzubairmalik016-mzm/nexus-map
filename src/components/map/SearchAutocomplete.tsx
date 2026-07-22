import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Clock3, LoaderCircle, MapPin, Search, Star, WifiOff, X } from "lucide-react";

import {
  getIdleSuggestions,
  isSearchableQuery,
  rememberSearch,
  searchPlaces,
} from "../../services/placeSearchService";
import type { Coordinates, SearchSuggestion } from "../../types/navigation";

type Props = {
  label: string;
  value: string;
  placeholder: string;
  bias?: Coordinates | null;
  onChange: (value: string) => void;
  onSelect: (suggestion: SearchSuggestion) => void;
  accent?: "cyan" | "emerald" | "red";
  /** True once a suggestion has been picked; cleared as soon as text is edited. */
  selected?: boolean;
};

const DEBOUNCE_MS = 320;
const MIN_CHARS = 2;

/** Splits a label so the part matching the query can be highlighted. */
const highlight = (text: string, query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return [{ text, match: false }];

  const index = text.toLowerCase().indexOf(needle);
  if (index < 0) return [{ text, match: false }];

  return [
    { text: text.slice(0, index), match: false },
    { text: text.slice(index, index + needle.length), match: true },
    { text: text.slice(index + needle.length), match: false },
  ].filter((part) => part.text.length > 0);
};

const iconFor = (suggestion: SearchSuggestion) => {
  if (suggestion.provider === "saved") return Star;
  if (suggestion.id.startsWith("recent-")) return Clock3;
  return MapPin;
};

const SearchAutocomplete = ({
  label,
  value,
  placeholder,
  bias,
  onChange,
  onSelect,
  accent = "cyan",
  selected = false,
}: Props) => {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searched, setSearched] = useState(false);

  const listId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const skipNextSearch = useRef(false);

  const query = value.trim();

  // Depend on the bias VALUES, not the object identity — otherwise a parent
  // re-render (or a map pan) would restart every in-flight search.
  const biasLat = bias?.latitude;
  const biasLng = bias?.longitude;
  const biasRef = useRef(bias);
  biasRef.current = bias;

  // Debounced search with abort of any stale in-flight request.
  useEffect(() => {
    // A selection just filled the input — don't immediately search for it.
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }

    abortRef.current?.abort();

    if (query.length < MIN_CHARS || !isSearchableQuery(query)) {
      setSuggestions([]);
      setLoading(false);
      setError("");
      setSearched(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");

    const timer = window.setTimeout(() => {
      searchPlaces(query, biasRef.current, controller.signal)
        .then((outcome) => {
          if (controller.signal.aborted) return;
          setSuggestions(outcome.results);
          setOffline(outcome.offline);
          setSearched(true);
          setActiveIndex(-1);
          setOpen(true);
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted || (cause as Error)?.name === "AbortError") return;
          setSuggestions([]);
          setSearched(true);
          setError("Search is unavailable right now. Please try again.");
          setOpen(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [biasLat, biasLng, query]);

  // Abort any in-flight request when the component goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Close on an outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const showIdle = query.length < MIN_CHARS;

  const openWithIdle = useCallback(() => {
    setOpen(true);
    if (!showIdle) return;
    void getIdleSuggestions().then((items) => {
      setSuggestions(items);
      setActiveIndex(-1);
    });
  }, [showIdle]);

  const choose = useCallback(
    (suggestion: SearchSuggestion) => {
      skipNextSearch.current = true;
      // onChange FIRST, then onSelect. The parent treats every onChange as
      // manual editing and clears its confirmed selection, so calling it after
      // onSelect would immediately wipe the pick we just made.
      onChange(suggestion.displayName ?? suggestion.name);
      onSelect(suggestion);
      void rememberSearch(query || suggestion.name, suggestion);
      setOpen(false);
      setActiveIndex(-1);
    },
    [onChange, onSelect, query],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!open) {
        openWithIdle();
        return;
      }
      if (!suggestions.length) return;
      event.preventDefault();
      setActiveIndex((current) => {
        const next = event.key === "ArrowDown" ? current + 1 : current - 1;
        if (next < 0) return suggestions.length - 1;
        if (next >= suggestions.length) return 0;
        return next;
      });
      return;
    }

    if (event.key === "Enter") {
      if (open && activeIndex >= 0 && suggestions[activeIndex]) {
        event.preventDefault();
        choose(suggestions[activeIndex]);
      }
    }
  };

  const accentClass = { cyan: "text-cyan-400", emerald: "text-emerald-400", red: "text-red-400" }[accent];

  const emptyMessage = useMemo(() => {
    if (loading || error) return "";
    if (!searched || suggestions.length) return "";
    return offline
      ? "No offline results. Connect to search worldwide, or download this area first."
      : "No places found. Try a different spelling or add the city name.";
  }, [error, loading, offline, searched, suggestions.length]);

  const showPanel = open && (loading || Boolean(error) || Boolean(emptyMessage) || suggestions.length > 0);

  return (
    // `relative` + a high z-index on the panel keeps the list above the map
    // canvas; nothing in this subtree uses overflow-hidden, so it can't clip.
    <div ref={rootRef} className="relative">
      <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500" htmlFor={`${listId}-input`}>
        {label}
      </label>

      <div
        className={`flex items-center gap-3 rounded-2xl border bg-white/5 px-4 transition ${
          selected ? "border-emerald-400/40" : "border-white/10"
        } focus-within:border-cyan-400/40`}
      >
        <Search size={18} className={accentClass} />

        <input
          id={`${listId}-input`}
          ref={inputRef}
          value={value}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
          autoComplete="off"
          onChange={(event) => {
            // Typing invalidates any previous selection — the parent clears it.
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={openWithIdle}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-4 text-sm outline-none"
        />

        {loading && <LoaderCircle size={17} className="animate-spin text-slate-500" />}

        {!loading && value.length > 0 && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => {
              onChange("");
              setSuggestions([]);
              setSearched(false);
              inputRef.current?.focus();
            }}
            className="rounded-full p-1 text-slate-500 transition hover:text-white"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[1200] mt-2 max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-[#08101f]/98 p-2 shadow-2xl backdrop-blur-2xl"
        >
          {offline && suggestions.length > 0 && (
            <p className="flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-amber-300">
              <WifiOff size={12} /> Offline — saved and cached places
            </p>
          )}

          {showIdle && suggestions.length > 0 && !offline && (
            <p className="px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Saved places &amp; recent searches
            </p>
          )}

          {error && <p className="px-3 py-3 text-sm text-red-300">{error}</p>}

          {emptyMessage && <p className="px-3 py-3 text-sm leading-6 text-slate-400">{emptyMessage}</p>}

          {suggestions.map((item, index) => {
            const Icon = iconFor(item);
            const primary = item.name;
            const secondary = item.displayName && item.displayName !== primary ? item.displayName : item.address;

            return (
              <button
                key={item.id}
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                type="button"
                // mousedown fires before the input's blur, so the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition ${
                  index === activeIndex ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <Icon
                  size={18}
                  className={`mt-0.5 shrink-0 ${item.provider === "saved" ? "text-amber-300" : "text-cyan-400"}`}
                />

                <span className="min-w-0">
                  <strong className="block truncate text-sm font-medium text-white">
                    {highlight(primary, query).map((part, partIndex) => (
                      <span key={partIndex} className={part.match ? "text-cyan-300" : undefined}>
                        {part.text}
                      </span>
                    ))}
                  </strong>
                  {secondary && (
                    <span className="mt-1 block text-xs leading-5 text-slate-400">{secondary}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SearchAutocomplete;
