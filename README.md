# Project Cinema

A free, static YouTube movie collection and discovery web app.

## Features
- Add a YouTube URL, movie title, genre and optional year
- Watch using official YouTube embeds, with an external YouTube fallback
- Search and filter by genre, favorites, watched status
- Simple recommendations based on genres of movies you favorited or watched
- Browser-local storage and JSON export
- No backend, API key, paid service, or build step

## Run
Open `index.html` via a local HTTP server (for example, `python3 -m http.server 8000`) and visit `http://localhost:8000`, or deploy the root of the repository using GitHub Pages. A normal HTTPS origin helps YouTube receive appropriate referrer information. Local `file://` playback can fail with YouTube Error 153.

## Publish using GitHub Pages
Merge the pull request. In repository **Settings → Pages**, select **Deploy from a branch**, branch **main**, folder **/(root)**, and save. Wait for GitHub to publish the site.

## Limitations
This MVP does **not** automatically search YouTube for full-length movies or verify rights, video availability, or embeddability. Users supply URLs. Some videos disable embedding; use the Open on YouTube fallback. Recommendations are local genre sorting, not an AI service. Browser data is device/browser-specific; export a backup before clearing browser storage.
