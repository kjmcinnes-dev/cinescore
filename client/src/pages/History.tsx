import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, Film, Pencil, Trash2, ChevronDown, ChevronUp, Star } from "lucide-react";
import Layout from "@/components/Layout";
import ScoreDisplay from "@/components/ScoreDisplay";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { posterUrl } from "@/lib/poster";
import TmdbLinker from "@/components/TmdbLinker";
import type { Movie } from "@shared/schema";

const CATEGORIES = [
  { key: "overallEnjoyment",  label: "Overall Enjoyment",       weight: "×2"   },
  { key: "storyStructure",    label: "Story & Structure",        weight: "×1"   },
  { key: "direction",         label: "Direction",                weight: "×1"   },
  { key: "acting",            label: "Acting",                   weight: "×1"   },
  { key: "visuals",           label: "Visuals",                  weight: "×1"   },
  { key: "soundMusic",        label: "Sound & Music",            weight: "×1"   },
  { key: "emotionalImpact",   label: "Emotional Impact",         weight: "×1"   },
  { key: "originality",       label: "Originality",              weight: "×1"   },
  { key: "rewatchability",    label: "Rewatchability",           weight: "×0.5" },
] as const;

function getScoreColor(score: number) {
  if (score >= 4.5) return "text-green-500";
  if (score >= 3.5) return "text-lime-500";
  if (score >= 2.5) return "text-yellow-500";
  if (score >= 1.5) return "text-orange-500";
  return "text-red-500";
}

function starsDisplay(score: number) {
  const full = Math.floor(score);
  const half = score % 1 >= 0.5;
  return "★".repeat(full) + (half ? "½" : "");
}

