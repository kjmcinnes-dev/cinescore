import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, Film, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

interface WatchlistMovie {
  title: string;
  year: number | null;
}

// Simple fuzzy search: score a movie title against a query
function scoreMatch(title: string, query: string): number {
  const t = title.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 80;
  // Word-by-word matching
  const words = q.split(/\s+/);
  const matched = words.filter(w => t.includes(w)).length;
  return (matched / words.length) * 60;
}

export default function Home() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch live watchlist from Letterboxd via backend
  // staleTime: 10 minutes so it doesn't re-fetch on every render
  // refetchOnWindowFocus: true so it updates when you open the app
  const { data: watchlistData, isLoading: watchlistLoading } = useQuery<{ movies: WatchlistMovie[]; count: number }>({
    queryKey: ["/api/watchlist"],
    queryFn: () => apiRequest("GET", "/api/watchlist").then(r => r.json()),
    staleTime: 10 * 60 * 1000,        // 10 minutes
    gcTime: 60 * 60 * 1000,           // keep in cache 1 hour
    refetchOnWindowFocus: true,        // refresh when tab becomes active
    refetchOnMount: true,
  });

  const watchlist: WatchlistMovie[] = watchlistData?.movies ?? [];

  // Instant local search through watchlist
  const results = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    return watchlist
      .map(m => ({ ...m, score: scoreMatch(m.title, q) }))
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (movie: WatchlistMovie) => {
    const params = new URLSearchParams({
      title: movie.title,
      ...(movie.year ? { year: String(movie.year) } : {}),
    });
    window.location.hash = `/rate?${params.toString()}`;
  };

  const handleManual = () => {
    if (!query.trim()) return;
    const params = new URLSearchParams({ title: query.trim() });
    window.location.hash = `/rate?${params.toString()}`;
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Rate a Movie
          </h1>
          <p className="text-muted-foreground">
            Search your watchlist, then score it across 9 weighted criteria.
          </p>
        </div>

        {/* Search box */}
        <div className="relative" data-testid="movie-search">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder={watchlistLoading ? "Loading your watchlist..." : `Search your ${watchlist.length} watchlist movies...`}
              className="pl-10 pr-4 h-12 text-base"
              data-testid="search-input"
              autoFocus
            />
          </div>

          {/* Dropdown results */}
          {showDropdown && query.trim().length > 1 && (
            <div
              ref={dropdownRef}
              className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-border bg-popover shadow-lg z-50 overflow-hidden"
              data-testid="search-dropdown"
            >
              {results.length === 0 && (
                <div className="p-4">
                  <p className="text-sm text-muted-foreground mb-3">Not in your watchlist — add it anyway:</p>
                  <Button onClick={handleManual} variant="secondary" size="sm" className="w-full" data-testid="add-manual">
                    <Film size={14} className="mr-2" />
                    Rate "{query}" manually
                  </Button>
                </div>
              )}

              {results.map((movie, i) => (
                <button
                  key={`${movie.title}-${movie.year}-${i}`}
                  onClick={() => { handleSelect(movie); setShowDropdown(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent text-left transition-colors border-b border-border last:border-0"
                  data-testid={`result-${i}`}
                >
                  <div className="w-10 h-14 bg-muted rounded flex items-center justify-center flex-shrink-0">
                    <Film size={16} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{movie.title}</p>
                    {movie.year && <p className="text-xs text-muted-foreground">{movie.year}</p>}
                  </div>
                </button>
              ))}

              {results.length > 0 && (
                <button
                  onClick={() => { handleManual(); setShowDropdown(false); }}
                  className="w-full px-4 py-2.5 text-xs text-muted-foreground hover:bg-accent text-left transition-colors"
                  data-testid="add-manual-bottom"
                >
                  + Rate "{query}" manually (not in watchlist)
                </button>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { n: "1", label: "Search", desc: `Search your ${watchlist.length}-film Letterboxd watchlist` },
            { n: "2", label: "Score", desc: "Rate 9 categories from ½ to 5 stars" },
            { n: "3", label: "Save", desc: "Your weighted score is calculated automatically" },
          ].map(s => (
            <Card key={s.n} className="border-border">
              <CardContent className="pt-5 pb-4">
                <div className="text-2xl font-bold text-primary mb-1" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{s.n}</div>
                <div className="font-semibold text-sm mb-0.5">{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.desc}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Scoring info */}
        <Card className="mt-6 border-border">
          <CardContent className="pt-5 pb-4">
            <h3 className="font-semibold text-sm mb-3">Scoring Formula</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
              <div className="flex items-center justify-between px-2 py-1.5 rounded bg-primary/10 border border-primary/20">
                <span className="font-medium text-primary">Overall Enjoyment</span>
                <span className="text-primary font-bold">×2 weight</span>
              </div>
              {["Story & Structure", "Direction", "Acting", "Visuals/Cinematography", "Sound & Music", "Emotional Impact", "Originality"].map(c => (
                <div key={c} className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/50">
                  <span className="text-muted-foreground">{c}</span>
                  <span className="text-muted-foreground">×1</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/30 border border-border">
                <span className="text-muted-foreground">Rewatchability</span>
                <span className="text-muted-foreground">×0.5 weight</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Score = (Enjoyment×2 + 7 categories×1 + Rewatch×0.5) ÷ 9.5, rounded to nearest ½
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
