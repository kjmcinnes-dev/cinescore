import { Link, useLocation } from "wouter";
import { Film, List, Star, Sun, Moon, BarChart2 } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { Button } from "@/components/ui/button";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <svg viewBox="0 0 32 32" width="28" height="28" fill="none" aria-label="CineScore">
                {/* Film reel icon */}
                <circle cx="16" cy="16" r="13" stroke="hsl(var(--primary))" strokeWidth="2"/>
                <circle cx="16" cy="16" r="5" fill="hsl(var(--primary))"/>
                <circle cx="16" cy="7" r="2" fill="hsl(var(--primary))"/>
                <circle cx="16" cy="25" r="2" fill="hsl(var(--primary))"/>
                <circle cx="7" cy="16" r="2" fill="hsl(var(--primary))"/>
                <circle cx="25" cy="16" r="2" fill="hsl(var(--primary))"/>
                <circle cx="10" cy="10" r="1.5" fill="hsl(var(--primary))"/>
                <circle cx="22" cy="10" r="1.5" fill="hsl(var(--primary))"/>
                <circle cx="10" cy="22" r="1.5" fill="hsl(var(--primary))"/>
                <circle cx="22" cy="22" r="1.5" fill="hsl(var(--primary))"/>
              </svg>
              <span className="font-bold text-lg" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                CineScore
              </span>
            </div>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            <Link href="/">
              <Button
                variant={location === "/" ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5"
                data-testid="nav-home"
              >
                <Star size={15} />
                <span className="hidden sm:inline">Rate</span>
              </Button>
            </Link>
            <Link href="/history">
              <Button
                variant={location === "/history" ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5"
                data-testid="nav-history"
              >
                <List size={15} />
                <span className="hidden sm:inline">My Ratings</span>
              </Button>
            </Link>
            <Link href="/stats">
              <Button
                variant={location === "/stats" ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5"
                data-testid="nav-stats"
              >
                <BarChart2 size={15} />
                <span className="hidden sm:inline">Stats</span>
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggle}
              data-testid="theme-toggle"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </Button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
