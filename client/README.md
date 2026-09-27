# Novard-AI — web client

React 18 single-page app (Create React App + Tailwind CSS). The full
documentation is in the [main README](../README.md).

## Quick start

```bash
npm install
cp .env.example .env      # REACT_APP_API_ENDPOINT and REACT_APP_GOOGLE_CLIENT_ID
npm start                 # http://localhost:3000
```

`REACT_APP_*` values are compiled into the bundle at build time; rebuild after changing them.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Development server with hot reload. |
| `npm test` | Tests in watch mode (Jest + React Testing Library). |
| `npm run test:ci` | Tests once, for CI. |
| `npm run lint` | ESLint (`react-app` rules). |
| `npm run build` | Production build in `build/`. |

## How it talks to the API

All requests go through [src/lib/api.js](src/lib/api.js): `api` (axios) and
`apiFetch` / `apiJson` (fetch) add the base URL, a timeout and the session
token, and a 401 signs the student out. The session itself is stored by
[src/lib/session.js](src/lib/session.js) and managed by
[src/AuthContext.js](src/AuthContext.js).
