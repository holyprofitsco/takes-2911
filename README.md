# Takes

A simple, opinionated content studio for one creator: a content board, video pages, scripts with a reading mode for recording, a calendar, stats and thumbnails.

## Run it locally

```sh
npm install
npm run dev
```

## Deploy

Every push to `main` builds the app and publishes it to GitHub Pages (`.github/workflows/deploy.yml`). In the repo's Settings → Pages, set Source to **GitHub Actions**.

## Data

For now data lives in the browser (IndexedDB), seeded with the current videos on first load. All reads and writes go through `src/data/store.tsx`, which is where Supabase sync will plug in.
