/**
 * Google Sheets as the database backend.
 * All movie data lives in the "Movie Ratings " sheet.
 * Columns:
 *   A=Movie Title  B=Year  C=Overall Enjoyment  D=Story & Structure
 *   E=Direction    F=Acting  G=Visuals/Cinematography  H=Sound & Music
 *   I=Emotional Impact  J=Originality  K=Rewatchability
 *   L=Actual Score (formula)  M=Total Score / 5 (formula)
 *   N=App ID  O=Poster URL  P=TMDB ID  Q=Notes  R=Rated At
 */

import { execSync } from "child_process";

const SHEET_ID   = "1oT4OZz_swf6RzV6ZPjPzYLzmHr9Q0EjsH2JcHIY5j3g";
const WS_ID      = 1921723331;
const DATA_RANGE = "A2:R850";

export interface SheetMovie {
  id: number;
  title: string;
  year: number | null;
  overallEnjoyment: number | null;
  storyStructure: number | null;
  direction: number | null;
  acting: number | null;
  visuals: number | null;
  soundMusic: number | null;
  emotionalImpact: number | null;
  originality: number | null;
  rewatchability: number | null;
  actualScore: number;
  totalScore: number;
  posterPath: string | null;
  tmdbId: number | null;
  notes: string | null;
  ratedAt: string;
  _rowNumber: number; // 1-based sheet row number, not exposed to frontend
}

function callTool(toolName: string, args: Record<string, unknown>): unknown {
  const params = JSON.stringify({
    source_id: "google_sheets__pipedream",
    tool_name: toolName,
    arguments: args,
  });
  try {
    const out = execSync(`external-tool call '${params}'`, { timeout: 20000 }).toString();
    return JSON.parse(out);
  } catch (e: any) {
    console.error(`[SheetsDB] ${toolName} error:`, e.message?.slice(0, 200));
    return null;
  }
}

// Write metadata cols N-R for a specific sheet row number using direct range
function writeMetadataRow(sheetRowNum: number, appId: number, posterPath: string, tmdbId: string, notes: string, ratedAt: string) {
  const range = `N${sheetRowNum}:R${sheetRowNum}`;
  callTool("google_sheets-update-multiple-rows", {
    sheetId: SHEET_ID,
    worksheetId: WS_ID,
    range,
    rows: [[String(appId), posterPath, tmdbId, notes, ratedAt]],
  });
}

