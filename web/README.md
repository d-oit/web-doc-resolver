# Web Doc Resolver UI

A Next.js web interface for [web-doc-resolver](../README.md) — resolves queries and URLs into compact, LLM-ready markdown via a free-first provider cascade.

## Quick Start

```bash
npm install
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description | Default |
|---|---|---|---|
| `NEXT_PUBLIC_RESOLVER_URL` | No | Backend resolver API URL | `http://localhost:8000` |
| `NEXT_PUBLIC_APP_URL` | No | Public URL of this app | — |

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:e2e:ui` | Run Playwright tests with UI |

## Tech Stack

- **Next.js 15** — App Router, server components
- **React 19** — UI framework
- **Tailwind CSS v4** — CSS-first configuration in `globals.css`
- **TypeScript** — strict mode
- **Playwright** — E2E testing
- **Vercel Speed Insights** — performance monitoring

## Deployment

Deployed via [Vercel](https://vercel.com):

```bash
cd web
vercel pull --yes
vercel build --prod
vercel deploy --prebuilt --prod
```

## Project Structure

```
web/
├── app/
│   ├── layout.tsx        # Root layout (fonts, metadata, SpeedInsights)
│   ├── page.tsx          # Home page (resolver form)
│   ├── help/
│   │   └── page.tsx      # Help / FAQ page
│   └── globals.css       # Tailwind v4 config + theme tokens
├── tests/
│   └── e2e/              # Playwright E2E tests
├── playwright.config.ts
├── postcss.config.mjs
├── next.config.ts
├── vercel.json
└── package.json
```
