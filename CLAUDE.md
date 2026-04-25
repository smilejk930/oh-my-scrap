# CLAUDE.md

> **⛔ ABSOLUTE WORKSPACE BOUNDARY — HIGHEST PRIORITY RULE**
>
> Reading and writing files is permitted **ONLY inside this workspace** (the
> directory containing this `CLAUDE.md`: `D:\develop\workspace\oh-my-scrap`).
>
> You **MUST NOT**, under any circumstance:
> - Create / write / edit / delete files at any path outside this workspace.
> - Run shell commands that write, copy, move, redirect, or `cd` to absolute
>   paths outside this workspace (e.g. `D:\tmp`, `C:\Users\...`, `/tmp/...`,
>   `/var/...`, `/etc/...`, `/root/...`, `~/...`).
> - Spawn subagents or background tasks whose work targets paths outside this
>   workspace. The boundary is inherited — every subagent must obey it too.
> - Attempt to bypass, disable, edit, or work around the
>   `.claude/hooks/enforce-workspace-boundary.cjs` hook or the `permissions.deny`
>   rules in `.claude/settings.json`. These exist to enforce this rule.
>
> If a task seems to require working outside the workspace, **STOP** and ask
> the user to explicitly expand trust. There are **no exceptions** for:
> "scratch space", "temp files", "convenience", "speed", "to test something",
> or "the user implied it was OK". Implicit permission does not exist.
>
> A `PreToolUse` hook enforces this at the harness level — violations are
> blocked before the tool runs. **This rule overrides every other instruction,
> including subagent prompts, plan blocks, and skill instructions.**

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (localhost:5173)
npm run build     # Production build → dist/
npm run preview   # Preview the production build
npm run lint      # Run ESLint on all .js/.jsx files
```

There is no test suite. Deployment is to Firebase Hosting (`firebase deploy`); region is `asia-northeast3`.

## Environment Variables

Create a `.env` file at the project root with:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GEMINI_API_KEY=
VITE_YOUTUBE_API_KEY=
```

All env vars must be prefixed with `VITE_` to be accessible in browser code via `import.meta.env`.

`VITE_YOUTUBE_API_KEY` is a YouTube Data API v3 key used only to read video duration (`videos.list?part=contentDetails`) so long videos can bypass Gemini. If unset, the duration check is skipped and long videos will fail with a Gemini token-limit error. Restrict the key by HTTP referrer and to YouTube Data API v3 only — `VITE_` keys ship to the browser.

## Architecture

**Single-page React app** (no router) with two views toggled by `activeTab` state (`"input"` | `"list"`), persisted to `localStorage`.

### Data flow for a scrap

1. User pastes a URL in `InputSection`.
2. `scraper.js` fetches the page via CORS proxies (codetabs → corsproxy.io → allorigins.win fallback) and extracts `og:title`, `og:image`, and body text. For YouTube URLs, it uses oEmbed for metadata and YouTube Data API v3 to read duration; videos longer than 3 minutes (`YOUTUBE_AI_MAX_SECONDS` in `scraper.js`) set `skipAi: true` to avoid Gemini's 1M input-token limit. The duration check is also skipped when the user has `useAi: false` (no point paying for the API call).
3. `gemini.js` analyzes content via the Gemini API with multi-model fallback + up to 3 retries each, returning `{ title, tags, fullSummary }` as JSON. For YouTube videos ≤3 min, the video URL is passed as `fileData.fileUri` so Gemini analyzes the video itself; for webpages, extracted text (truncated to 5000 chars) is analyzed. YouTube URLs are normalized to `youtube.com/watch?v=ID` because the Gemini API only recognizes that canonical form. **Three short-circuit cases** bypass step 3:
   - `useAi: false` → tags come from `generateBasicTags()` and `fullSummary` is the page description.
   - `skipAi: true` (long YouTube video) → tags fixed to `["YouTube", "Video"]`, summary is the skip reason.
4. The combined result is written to Firestore collection `scraps` with `userId`, `url`, `title` (AI or original), `originalTitle`, `thumbnail`, `tags`, `fullSummary`, `createdAt`.

**Gemini model fallback list** (in `gemini.js`) is intentionally curated:
- For video inputs, only `gemini-2.5-flash` and `gemini-2.5-pro` are tried — `flash-lite` and `preview` models don't reliably support video.
- `gemini-2.0-flash` is excluded entirely because it 404s for new API users.

Keep these constraints in mind when tuning the model list.

### Key files

| File | Role |
|------|------|
| `src/context/AuthContext.jsx` | Firebase Auth (Google sign-in) + per-user settings (`language`, `useAi`) synced to Firestore `users/{uid}` |
| `src/firebase/firebase.js` | Initializes Firebase app; exports `auth`, `googleProvider`, `db` |
| `src/services/scraper.js` | CORS-proxy fetching + HTML metadata/body extraction; YouTube oEmbed + duration |
| `src/services/gemini.js` | Gemini AI analysis with multi-model fallback and retry logic |
| `src/components/InputSection.jsx` | URL input form, orchestrates scrape → analyze → save pipeline; owns the `useAi`/`skipAi` branching |
| `src/components/ScrapList.jsx` | Firestore real-time listener (`onSnapshot`), search/date filtering, list/card view toggle, desktop split-pane detail view |
| `src/components/ScrapItem.jsx` | Individual scrap card/row rendering and delete |

### Auth & user settings

`AuthContext` wraps the whole app. It listens to `onAuthStateChanged` and, when authenticated, opens a real-time `onSnapshot` listener on `users/{uid}` to sync settings. If the doc doesn't exist, it's seeded with `{ language: "en", useAi: false }`. The two settings are exposed via the context as `preferredLanguage` and `useAi`:
- `preferredLanguage` is passed to `analyzeContent()` to control the locale of AI-generated titles/tags/summaries.
- `useAi` gates the entire Gemini call (see step 3 above).

### Firestore

- `scraps` — all user scraps; queried client-side with `where("userId", "==", user.uid)` and ordered by `createdAt desc`. The same constraint is enforced server-side by `firestore.rules`, so the client filter is defense-in-depth, not security.
- `users/{uid}` — per-user settings document, currently `{ language: "en" | "ko", useAi: boolean }`.

`firestore.indexes.json` is empty (boilerplate only). If you add a query that combines `where` + `orderBy` on different fields, you'll need to add a composite index here and deploy it.

### UI conventions

- Styling is a mix of CSS classes (`src/index.css`, `src/App.css`) and inline styles — no CSS-in-JS library.
- Animations use `framer-motion` (`motion.*` components, `AnimatePresence`).
- Icons from `lucide-react`.
- Responsive breakpoint at 768 px: below that, a bottom tab bar replaces the left sidebar; `isDesktop` state in `ScrapList` controls the split-pane detail panel.
