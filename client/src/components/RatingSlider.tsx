// Half-star rating input (0.5 – 5.0 in 0.5 steps)
interface RatingSliderProps {
  value: number;
  onChange: (val: number) => void;
  label: string;
  weight?: string;
  disabled?: boolean;
}

const STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export default function RatingSlider({ value, onChange, label, weight, disabled }: RatingSliderProps) {
  return (
    <div className="flex flex-col gap-1.5" data-testid={`rating-${label.toLowerCase().replace(/[\s/&]+/g, '-')}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {weight && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
              {weight}
            </span>
          )}
          <span className="text-sm font-bold w-8 text-right" style={{ color: value ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}>
            {value ? value.toFixed(1) : "—"}
          </span>
        </div>
      </div>

      {/* Star display */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(star => {
          const full = value >= star;
          const half = !full && value >= star - 0.5;
          return (
            <div key={star} className="relative flex" style={{ width: 28, height: 28 }}>
              {/* Full star click */}
              <button
                type="button"
                disabled={disabled}
                className="absolute inset-0 w-full h-full flex items-center justify-center"
                onClick={() => onChange(star)}
                aria-label={`Rate ${star} stars`}
                data-testid={`star-${star}-full`}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                  <polygon
                    points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                    fill={full ? "hsl(var(--primary))" : half ? "url(#half)" : "none"}
                    stroke={full || half ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <defs>
                    <linearGradient id="half" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="50%" stopColor="hsl(var(--primary))" />
                      <stop offset="50%" stopColor="transparent" />
                    </linearGradient>
                  </defs>
                </svg>
              </button>
              {/* Half star click (left half) */}
              <button
                type="button"
                disabled={disabled}
                className="absolute left-0 top-0 h-full"
                style={{ width: "50%", zIndex: 1 }}
                onClick={() => onChange(star - 0.5)}
                aria-label={`Rate ${star - 0.5} stars`}
                data-testid={`star-${star}-half`}
              />
            </div>
          );
        })}

        {/* Clear button */}
        {value > 0 && !disabled && (
          <button
            type="button"
            onClick={() => onChange(0)}
            className="ml-2 text-muted-foreground hover:text-foreground text-xs"
            data-testid="clear-rating"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
