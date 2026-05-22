import { useState } from "react";
import { Link2, Loader2, Check, X, ExternalLink } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Props {
  movieId: number;
  movieTitle: string;
  currentTmdbId: number | null;
  onLinked: (poster: string, tmdbId: number) => void;
}

export default function TmdbLinker({ movieId, movieTitle, currentTmdbId, onLinked }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<{ poster: string; title: string; id: number } | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [isFetching, setIsFetching] = useState(false);

  // Parse TMDB ID from URL or raw number
  function parseTmdbId(val: string): number | null {
    const trimmed = val.trim();
    // URL: https://www.themoviedb.org/movie/12345 or https://www.themoviedb.org/movie/12345-title
    const urlMatch = trimmed.match(/themoviedb\.org\/movie\/(\d+)/);
    if (urlMatch) return parseInt(urlMatch[1]);
    // Raw number
    if (/^\d+$/.test(trimmed)) return parseInt(trimmed);
    return null;
  }

  async function handleLookup() {
    const id = parseTmdbId(input);
    if (!id) {
      setFetchError("Paste a TMDB URL (themoviedb.org/movie/…) or just the numeric ID");
      return;
    }
    setFetchError("");
    setIsFetching(true);
    setPreview(null);
    try {
      const res = await apiRequest("GET", `/api/tmdb/movie/${id}`);
      const data = await res.json();
      if (data.found && data.poster) {
        setPreview({ poster: data.poster, title: data.title, id: data.id });
      } else {
        setFetchError("No poster found for that ID. Try a different one.");
      }
    } catch {
      setFetchError("Failed to fetch. Check the ID and try again.");
    } finally {
      setIsFetching(false);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!preview) return;
      return apiRequest("PATCH", `/api/movies/${movieId}`, {
        posterPath: preview.poster,
        tmdbId: preview.id,
      }).then(r => r.json());
    },
    onSuccess: () => {
      if (preview) {
        onLinked(preview.poster, preview.id);
        queryClient.invalidateQueries({ queryKey: ["/api/movies"] });
      }
      setOpen(false);
      setInput("");
      setPreview(null);
    },
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors mt-1"
        title="Link to TMDB to get poster"
        data-testid={`tmdb-link-${movieId}`}
      >
        <Link2 size={11} />
        {currentTmdbId ? "Change poster" : "Link to TMDB"}
      </button>
    );
  }

  return (
    <div className="mt-2 p-3 rounded-lg border border-border bg-muted/30 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Link to TMDB</p>
        <button onClick={() => { setOpen(false); setPreview(null); setInput(""); setFetchError(""); }}>
          <X size={13} className="text-muted-foreground hover:text-foreground" />
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Find <strong className="text-foreground">{movieTitle}</strong> on{" "}
        <a
          href={`https://www.themoviedb.org/search?query=${encodeURIComponent(movieTitle)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline inline-flex items-center gap-0.5"
        >
          themoviedb.org <ExternalLink size={10} />
        </a>
        , then paste the URL or ID below.
      </p>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => { setInput(e.target.value); setFetchError(""); setPreview(null); }}
          onKeyDown={e => e.key === "Enter" && handleLookup()}
          placeholder="themoviedb.org/movie/12345 or just 12345"
          className="h-8 text-xs flex-1"
          data-testid={`tmdb-input-${movieId}`}
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={handleLookup}
          disabled={isFetching || !input.trim()}
          className="h-8 px-3 text-xs"
          data-testid={`tmdb-lookup-${movieId}`}
        >
          {isFetching ? <Loader2 size={12} className="animate-spin" /> : "Look up"}
        </Button>
      </div>

      {fetchError && <p className="text-[11px] text-destructive">{fetchError}</p>}

      {preview && (
        <div className="flex items-center gap-3 p-2 rounded border border-border bg-background">
          <img
            src={preview.poster}
            alt={preview.title}
            className="w-10 h-14 object-cover rounded flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{preview.title}</p>
            <p className="text-[10px] text-muted-foreground">TMDB ID: {preview.id}</p>
          </div>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="h-7 text-xs gap-1"
            data-testid={`tmdb-save-${movieId}`}
          >
            {saveMutation.isPending
              ? <Loader2 size={11} className="animate-spin" />
              : <><Check size={11} /> Use this</>
            }
          </Button>
        </div>
      )}
    </div>
  );
}
