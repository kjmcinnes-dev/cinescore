import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Film, Save, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import RatingSlider from "@/components/RatingSlider";
import ScoreDisplay from "@/components/ScoreDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { posterUrl } from "@/lib/poster";
import type { Movie } from "@shared/schema";

const CATEGORIES = [
  { key: "overallEnjoyment",  label: "Overall Enjoyment",     weight: "×2",   weightVal: 2 },
  { key: "storyStructure",    label: "Story & Structure",      weight: "×1",   weightVal: 1 },
  { key: "direction",         label: "Direction",              weight: "×1",   weightVal: 1 },
  { key: "acting",            label: "Acting",                 weight: "×1",   weightVal: 1 },
  { key: "visuals",           label: "Visuals / Cinematography", weight: "×1", weightVal: 1 },
  { key: "soundMusic",        label: "Sound & Music",          weight: "×1",   weightVal: 1 },
  { key: "emotionalImpact",   label: "Emotional Impact",       weight: "×1",   weightVal: 1 },
  { key: "originality",       label: "Originality",            weight: "×1",   weightVal: 1 },
  { key: "rewatchability",    label: "Rewatchability",         weight: "×0.5", weightVal: 0.5 },
] as const;

type RatingsState = Record<string, number>;

function computeScore(ratings: RatingsState) {
  const allFilled = CATEGORIES.every(c => ratings[c.key] > 0);
  if (!allFilled) return null;
  const weighted = CATEGORIES.reduce((sum, c) => sum + ratings[c.key] * c.weightVal, 0);
  const actualScore = weighted / 9.5;
  const totalScore = Math.round(actualScore * 2) / 2;
  return { actualScore, totalScore };
}