function parseFloat2(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function parseInt2(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = parseInt(String(v));
  return isNaN(n) ? null : n;
}

function rowToMovie(row: string[], rowNumber: number): SheetMovie | null {
  if (!row[0]?.trim()) return null; // empty title = skip

  // N col (index 13) = App ID. Generate one from row number if missing.
  const appId = parseInt2(row[13]) ?? rowNumber * 1000;

  const overall   = parseFloat2(row[2]);
  const story     = parseFloat2(row[3]);
  const direction = parseFloat2(row[4]);
  const acting    = parseFloat2(row[5]);
  const visuals   = parseFloat2(row[6]);
  const sound     = parseFloat2(row[7]);
  const emotional = parseFloat2(row[8]);
  const origin    = parseFloat2(row[9]);
  const rewatch   = parseFloat2(row[10]);

  // Use sheet formula value if available, else compute ourselves
  let actualScore  = parseFloat2(row[11]);
  let totalScore   = parseFloat2(row[12]);

  // If sheet hasn't computed yet (letterboxd-only), use col N/O rating
  if (actualScore == null || totalScore == null) {
    // Fall back: if all 9 ratings are null, use letterboxd total from N col if it looks like a score
    if (overall != null && story != null && direction != null && acting != null &&
        visuals != null && sound != null && emotional != null && origin != null && rewatch != null) {
      actualScore = (overall * 2 + story + direction + acting + visuals + sound + emotional + origin + rewatch * 0.5) / 9.5;
      totalScore  = Math.round(actualScore * 2) / 2;
    } else {
      return null; // no usable rating at all
    }
  }

  return {
    id:              appId,
    title:           row[0].trim(),
    year:            parseInt2(row[1]),
    overallEnjoyment: overall,
    storyStructure:  story,
    direction:       direction,
    acting:          acting,
    visuals:         visuals,
    soundMusic:      sound,
    emotionalImpact: emotional,
    originality:     origin,
    rewatchability:  rewatch,
    actualScore:     Math.round(actualScore * 10000) / 10000,
    totalScore:      totalScore,
    posterPath:      row[14]?.trim() || null,
    tmdbId:          parseInt2(row[15]),
    notes:           row[16]?.trim() || null,
    ratedAt:         row[17]?.trim() || new Date().toISOString(),
    _rowNumber:      rowNumber,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function getAllMovies(): Promise<SheetMovie[]> {
  const result = callTool("google_sheets-get-values-in-range", {
    sheetId: SHEET_ID,
    worksheetId: WS_ID,
    range: DATA_RANGE,
  }) as string[][] | null;

  if (!Array.isArray(result)) return [];

  const movies: SheetMovie[] = [];
  for (let i = 0; i < result.length; i++) {
    const movie = rowToMovie(result[i], i + 2); // row 2 = first data row
    if (movie) movies.push(movie);
  }

  // Sort newest first (by ratedAt)
  return movies.sort((a, b) => {
    if (!a.ratedAt && !b.ratedAt) return 0;
    if (!a.ratedAt) return 1;
    if (!b.ratedAt) return -1;
    return new Date(b.ratedAt).getTime() - new Date(a.ratedAt).getTime();
  });
}

export async function getMovieById(id: number): Promise<SheetMovie | null> {
  const all = await getAllMovies();
  return all.find(m => m.id === id) ?? null;
}

export async function upsertMovie(data: {
  title: string;
  year?: number | null;
  overallEnjoyment: number;
  storyStructure: number;
  direction: number;
  acting: number;
  visuals: number;
  soundMusic: number;
  emotionalImpact: number;
  originality: number;
  rewatchability: number;
  posterPath?: string | null;
  tmdbId?: number | null;
  notes?: string | null;
  ratedAt?: string;
}, existingId?: number): Promise<SheetMovie> {
  // Compute scores
  const actual = (data.overallEnjoyment * 2 + data.storyStructure + data.direction +
    data.acting + data.visuals + data.soundMusic + data.emotionalImpact +
    data.originality + data.rewatchability * 0.5) / 9.5;
  const total = Math.round(actual * 2) / 2;

  const ratedAt = data.ratedAt || new Date().toISOString();

  // Determine App ID
  let appId = existingId;
  if (!appId) {
    appId = Date.now(); // use timestamp as unique ID for new entries
  }

  const rowArray = [
    data.title,
    String(data.year ?? ""),
    String(data.overallEnjoyment),
    String(data.storyStructure),
    String(data.direction),
    String(data.acting),
    String(data.visuals),
    String(data.soundMusic),
    String(data.emotionalImpact),
    String(data.originality),
    String(data.rewatchability),
    // L & M left empty — sheet formula computes them
    "", "",
    String(appId),
    data.posterPath ?? "",
    String(data.tmdbId ?? ""),
    data.notes ?? "",
    ratedAt,
  ];

  // Upsert the rating data into cols A-K
  const result = callTool("google_sheets-upsert-row", {
    sheetId:     SHEET_ID,
    worksheetId: WS_ID,
    column:      "A",
    value:       data.title,
    insert:      rowArray.slice(0, 11), // A-K only
    updates: {
      B: String(data.year ?? ""),
      C: String(data.overallEnjoyment),
      D: String(data.storyStructure),
      E: String(data.direction),
      F: String(data.acting),
      G: String(data.visuals),
      H: String(data.soundMusic),
      I: String(data.emotionalImpact),
      J: String(data.originality),
      K: String(data.rewatchability),
    },
  }) as any;

  // Write metadata to N-R using direct range (header mapping is unreliable)
  const updatedRange = result?.updatedRange as string | undefined;
  const rowMatch = updatedRange?.match(/(\d+)$/);
  if (rowMatch) {
    const sheetRowNum = parseInt(rowMatch[1]);
    writeMetadataRow(sheetRowNum, appId, data.posterPath ?? "", String(data.tmdbId ?? ""), data.notes ?? "", ratedAt);
  } else {
    // Find the row and write metadata
    const found = callTool("google_sheets-find-row", {
      sheetId: SHEET_ID, worksheetId: WS_ID, column: "A", value: data.title, exportRow: false,
    }) as any[];
    if (found?.length) {
      writeMetadataRow(found[0].googleSheetsRowNumber, appId, data.posterPath ?? "", String(data.tmdbId ?? ""), data.notes ?? "", ratedAt);
    }
  }

  return {
    id:              appId,
    title:           data.title,
    year:            data.year ?? null,
    overallEnjoyment: data.overallEnjoyment,
    storyStructure:  data.storyStructure,
    direction:       data.direction,
    acting:          data.acting,
    visuals:         data.visuals,
    soundMusic:      data.soundMusic,
    emotionalImpact: data.emotionalImpact,
    originality:     data.originality,
    rewatchability:  data.rewatchability,
    actualScore:     Math.round(actual * 10000) / 10000,
    totalScore:      total,
    posterPath:      data.posterPath ?? null,
    tmdbId:          data.tmdbId ?? null,
    notes:           data.notes ?? null,
    ratedAt,
    _rowNumber:      -1,
  };
}

export async function updateMoviePoster(id: number, posterPath: string, tmdbId?: number | null): Promise<void> {
  const movie = await getMovieById(id);
  if (!movie) return;
  // Update O (poster) and P (tmdb_id) directly
  const resolvedTmdbId = tmdbId != null ? String(tmdbId) : (movie.tmdbId != null ? String(movie.tmdbId) : "");
  callTool("google_sheets-update-multiple-rows", {
    sheetId:     SHEET_ID,
    worksheetId: WS_ID,
    range:       `O${movie._rowNumber}:P${movie._rowNumber}`,
    rows:        [[posterPath, resolvedTmdbId]],
  });
}

export async function deleteMovie(id: number): Promise<void> {
  const movie = await getMovieById(id);
  if (!movie) return;
  // Clear rating columns C-K and metadata N-R, keep title/year
  callTool("google_sheets-update-row", {
    sheetId:     SHEET_ID,
    worksheetId: WS_ID,
    hasHeaders:  true,
    row:         movie._rowNumber,
    "Overall Enjoyment": "",
    "Story & Structure": "",
    "Direction": "",
    "Acting": "",
    "Visuals/Cinematography": "",
    "Sound & Music": "",
    "Emotional Impact": "",
    "Originality": "",
    "Rewatchability": "",
    "App ID": "",
    "Poster URL": "",
    "TMDB ID": "",
    "Notes": "",
    "Rated At": "",
  });
}
