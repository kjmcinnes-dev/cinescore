import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BarChart2, Film, Star, TrendingUp, Calendar } from "lucide-react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

interface YearStat { year: number; avgScore: number; count: number; }
interface DecadeStat { decade: number; label: string; avgScore: number; count: number; }
interface StatsData { yearStats: YearStat[]; decadeStats: DecadeStat[]; total: number; }

function getBarColor(score: number): string {
  if (score >= 4.5) return "#22c55e";
  if (score >= 4.0) return "#84cc16";
  if (score >= 3.5) return "#a3e635";
  if (score >= 3.0) return "#eab308";
  if (score >= 2.5) return "#f97316";
  return "#ef4444";
}

function scoreLabel(score: number): string {
  if (score >= 4.5) return "Excellent";
  if (score >= 4.0) return "Great";
  if (score >= 3.5) return "Good";
  if (score >= 3.0) return "Average";
  if (score >= 2.5) return "Below avg";
  return "Poor";
}

function HorizontalBar({ value, max, color, label, count, sublabel }: {
  value: number; max: number; color: string; label: string; count: number; sublabel?: string;
}) {
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center gap-3 group">
      <div className="w-16 text-right flex-shrink-0">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {sublabel && <div className="text-[10px] text-muted-foreground/60">{sublabel}</div>}
      </div>
      <div className="flex-1 relative h-7 flex items-center">
        <div className="w-full h-full rounded bg-muted/40 overflow-hidden">
          <div
            className="h-full rounded transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.85 }}
          />
        </div>
        <div className="absolute left-2 flex items-center gap-1.5 pointer-events-none">
          <span className="text-xs font-bold" style={{ color: pct > 30 ? '#fff' : 'hsl(var(--foreground))' }}>
            {value.toFixed(2)}
          </span>
        </div>
        <div className="absolute right-2 text-[10px] text-muted-foreground">
          {count} film{count !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}

export default function Stats() {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<StatsData>({
    queryKey: ["/api/stats"],
    queryFn: () => apiRequest("GET", "/api/stats").then(r => r.json()),
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
          <div className="text-center py-20 text-muted-foreground">Loading stats...</div>
        </div>
      </Layout>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto text-center py-20">
          <BarChart2 size={48} className="text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">No ratings yet.</p>
        </div>
      </Layout>
    );
  }

  const { yearStats, decadeStats, total } = data;
  const maxYearScore = 5;
  const maxDecadeScore = 5;

  const overallAvg = yearStats.reduce((s, y) => s + y.avgScore * y.count, 0) / total;
  const bestYear = [...yearStats].sort((a, b) => b.avgScore - a.avgScore)[0];
  const bestDecade = [...decadeStats].sort((a, b) => b.avgScore - a.avgScore)[0];
  const mostActiveYear = [...yearStats].sort((a, b) => b.count - a.count)[0];

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Stats
          </h1>
          <p className="text-sm text-muted-foreground">Patterns across {total} rated films</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { icon: <Film size={15} />, label: "Films rated", value: String(total) },
            { icon: <Star size={15} />, label: "Overall avg", value: overallAvg.toFixed(2) },
            { icon: <Calendar size={15} />, label: "Best year", value: bestYear ? `${bestYear.year}` : "—", sub: bestYear ? `${bestYear.avgScore.toFixed(2)} avg` : "" },
            { icon: <TrendingUp size={15} />, label: "Most watched", value: mostActiveYear ? `${mostActiveYear.year}` : "—", sub: mostActiveYear ? `${mostActiveYear.count} films` : "" },
          ].map(card => (
            <Card key={card.label} className="border-border">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  {card.icon}
                  <span className="text-xs">{card.label}</span>
                </div>
                <div className="text-xl font-bold text-primary" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                  {card.value}
                </div>
                {card.sub && <div className="text-xs text-muted-foreground">{card.sub}</div>}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Avg Score by Year */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart2 size={15} className="text-primary" />
                Avg Score by Year
              </CardTitle>
              <p className="text-xs text-muted-foreground">Film release year</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {yearStats.map(y => (
                  <HorizontalBar
                    key={y.year}
                    label={String(y.year)}
                    value={y.avgScore}
                    max={maxYearScore}
                    color={getBarColor(y.avgScore)}
                    count={y.count}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Avg Score by Decade */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp size={15} className="text-primary" />
                Avg Score by Decade
              </CardTitle>
              <p className="text-xs text-muted-foreground">Films grouped by decade</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {decadeStats.map(d => (
                  <HorizontalBar
                    key={d.decade}
                    label={d.label}
                    value={d.avgScore}
                    max={maxDecadeScore}
                    color={getBarColor(d.avgScore)}
                    count={d.count}
                    sublabel={scoreLabel(d.avgScore)}
                  />
                ))}
              </div>

              {/* Decade score gradient legend */}
              <div className="mt-5 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Score key</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { color: "#22c55e", label: "4.5+" },
                    { color: "#84cc16", label: "4.0" },
                    { color: "#eab308", label: "3.0–3.5" },
                    { color: "#f97316", label: "2.5" },
                    { color: "#ef4444", label: "≤2.0" },
                  ].map(k => (
                    <div key={k.label} className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: k.color }} />
                      <span className="text-[10px] text-muted-foreground">{k.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Distribution bar */}
        <Card className="border-border mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const allScores = yearStats.flatMap(y =>
                Array(y.count).fill(y.avgScore)
              );
              const buckets: Record<string, number> = {
                "0.5–1.5": 0, "2.0–2.5": 0, "3.0–3.5": 0, "4.0–4.5": 0, "5.0": 0,
              };
              // We need actual individual scores - hit the movies endpoint
              return (
                <DistributionBar total={total} />
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function DistributionBar({ total }: { total: number }) {
  const { data: movies = [] } = useQuery<any[]>({
    queryKey: ["/api/movies"],
    queryFn: () => apiRequest("GET", "/api/movies").then(r => r.json()),
  });

  const buckets = [
    { label: "★★★★★ (5.0)", min: 5.0, max: 5.0, color: "#22c55e" },
    { label: "★★★★½ (4.5)", min: 4.5, max: 4.5, color: "#4ade80" },
    { label: "★★★★ (4.0)", min: 4.0, max: 4.0, color: "#84cc16" },
    { label: "★★★½ (3.5)", min: 3.5, max: 3.5, color: "#bef264" },
    { label: "★★★ (3.0)", min: 3.0, max: 3.0, color: "#eab308" },
    { label: "★★½ (2.5)", min: 2.5, max: 2.5, color: "#f97316" },
    { label: "★★ (2.0)", min: 2.0, max: 2.0, color: "#f87171" },
    { label: "★½ (1.5)", min: 1.5, max: 1.5, color: "#ef4444" },
    { label: "★ (1.0)", min: 0.5, max: 1.0, color: "#dc2626" },
  ];

  const counts = buckets.map(b => ({
    ...b,
    count: movies.filter(m => m.totalScore >= b.min && m.totalScore <= b.max).length,
  })).filter(b => b.count > 0);

  const maxCount = Math.max(...counts.map(c => c.count), 1);

  return (
    <div className="space-y-1.5">
      {counts.map(b => (
        <div key={b.label} className="flex items-center gap-3">
          <div className="w-28 text-right flex-shrink-0">
            <span className="text-xs text-muted-foreground">{b.label}</span>
          </div>
          <div className="flex-1 relative h-6 flex items-center">
            <div className="w-full h-full rounded bg-muted/30 overflow-hidden">
              <div
                className="h-full rounded transition-all duration-700"
                style={{ width: `${(b.count / maxCount) * 100}%`, backgroundColor: b.color, opacity: 0.8 }}
              />
            </div>
            <span className="absolute right-2 text-xs text-muted-foreground">{b.count}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