export default function RateMovie() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Parse query params from the hash (wouter puts full hash including ?query in location)
  const hashFull = window.location.hash || "";
  const qMark = hashFull.indexOf("?");
  const searchParams = new URLSearchParams(qMark >= 0 ? hashFull.slice(qMark + 1) : "");
  const titleParam = searchParams.get("title") || "";
  const yearParam = searchParams.get("year") ? parseInt(searchParams.get("year")!) : undefined;
  const tmdbIdParam = searchParams.get("tmdbId") ? parseInt(searchParams.get("tmdbId")!) : undefined;
  const posterParam = searchParams.get("poster") || undefined;

  const editId = params?.id ? parseInt(params.id) : undefined;

  // If editing, load existing data
  const { data: existingMovie } = useQuery<Movie>({
    queryKey: ["/api/movies", editId],
    queryFn: () => apiRequest("GET", `/api/movies/${editId}`).then(r => r.json()),
    enabled: !!editId,
  });

  const [title, setTitle] = useState(titleParam);
  const [year, setYear] = useState<number | undefined>(yearParam);
  const [poster, setPoster] = useState<string | undefined>(posterParam);
  const [notes, setNotes] = useState("");

  const initRatings: RatingsState = Object.fromEntries(CATEGORIES.map(c => [c.key, 0]));
  const [ratings, setRatings] = useState<RatingsState>(initRatings);

  // Populate from existing movie when editing
  useEffect(() => {
    if (existingMovie) {
      setTitle(existingMovie.title);
      setYear(existingMovie.year ?? undefined);
      setPoster(existingMovie.posterPath ?? undefined);
      setNotes(existingMovie.notes ?? "");
      setRatings({
        overallEnjoyment: existingMovie.overallEnjoyment,
        storyStructure: existingMovie.storyStructure,
        direction: existingMovie.direction,
        acting: existingMovie.acting,
        visuals: existingMovie.visuals,
        soundMusic: existingMovie.soundMusic,
        emotionalImpact: existingMovie.emotionalImpact,
        originality: existingMovie.originality,
        rewatchability: existingMovie.rewatchability,
      });
    }
  }, [existingMovie]);

  const score = computeScore(ratings);
  const filledCount = CATEGORIES.filter(c => ratings[c.key] > 0).length;
  const progress = filledCount / CATEGORIES.length;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!score) throw new Error("Please fill all ratings");
      const body = {
        title,
        year: year ?? null,
        tmdbId: tmdbIdParam ?? existingMovie?.tmdbId ?? null,
        posterPath: poster ?? existingMovie?.posterPath ?? null,
        overallEnjoyment: ratings.overallEnjoyment,
        storyStructure: ratings.storyStructure,
        direction: ratings.direction,
        acting: ratings.acting,
        visuals: ratings.visuals,
        soundMusic: ratings.soundMusic,
        emotionalImpact: ratings.emotionalImpact,
        originality: ratings.originality,
        rewatchability: ratings.rewatchability,
        actualScore: score.actualScore,
        totalScore: score.totalScore,
        notes: notes || null,
        ratedAt: new Date().toISOString(),
      };
      if (editId) {
        return apiRequest("PATCH", `/api/movies/${editId}`, body).then(r => r.json());
      }
      return apiRequest("POST", "/api/movies", body).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movies"] });
      toast({ title: editId ? "Rating updated!" : "Movie rated!", description: `${title} has been saved.` });
      navigate("/history");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          data-testid="back-button"
        >
          <ArrowLeft size={15} />
          Search again
        </button>

        {/* Movie header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="movie-poster-wrap flex-shrink-0">
            {poster ? (
              <img
                src={posterUrl(poster) || poster}
                alt={title}
                className="poster-img w-24 h-36 object-cover rounded-lg shadow-md"
                data-testid="movie-poster"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-24 h-36 bg-muted rounded-lg flex items-center justify-center shadow-md">
                <Film size={32} className="text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1
              className="text-xl font-bold leading-tight"
              style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
              data-testid="movie-title"
            >
              {title}
            </h1>
            {year && <p className="text-muted-foreground text-sm mt-0.5">{year}</p>}

            {/* Live score */}
            {score && (
              <div className="mt-3">
                <ScoreDisplay actualScore={score.actualScore} totalScore={score.totalScore} size="lg" />
              </div>
            )}
            {!score && (
              <div className="mt-3">
                <p className="text-sm text-muted-foreground">
                  {filledCount} / {CATEGORIES.length} categories rated
                </p>
                {/* Progress bar */}
                <div className="h-1.5 bg-muted rounded-full mt-1.5 w-40">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rating form */}
        <Card className="border-border" data-testid="rating-form">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Rate Each Category</CardTitle>
            <p className="text-xs text-muted-foreground">Click a star to rate. Click the left half for a half-star.</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-5">
              {CATEGORIES.map(cat => (
                <RatingSlider
                  key={cat.key}
                  label={cat.label}
                  weight={cat.weight}
                  value={ratings[cat.key]}
                  onChange={val => setRatings(prev => ({ ...prev, [cat.key]: val }))}
                />
              ))}
            </div>

            {/* Notes */}
            <div className="mt-6">
              <Label htmlFor="notes" className="text-sm font-medium">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any thoughts on this movie..."
                className="mt-1.5 text-sm resize-none"
                rows={3}
                data-testid="notes-input"
              />
            </div>

            {/* Save button */}
            <div className="mt-6 flex items-center gap-3">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!score || saveMutation.isPending || !title.trim()}
                className="flex-1"
                size="lg"
                data-testid="save-button"
              >
                {saveMutation.isPending ? (
                  <><Loader2 size={16} className="mr-2 animate-spin" />Saving...</>
                ) : (
                  <><Save size={16} className="mr-2" />{editId ? "Update Rating" : "Save Rating"}</>
                )}
              </Button>
              {score && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                    {score.totalScore.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">/ 5.0</div>
                </div>
              )}
            </div>

            {!score && filledCount < CATEGORIES.length && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                Rate all {CATEGORIES.length} categories to unlock your score
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
