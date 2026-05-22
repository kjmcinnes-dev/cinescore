#!/usr/bin/env python3
"""
Monthly Letterboxd sync for CineScore.
- Fetches new ratings from RSS feed
- Fetches updated watchlist from Letterboxd profile
- Updates SQLite DB and watchlist.json
"""
import xml.etree.ElementTree as ET
import sqlite3, re, html, json, urllib.request, time
from datetime import datetime

LETTERBOXD_USER = "jeanskyman03"
DB_PATH = "/home/user/workspace/movie-rater/data.db"
WATCHLIST_PATH = "/home/user/workspace/movie-rater/client/src/watchlist.json"

NS = {
    'letterboxd': 'https://letterboxd.com',
    'tmdb': 'https://themoviedb.org',
}
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; CineScore/1.0)'}

def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read().decode('utf-8', errors='ignore')

# ── 1. Sync RSS ratings ────────────────────────────────────────────────────────
print("Syncing ratings from RSS...")
rss_xml = fetch(f"https://letterboxd.com/{LETTERBOXD_USER}/rss/")
tree = ET.fromstring(rss_xml)
items = tree.find('channel').findall('item')

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()
cur.execute("SELECT title, year FROM movies")
existing = set((r[0], r[1]) for r in cur.fetchall())

inserted = 0
for item in items:
    title_el   = item.find('letterboxd:filmTitle', NS)
    year_el    = item.find('letterboxd:filmYear', NS)
    rating_el  = item.find('letterboxd:memberRating', NS)
    tmdb_el    = item.find('tmdb:movieId', NS)
    watched_el = item.find('letterboxd:watchedDate', NS)
    desc_el    = item.find('description')

    if title_el is None or rating_el is None:
        continue

    t = html.unescape(title_el.text.strip())
    y = int(year_el.text.strip()) if year_el is not None and year_el.text else None
    if (t, y) in existing:
        continue

    rating  = float(rating_el.text.strip())
    tmdb_id = int(tmdb_el.text.strip()) if tmdb_el is not None and tmdb_el.text else None
    watched = watched_el.text.strip() if watched_el is not None else None
    rated_at = (watched + 'T12:00:00.000Z') if watched else datetime.now().isoformat() + 'Z'

    poster = None
    if desc_el is not None and desc_el.text:
        m = re.search(r'<img src="([^"]+)"', desc_el.text)
        if m:
            poster = m.group(1)

    # Convert Letterboxd poster to TMDB if we have tmdb_id
    if tmdb_id and poster and 'ltrbxd' in poster:
        try:
            page = fetch(f"https://www.themoviedb.org/movie/{tmdb_id}")
            # Follow redirect manually if needed
            og = re.search(r'property="og:image" content="([^"]+)"', page)
            if og:
                poster = og.group(1).replace('/t/p/w500/', '/t/p/w342/')
        except:
            pass
        time.sleep(0.3)

    cur.execute("""
        INSERT INTO movies (title, year, tmdb_id, poster_path,
            overall_enjoyment, story_structure, direction, acting, visuals,
            sound_music, emotional_impact, originality, rewatchability,
            actual_score, total_score, notes, rated_at)
        VALUES (?,?,?,?, NULL,NULL,NULL,NULL,NULL, NULL,NULL,NULL,NULL, ?,?,?,?)
    """, (t, y, tmdb_id, poster, rating, rating, 'Imported from Letterboxd', rated_at))
    existing.add((t, y))
    inserted += 1
    print(f"  + {t} ({y}) — {rating}★")

conn.commit()
print(f"Ratings: {inserted} new added")

# ── 2. Sync watchlist ─────────────────────────────────────────────────────────
print("\nSyncing watchlist...")
watchlist_movies = []
page_num = 1
while True:
    url = f"https://letterboxd.com/{LETTERBOXD_USER}/watchlist/page/{page_num}/"
    try:
        page_html = fetch(url)
    except:
        break
    # Extract film slugs/titles from watchlist page
    matches = re.findall(
        r'data-film-name="([^"]+)"[^>]*data-film-year="(\d*)"',
        page_html
    )
    if not matches:
        # Try alternate pattern
        matches = re.findall(
            r'<li[^>]*data-film-slug="[^"]*"[^>]*data-film-name="([^"]+)"[^>]*(?:data-film-year="(\d*)")?',
            page_html
        )
    if not matches:
        break
    for title_raw, year_raw in matches:
        t = html.unescape(title_raw).strip()
        y = int(year_raw) if year_raw and year_raw.isdigit() else None
        watchlist_movies.append({"title": t, "year": y})
    # Check if there's a next page
    if 'class="next"' not in page_html and 'rel="next"' not in page_html:
        break
    page_num += 1
    time.sleep(0.5)

if watchlist_movies:
    # Deduplicate
    seen = set()
    unique = []
    for m in watchlist_movies:
        k = (m['title'], m['year'])
        if k not in seen:
            seen.add(k)
            unique.append(m)
    with open(WATCHLIST_PATH, 'w') as f:
        json.dump(unique, f)
    print(f"Watchlist: {len(unique)} movies saved")
else:
    print("Watchlist: no changes (fetch may have failed, keeping existing)")

conn.close()
print("\nSync complete:", datetime.now().strftime("%Y-%m-%d %H:%M"))
