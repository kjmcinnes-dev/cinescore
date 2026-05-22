import { type Movie, type InsertMovie, movies } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, like } from "drizzle-orm";
import path from "path";

import fs from "fs";

// Use DATA_DIR env var for persistent storage on Railway, fallback to local
const dataDir = process.env.DATA_DIR || process.cwd();
// Ensure the directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, "data.db");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    year INTEGER,
    tmdb_id INTEGER,
    poster_path TEXT,
    overall_enjoyment REAL,
    story_structure REAL,
    direction REAL,
    acting REAL,
    visuals REAL,
    sound_music REAL,
    emotional_impact REAL,
    originality REAL,
    rewatchability REAL,
    actual_score REAL NOT NULL,
    total_score REAL NOT NULL,
    notes TEXT,
    rated_at TEXT NOT NULL
  )
`);

export interface IStorage {
  getAllMovies(): Promise<Movie[]>;
  getMovie(id: number): Promise<Movie | undefined>;
  createMovie(movie: InsertMovie): Promise<Movie>;
  updateMovie(id: number, movie: Partial<InsertMovie>): Promise<Movie | undefined>;
  deleteMovie(id: number): Promise<void>;
  searchMovies(query: string): Promise<Movie[]>;
}

export class DatabaseStorage implements IStorage {
  async getAllMovies(): Promise<Movie[]> {
    return db.select().from(movies).orderBy(desc(movies.ratedAt)).all();
  }
  async getMovie(id: number): Promise<Movie | undefined> {
    return db.select().from(movies).where(eq(movies.id, id)).get();
  }
  async createMovie(movie: InsertMovie): Promise<Movie> {
    return db.insert(movies).values(movie).returning().get();
  }
  async updateMovie(id: number, movie: Partial<InsertMovie>): Promise<Movie | undefined> {
    return db.update(movies).set(movie).where(eq(movies.id, id)).returning().get();
  }
  async deleteMovie(id: number): Promise<void> {
    db.delete(movies).where(eq(movies.id, id)).run();
  }
  async searchMovies(query: string): Promise<Movie[]> {
    return db.select().from(movies)
      .where(like(movies.title, `%${query}%`))
      .orderBy(desc(movies.ratedAt))
      .all();
  }
}

export const storage = new DatabaseStorage();
