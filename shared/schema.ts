import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Movies table — stores rated films
export const movies = sqliteTable("movies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  year: integer("year"),
  tmdbId: integer("tmdb_id"),
  posterPath: text("poster_path"),
  // Rating categories (0.5 – 5.0 in 0.5 steps)
  overallEnjoyment: real("overall_enjoyment"),    // ×2 weight (null = Letterboxd-only)
  storyStructure: real("story_structure"),
  direction: real("direction"),
  acting: real("acting"),
  visuals: real("visuals"),
  soundMusic: real("sound_music"),
  emotionalImpact: real("emotional_impact"),
  originality: real("originality"),
  rewatchability: real("rewatchability"),
  // Computed scores
  actualScore: real("actual_score").notNull(),               // raw weighted avg
  totalScore: real("total_score").notNull(),                 // rounded to nearest 0.5
  notes: text("notes"),
  ratedAt: text("rated_at").notNull(),
});

export const insertMovieSchema = createInsertSchema(movies).omit({ id: true }).partial({
  overallEnjoyment: true,
  storyStructure: true,
  direction: true,
  acting: true,
  visuals: true,
  soundMusic: true,
  emotionalImpact: true,
  originality: true,
  rewatchability: true,
});
export type InsertMovie = z.infer<typeof insertMovieSchema>;
export type Movie = typeof movies.$inferSelect;
