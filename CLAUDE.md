# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (localhost:5173)
npm run build     # Production build → dist/
npm run preview   # Preview the production build
npm run lint      # Run ESLint on all .js/.jsx files
```

There is no test suite. Deployment is to Firebase Hosting (`firebase deploy`).

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
```

All env vars must be prefixed with `VITE_` to be accessible in browser code via `import.meta.env`.

## Architecture

**Single-page React app** (no router) with two views toggled by `activeTab` state (`"input"` | `"list"`), persisted to `localStorage`.

### Data flow for a scrap

1. User pastes a URL in `InputSection`
2. `scraper.js` fetches the page via CORS proxies (codetabs → corsproxy.io → allorigins.win fallback) and extracts `og:title`, `og:image`, and body text
3. `gemini.js` sends extracted text to the Gemini API; it tries models in order (`gemini-2.5-flash` → `gemini-2.5-flash-lite` → `gemini-2.5-pro` → `gemini-2.0-flash` → ...) with up to 3 retries each, returning `{ title, tags, fullSummary }` as JSON
4. YouTube videos >5 min bypass step 3 (`skipAi = true`), keeping the original title
5. The combined result is written to Firestore collection `scraps` with `userId`, `url`, `title` (AI), `originalTitle`, `thumbnail`, `tags`, `fullSummary`, `createdAt`

### Key files

| File | Role |
|------|------|
| `src/context/AuthContext.jsx` | Firebase Auth (Google sign-in) + user language preference stored in Firestore `users/{uid}` |
| `src/firebase/firebase.js` | Initializes Firebase app; exports `auth`, `googleProvider`, `db` |
| `src/services/scraper.js` | CORS-proxy fetching + HTML metadata/body extraction |
| `src/services/gemini.js` | Gemini AI analysis with multi-model fallback and retry logic |
| `src/components/InputSection.jsx` | URL input form, orchestrates scrape → analyze → save pipeline |
| `src/components/ScrapList.jsx` | Firestore real-time listener (`onSnapshot`), search/date filtering, list/card view toggle, desktop split-pane detail view |
| `src/components/ScrapItem.jsx` | Individual scrap card/row rendering and delete |

### Auth & user settings

`AuthContext` wraps the whole app. It listens to `onAuthStateChanged` and, when authenticated, also opens a real-time `onSnapshot` listener on `users/{uid}` to sync language preference (`"en"` | `"ko"`). Language is passed to `analyzeContent()` to control the locale of AI-generated titles/tags/summaries.

### Firestore structure

- `scraps` — all user scraps; filtered client-side by `userId == user.uid`, ordered by `createdAt desc`
- `users/{uid}` — per-user settings document, currently `{ language: "en" | "ko" }`

### UI conventions

- Styling is a mix of CSS classes (`src/index.css`, `src/App.css`) and inline styles — no CSS-in-JS library
- Animations use `framer-motion` (`motion.*` components, `AnimatePresence`)
- Icons from `lucide-react`
- Responsive breakpoint at 768 px: below that, a bottom tab bar replaces the left sidebar; `isDesktop` state in `ScrapList` controls the split-pane detail panel
