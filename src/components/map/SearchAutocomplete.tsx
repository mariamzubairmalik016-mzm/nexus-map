import { useEffect, useState } from "react";
import { LoaderCircle, MapPin, Search } from "lucide-react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { navigationApi } from "../../services/navigationApi";
import type {
  Coordinates,
  SearchSuggestion,
} from "../../types/navigation";

type Props = {
  label: string;
  value: string;
  placeholder: string;
  bias?: Coordinates | null;
  onChange: (value: string) => void;
  onSelect: (suggestion: SearchSuggestion) => void;
  accent?: "cyan" | "emerald" | "red";
};

const SearchAutocomplete = ({
  label,
  value,
  placeholder,
  bias,
  onChange,
  onSelect,
  accent = "cyan",
}: Props) => {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(value.trim(), 350);

  useEffect(() => {
    if (debounced.length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void navigationApi
      .search(debounced, bias)
      .then((items) => {
        if (!cancelled) {
          setSuggestions(items);
          setOpen(true);
        }
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bias, debounced]);

  const iconClass = {
    cyan: "text-cyan-400",
    emerald: "text-emerald-400",
    red: "text-red-400",
  }[accent];

  return (
    <label className="relative block">
      <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>

      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 focus-within:border-cyan-400/40">
        <Search size={18} className={iconClass} />

        <input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-4 text-sm outline-none"
        />

        {loading && (
          <LoaderCircle
            size={17}
            className="animate-spin text-slate-500"
          />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-[1000] mt-2 max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-[#08101f]/98 p-2 shadow-2xl backdrop-blur-2xl">
          {suggestions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelect(item);
                onChange(item.name);
                setOpen(false);
              }}
              className="flex w-full items-start gap-3 rounded-xl p-3 text-left transition hover:bg-white/5"
            >
              <MapPin
                size={18}
                className="mt-0.5 shrink-0 text-cyan-400"
              />

              <span className="min-w-0">
                <strong className="block truncate text-sm text-white">
                  {item.name}
                </strong>
                <span className="mt-1 block text-xs leading-5 text-slate-400">
                  {item.address}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </label>
  );
};

export default SearchAutocomplete;
