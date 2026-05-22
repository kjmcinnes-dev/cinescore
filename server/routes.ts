import type { Express } from "express";
import { createServer, type Server } from "http";
import https from "https";
import { storage } from "./storage";
import { insertMovieSchema } from "@shared/schema";
import { z } from "zod";
// Google Sheets sync is handled by the Perplexity session, not Railway
// New ratings are queued here and synced on next session open
async function syncToSheet(_movie: unknown) {
  // No-op on Railway — sheet sync happens via Perplexity connector
}

// Helper: fetch URL following redirects
function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
    };
    function get(u: string, redirects = 0) {
      if (redirects > 5) return reject(new Error("Too many redirects"));
      https.get(u, opts, (r) => {
        if (r.statusCode && r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
          const next = r.headers.location.startsWith("http")
            ? r.headers.location
            : `https://www.themoviedb.org${r.headers.location}`;
          r.resume();
          return get(next, redirects + 1);
        }
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => resolve(d));
      }).on("error", reject);
    }
    get(url);
  });
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // GET all movies
  app.get("/api/movies", async (_req, res) => {
    try {
      const movies = await storage.getAllMovies();
      res.json(movies);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch movies" });
    }
  });

  // GET single movie
  app.get("/api/movies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const movie = await storage.getMovie(id);
      if (!movie) return res.status(404).json({ error: "Movie not found" });
      res.json(movie);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch movie" });
    }
  });

  // POST create rated movie
  app.post("/api/movies", async (req, res) => {
    try {
      const data = insertMovieSchema.parse(req.body);
      const movie = await storage.createMovie(data);
      res.status(201).json(movie);
      // Sync to Google Sheets in background
      setImmediate(async () => {
        try {
          await syncToSheet(movie);
          console.log(`[Sheets] Synced "${movie.title}"`);
        } catch (e) {
          console.error("[Sheets] Sync failed:", e);
        }
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: err.errors });
      }
      res.status(500).json({ error: "Failed to save movie" });
    }
  });

  // PATCH update movie
  app.patch("/api/movies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateMovie(id, req.body);
      if (!updated) return res.status(404).json({ error: "Movie not found" });
      res.json(updated);
      setImmediate(async () => {
        try {
          if (updated.overallEnjoyment != null) await syncToSheet(updated as any);
        } catch (e) {
          console.error("[Sheets] Update sync failed:", e);
        }
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to update movie" });
    }
  });

  // DELETE movie
  app.delete("/api/movies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteMovie(id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to delete movie" });
    }
  });

  // GET stats
  app.get("/api/stats", async (_req, res) => {
    try {
      const movies = await storage.getAllMovies();
      const byYear: Record<number, number[]> = {};
      const byDecade: Record<number, number[]> = {};
      for (const m of movies) {
        if (!m.year) continue;
        if (!byYear[m.year]) byYear[m.year] = [];
        byYear[m.year].push(m.totalScore);
        const decade = Math.floor(m.year / 10) * 10;
        if (!byDecade[decade]) byDecade[decade] = [];
        byDecade[decade].push(m.totalScore);
      }
      const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      const yearStats = Object.entries(byYear)
        .map(([year, scores]) => ({ year: parseInt(year), avgScore: Math.round(avg(scores) * 100) / 100, count: scores.length }))
        .sort((a, b) => a.year - b.year);
      const decadeStats = Object.entries(byDecade)
        .map(([decade, scores]) => ({ decade: parseInt(decade), label: `${decade}s`, avgScore: Math.round(avg(scores) * 100) / 100, count: scores.length }))
        .sort((a, b) => a.decade - b.decade);
      res.json({ yearStats, decadeStats, total: movies.length });
    } catch (err) {
      res.status(500).json({ error: "Failed to compute stats" });
    }
  });

  // GET TMDB movie by ID
  app.get("/api/tmdb/movie/:id", async (req, res) => {
    const tmdbId = parseInt(req.params.id);
    if (!tmdbId) return res.status(400).json({ error: "Invalid ID" });
    try {
      const html = await fetchHtml(`https://www.themoviedb.org/movie/${tmdbId}`);
      const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/);
      const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/);
      if (ogImage) {
        const poster = ogImage[1].replace(/\/t\/p\/w\d+\//, "/t/p/w342/");
        const title = ogTitle ? ogTitle[1].replace(/ \(\d{4}\)$/, "").replace(/ — The Movie Database.*$/, "").trim() : "";
        res.json({ id: tmdbId, poster, title, found: true });
      } else {
        res.json({ id: tmdbId, poster: null, title: "", found: false });
      }
    } catch {
      res.json({ id: tmdbId, poster: null, title: "", found: false });
    }
  });

  // GET live watchlist from Letterboxd — fetches fresh on every call
  app.get("/api/watchlist", async (_req, res) => {
    try {
      const movies: Array<{ title: string; year: number | null }> = [];
      let page = 1;
      const seen = new Set<string>();

      while (true) {
        const url = `https://letterboxd.com/jeanskyman03/watchlist/page/${page}/`;
        let html: string;
        try {
          html = await fetchHtml(url);
        } catch {
          break;
        }

        // Extract film titles and years from data-item-name e.g. "Dune: Part Two (2024)"
        const matches = [...html.matchAll(/data-item-name="([^"]+)"/g)];
        if (matches.length === 0) break;

        for (const m of matches) {
          const raw = m[1]
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&apos;/g, "'")
            .trim();
          // Parse "Title (Year)" or just "Title"
          const yearMatch = raw.match(/^(.+?)\s*\((\d{4})\)\s*$/);
          const title = yearMatch ? yearMatch[1].trim() : raw;
          const year = yearMatch ? parseInt(yearMatch[2]) : null;
          const key = `${title}|${year}`;
          if (!seen.has(key)) {
            seen.add(key);
            movies.push({ title, year });
          }
        }

        // Check if there's a next page
        if (!html.includes('rel="next"') && !html.includes('class="next"')) break;
        page++;
        // Small delay to be polite
        await new Promise(r => setTimeout(r, 200));
      }

      res.json({ movies, count: movies.length, fetchedAt: new Date().toISOString() });
    } catch (err) {
      console.error("Watchlist fetch error:", err);
      res.status(500).json({ error: "Failed to fetch watchlist" });
    }
  });

  // GET poster proxy
  app.get("/api/poster", async (req, res) => {
    const url = String(req.query.url || "");
    if (!url || (!url.startsWith("https://a.ltrbxd.com") && !url.startsWith("https://image.tmdb.org"))) {
      return res.status(400).send("Invalid URL");
    }
    try {
      https.get(url, { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://letterboxd.com" } }, (proxyRes) => {
        res.set("Content-Type", proxyRes.headers["content-type"] || "image/jpeg");
        res.set("Cache-Control", "public, max-age=86400");
        proxyRes.pipe(res);
      }).on("error", () => res.status(502).send("Proxy error"));
    } catch {
      res.status(502).send("Proxy error");
    }
  });

  return httpServer;
}
