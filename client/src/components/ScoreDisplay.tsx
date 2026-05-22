// Circular score display
interface ScoreDisplayProps {
  actualScore: number;
  totalScore: number;
  size?: "sm" | "lg";
}

function getScoreColor(score: number): string {
  if (score >= 4.5) return "#22c55e";      // Green — excellent
  if (score >= 3.5) return "#84cc16";      // Yellow-green — good
  if (score >= 2.5) return "#eab308";      // Yellow — average
  if (score >= 1.5) return "#f97316";      // Orange — below average
  return "#ef4444";                         // Red — poor
}

function scoreToStars(score: number): string {
  if (score >= 4.75) return "★★★★★";
  if (score >= 4.25) return "★★★★½";
  if (score >= 3.75) return "★★★★";
  if (score >= 3.25) return "★★★½";
  if (score >= 2.75) return "★★★";
  if (score >= 2.25) return "★★½";
  if (score >= 1.75) return "★★";
  if (score >= 1.25) return "★½";
  return "★";
}

export default function ScoreDisplay({ actualScore, totalScore, size = "sm" }: ScoreDisplayProps) {
  const color = getScoreColor(totalScore);
  const pct = (totalScore / 5) * 100;
  const radius = size === "lg" ? 44 : 28;
  const stroke = size === "lg" ? 5 : 4;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center gap-1" data-testid="score-display">
      <div className="relative score-ring">
        <svg
          width={size === "lg" ? 108 : 68}
          height={size === "lg" ? 108 : 68}
          viewBox={`0 0 ${(radius + stroke) * 2 + 4} ${(radius + stroke) * 2 + 4}`}
        >
          <circle
            cx={(radius + stroke) + 2}
            cy={(radius + stroke) + 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
          />
          <circle
            cx={(radius + stroke) + 2}
            cy={(radius + stroke) + 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${(radius + stroke) + 2} ${(radius + stroke) + 2})`}
            style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
          <text
            x="50%"
            y="50%"
            dominantBaseline="middle"
            textAnchor="middle"
            fontSize={size === "lg" ? "22" : "14"}
            fontWeight="700"
            fill={color}
            fontFamily="'Cabinet Grotesk', sans-serif"
          >
            {totalScore.toFixed(1)}
          </text>
          <text
            x="50%"
            y={size === "lg" ? "68%" : "70%"}
            dominantBaseline="middle"
            textAnchor="middle"
            fontSize={size === "lg" ? "11" : "8"}
            fill="hsl(var(--muted-foreground))"
            fontFamily="'Satoshi', sans-serif"
          >
            /5
          </text>
        </svg>
      </div>
      {size === "lg" && (
        <div className="text-center">
          <div className="text-xl" style={{ color, letterSpacing: "0.1em" }}>
            {scoreToStars(totalScore)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            raw: {actualScore.toFixed(3)}
          </div>
        </div>
      )}
    </div>
  );
}