function MovieCard({ movie, onEdit, onDelete }: { movie: Movie; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [localPoster, setLocalPoster] = useState<string | null>(movie.posterPath ?? null);
  const ratedDate = new Date(movie.ratedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

  return (
    <Card className="border-border overflow-hidden" data-testid={`movie-card-${movie.id}`}>
      <CardContent className="p-0">
        <div className="flex items-start gap-3 p-4">
          {/* Poster */}
          <div className="flex-shrink-0">
            {posterUrl(localPoster) ? (
              <img
                src={posterUrl(localPoster)!}
                alt={movie.title}
                className="w-14 h-20 object-cover rounded shadow-sm"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-14 h-20 bg-muted rounded flex items-center justify-center">
                <Film size={20} className="text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3
                  className="font-bold text-base leading-tight truncate"
                  style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
                  data-testid={`title-${movie.id}`}
                >
                  {movie.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {movie.year && `${movie.year} · `}{ratedDate}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <ScoreDisplay actualScore={movie.actualScore} totalScore={movie.totalScore} size="sm" />
              </div>
            </div>

            {/* Star summary */}
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className={`text-base font-bold ${getScoreColor(movie.totalScore)}`}>
                {starsDisplay(movie.totalScore)}
              </span>
              {movie.overallEnjoyment != null ? (
                <span className="text-xs text-muted-foreground">
                  {movie.overallEnjoyment.toFixed(1)} enjoy · {movie.rewatchability!.toFixed(1)} rewatch
                </span>
              ) : (
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Letterboxd import</span>
              )}
            </div>
          </div>
        </div>

        {/* Expandable breakdown */}
        <div className="border-t border-border">
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:bg-accent transition-colors"
            data-testid={`expand-${movie.id}`}
          >
            <span>View breakdown</span>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {expanded && (
            <div className="px-4 pb-4 space-y-1.5 border-t border-border pt-3">
              {movie.overallEnjoyment == null ? (
                <p className="text-xs text-muted-foreground italic py-1">No detailed breakdown — imported from Letterboxd. Rate this film to add a full breakdown.</p>
              ) : (
                CATEGORIES.map(cat => {
                  const val = movie[cat.key as keyof Movie] as number | null;
                  if (val == null) return null;
                  return (
                    <div key={cat.key} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        {cat.label}
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{cat.weight}</Badge>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1 w-20 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${(val / 5) * 100}%`, transition: "width 0.3s ease" }}
                          />
                        </div>
                        <span className="font-semibold w-6 text-right">{val.toFixed(1)}</span>
                      </div>
                    </div>
                  );
                })
              )}
              {movie.notes && (
                <p className="text-xs text-muted-foreground italic mt-2 pt-2 border-t border-border">
                  "{movie.notes}"
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={onEdit} className="flex-1 text-xs" data-testid={`edit-${movie.id}`}>
                  <Pencil size={12} className="mr-1.5" />Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={onDelete} className="flex-1 text-xs" data-testid={`delete-${movie.id}`}>
                  <Trash2 size={12} className="mr-1.5" />Delete
                </Button>
              </div>
              <TmdbLinker
                movieId={movie.id}
                movieTitle={movie.title}
                currentTmdbId={movie.tmdbId ?? null}
                onLinked={(poster) => setLocalPoster(poster)}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type SortKey = "ratedAt" | "totalScore" | "title" | "year";

export default function History() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ratedAt");
  const [sortAsc, setSortAsc] = useState(false);

  const { data: movies = [], isLoading } = useQuery<Movie[]>({
    queryKey: ["/api/movies"],
    queryFn: () => apiRequest("GET", "/api/movies").then(r => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/movies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movies"] });
      toast({ title: "Deleted", description: "Rating removed." });
    },
  });

  // Filter + sort
  const filtered = movies
    .filter(m => m.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let diff = 0;
      if (sortKey === "ratedAt") diff = new Date(a.ratedAt).getTime() - new Date(b.ratedAt).getTime();
      else if (sortKey === "totalScore") diff = a.totalScore - b.totalScore;
      else if (sortKey === "title") diff = a.title.localeCompare(b.title);
      else if (sortKey === "year") diff = (a.year ?? 0) - (b.year ?? 0);
      return sortAsc ? diff : -diff;
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  // Stats
  const avgScore = movies.length ? movies.reduce((s, m) => s + m.totalScore, 0) / movies.length : 0;
  const topRated = [...movies].sort((a, b) => b.totalScore - a.totalScore)[0];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            My Ratings
          </h1>
          <Button onClick={() => navigate("/")} size="sm" data-testid="rate-new">
            <Star size={14} className="mr-1.5" />Rate a Movie
          </Button>
        </div>

        {/* Stats bar */}
        {movies.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card className="border-border">
              <CardContent className="pt-3 pb-3 text-center">
                <div className="text-xl font-bold text-primary" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{movies.length}</div>
                <div className="text-xs text-muted-foreground">Films rated</div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-3 pb-3 text-center">
                <div className="text-xl font-bold text-primary" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{avgScore.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">Avg score</div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-3 pb-3 text-center">
                <div className="text-xl font-bold text-primary truncate" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: "0.9rem" }}>
                  {topRated ? topRated.totalScore.toFixed(1) : "—"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {topRated ? topRated.title : "Top film"}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search + sort */}
        {movies.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter by title..."
                className="pl-9 h-9 text-sm"
                data-testid="filter-input"
              />
            </div>
            <div className="flex gap-1">
              {(["ratedAt", "totalScore", "title", "year"] as SortKey[]).map(key => (
                <Button
                  key={key}
                  variant={sortKey === key ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => toggleSort(key)}
                  className="text-xs px-2"
                  data-testid={`sort-${key}`}
                >
                  {key === "ratedAt" ? "Date" : key === "totalScore" ? "Score" : key === "title" ? "A–Z" : "Year"}
                  {sortKey === key && (sortAsc ? "↑" : "↓")}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* List */}
        {isLoading && (
          <div className="text-center py-16 text-muted-foreground">Loading...</div>
        )}

        {!isLoading && movies.length === 0 && (
          <div className="text-center py-16">
            <Film size={48} className="text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No movies rated yet.</p>
            <Button onClick={() => navigate("/")} data-testid="get-started">
              Rate your first movie
            </Button>
          </div>
        )}

        {!isLoading && filtered.length === 0 && movies.length > 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No matches for "{search}"
          </div>
        )}

        <div className="space-y-3">
          {filtered.map(movie => (
            <MovieCard
              key={movie.id}
              movie={movie}
              onEdit={() => navigate(`/rate/${movie.id}`)}
              onDelete={() => {
                if (confirm(`Delete rating for "${movie.title}"?`)) {
                  deleteMutation.mutate(movie.id);
                }
              }}
            />
          ))}
        </div>
      </div>
    </Layout>
  );
}
