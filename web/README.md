# Web Doc Resolver UI

A Next.js web interface for [do-web-doc-resolver](../README.md) — resolves queries and URLs into compact, LLM-ready markdown via a free-first provider cascade.

## Quick Start

```bash
npm install
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## How to Use

### Resolving URLs

Enter any public URL to extract its content as markdown:

```
https://docs.python.org
https://example.com
https://httpbin.org/html
```

The resolver runs through a cascade of providers:
1. **llms.txt** (free) — Structured docs from `/llms.txt` endpoint
2. **Jina Reader** (free) — Web-to-markdown conversion
3. **Firecrawl** (requires API key) — Deep extraction with JS rendering
4. **Direct Fetch** (free) — Basic HTML extraction
5. **Mistral** (requires API key) — AI-powered browser extraction

### Resolving Queries

Enter a natural language search query:

```
python async best practices
machine learning tutorials
latest AI research papers
```

The query cascade:
1. **Exa MCP** (free) — Neural search via Model Context Protocol
2. **Serper** (requires API key) — Google search
3. **Tavily** (requires API key) — Comprehensive search
4. **DuckDuckGo** (free) — Search fallback
5. **Mistral** (requires API key) — AI-powered search fallback

### Using API Keys

Click **Settings** in the nav bar to add your API keys. Keys are stored locally in your browser's localStorage.

| Provider | Key Name | Get Key | Use Case |
|----------|----------|---------|----------|
| Serper | `serper_api_key` | [serper.dev](https://serper.dev) | Google search (2500 free credits) |
| Tavily | `tavily_api_key` | [tavily.com](https://tavily.com) | AI-optimized search |
| Exa | `exa_api_key` | [exa.ai](https://exa.ai) | Neural search |
| Firecrawl | `firecrawl_api_key` | [firecrawl.dev](https://firecrawl.dev) | JS-rendered pages (500 free/month) |
| Mistral | `mistral_api_key` | [mistral.ai](https://mistral.ai) | AI-powered search & browser fallback |

### Result Actions

After a successful resolution:
- **Copy** — Click the Copy button to copy markdown to clipboard
- **Clear** — Clear the result to start fresh
- **Stats** — See character and word count in the header

### Keyboard Shortcuts

- `Tab` — Navigate through form elements
- `Enter` — Submit the form when input is focused

## Environment Variables

| Variable | Required | Description | Default |
|---|---|---|---|
| `SERPER_API_KEY` | No | Google search via Serper | — |
| `TAVILY_API_KEY` | No | Tavily comprehensive search | — |
| `EXA_API_KEY` | No | Exa neural search | — |
| `FIRECRAWL_API_KEY` | No | Firecrawl deep extraction | — |
| `MISTRAL_API_KEY` | No | Mistral AI-powered fallback | — |
| `WEB_RESOLVER_MAX_CHARS` | No | Max characters in response | `8000` |
| `NEXT_PUBLIC_APP_URL` | No | Public URL of this app | — |

**Note**: All API keys are optional. The resolver works with free providers (Jina Reader, DuckDuckGo, direct fetch).

## API Endpoint

### POST `/api/resolve`

Resolve a URL or query to markdown.

**Request:**
```json
{
  "query": "https://example.com",
  "serper_api_key": "optional",
  "tavily_api_key": "optional",
  "exa_api_key": "optional",
  "firecrawl_api_key": "optional",
  "mistral_api_key": "optional"
}
```

**Response:**
```json
{
  "markdown": "Example Domain\n\nThis domain is for use in..."
}
```

**Error Response:**
```json
{
  "error": "Failed to extract content from URL"
}
```

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:e2e:ui` | Run Playwright tests with UI |

## Tech Stack

- **Next.js 15** — App Router, server components
- **React 19** — UI framework
- **Tailwind CSS v4** — CSS-first configuration in `globals.css`
- **TypeScript** — strict mode
- **Vitest** — Unit testing
- **Playwright** — E2E testing
- **Vercel Speed Insights** — performance monitoring

## Deployment

Deployed via [Vercel](https://vercel.com) Git integration — push to `main` and Vercel auto-builds and deploys.

**Live URL**: https://web-eight-ivory-29.vercel.app

### Local Testing (Vercel CLI)

```bash
cd web
vercel link          # One-time: link to project
vercel pull --yes    # Pull env vars locally
vercel dev           # Local dev server
vercel build --prod  # Verify production build
```

### Vercel Configuration

- **API Routes**: Configured with 60s max duration for long-running resolver operations
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy
- **API Keys**: Should be marked as "Sensitive" in Vercel dashboard for security

## Project Structure

```
web/
├── app/
│   ├── layout.tsx        # Root layout (fonts, metadata, SpeedInsights)
│   ├── page.tsx          # Home page (resolver form + settings)
│   ├── api/resolve/
│   │   └── route.ts      # API endpoint with provider cascade
│   ├── help/
│   │   └── page.tsx      # Help / FAQ page
│   └── globals.css       # Tailwind v4 config + theme tokens
├── tests/
│   ├── api/              # Unit tests (Vitest)
│   └── e2e/              # Playwright E2E tests
├── playwright.config.ts
├── vitest.config.ts
├── postcss.config.mjs
├── next.config.mjs
├── vercel.json
└── package.json
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Failed to fetch" | Backend not reachable. Check `NEXT_PUBLIC_RESOLVER_URL` or run locally |
| Empty results | Site may block automated fetching. Add Firecrawl API key for JS rendering |
| Slow responses | Cascade tries multiple providers. Add API keys to skip slower fallbacks |
| Rate limited | Wait and retry, or add alternative API keys |
