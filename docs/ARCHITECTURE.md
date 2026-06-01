# Architecture

Socialoraa is structured around a full-stack React Router application. The web app owns the product UI, server routes, dashboard modules, API integrations, and utility layer. The repository also keeps a mobile workspace and shared files so the product can grow beyond the web app without flattening everything into one folder.

## High-Level System

```text
User
  |
  v
React Router Web App
  |
  +-- Landing Page
  +-- Account/Auth Pages
  +-- Dashboard Modules
  |     +-- Post Generator
  |     +-- Content Writer
  |     +-- Script Generator
  |     +-- Video to Shorts
  |     +-- Scheduler
  |     +-- Auto Reply
  |     +-- Analytics
  |     +-- Settings / Brand Kit
  |
  v
Server API Routes
  |
  +-- AI generation
  +-- Auth and OAuth
  +-- Billing
  +-- Comments and replies
  +-- Media upload
  +-- Publishing
  +-- Search
  +-- Video shorts processing
  |
  v
External Services
  |
  +-- Supabase / database
  +-- OpenRouter / AI providers
  +-- YouTube / Google APIs
  +-- LinkedIn / social platforms
  +-- Stripe / Razorpay
```

## Repository Layout

```text
socialoraa/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── api/
│   │   │   │   ├── account/
│   │   │   │   ├── billing/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── errors/
│   │   │   │   ├── layout.jsx
│   │   │   │   ├── page.jsx
│   │   │   │   └── routes.ts
│   │   │   ├── client-integrations/
│   │   │   ├── utils/
│   │   │   └── index.css
│   │   ├── public/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── react-router.config.ts
│   └── mobile/
└── shared/
```

## Layer Responsibilities

| Layer | Responsibility |
| --- | --- |
| `src/app/page.jsx` | Public landing page and conversion entry point. |
| `src/app/layout.jsx` | Shared authenticated shell, sidebar, navigation, and app frame. |
| `src/app/dashboard/*` | Product modules for creation, scheduling, analytics, and settings. |
| `src/app/api/*` | Backend route handlers for AI, auth, billing, media, publishing, and social operations. |
| `src/utils/*` | Client/server utility layer for content state, uploads, platform connections, plans, and persistence. |
| `src/client-integrations/*` | Integration shims for client libraries used across routes. |
| `public/` | Static assets and public media. Runtime exports/uploads are intentionally ignored. |

## Dashboard Modules

The dashboard is split by product capability:

- `dashboard/page.jsx` - overview, activity summaries, queue preview, and quick actions.
- `dashboard/post-generator` - AI-powered multi-platform post generation.
- `dashboard/content-writer` - longer caption/content generation workflows.
- `dashboard/script-generator` - script generation for social video content.
- `dashboard/video-shorts` - long-video to vertical short workflow.
- `dashboard/scheduler` - queue and schedule management.
- `dashboard/auto-reply` - engagement reply assistant.
- `dashboard/analytics` - performance reporting and export flow.
- `dashboard/settings` - brand identity, platform connections, account controls.

## API Route Architecture

The server route folders map to product capabilities:

| API Folder | Purpose |
| --- | --- |
| `api/ai` | Post, script, description, and contextual AI generation. |
| `api/auth` | OAuth start/preflight/token and auth success handling. |
| `api/billing` | Checkout and verification flows for paid plans. |
| `api/comments` | Social and YouTube comment read/reply flows. |
| `api/content` | Generated content persistence boundary. |
| `api/media` | Upload processing and file handling. |
| `api/publish` | Platform-specific publishing routes. |
| `api/search` | Web search integration for research-assisted generation. |
| `api/video` | Video shorts processing and face tracking support. |
| `api/utils` | Shared SQL/upload helpers for API routes. |

## Data Flow

```text
Dashboard action
  -> UI state and form validation
  -> API route request
  -> utility/integration layer
  -> external service or database
  -> normalized response
  -> dashboard state update
```

Examples:

- **AI post generation:** dashboard input -> `api/ai/generate-post` -> AI provider -> generated variants -> content store.
- **Platform verification:** settings modal -> OAuth/API route -> platform token metadata -> `connected_platforms` persistence.
- **Video shorts:** upload -> media route -> video shorts route -> captions/trimming metadata -> generated clips/work items.
- **Analytics:** stored content and platform signals -> analytics page -> chart summaries and CSV export.

## Persistence Strategy

Socialoraa uses Supabase and database-backed utilities where available, with local fallback patterns in selected user-facing utilities. This keeps demos functional even when a full production database is not connected, while preserving clear integration points for deployment.

Important persistence areas:

- `connected_platforms` for owner-verified platform records.
- generated content and scheduled drafts.
- plan selection and usage counters.
- media upload references.

## Security and Secrets

Secrets are excluded from Git through `.gitignore`. The repo includes `socialoraa/apps/web/.env.example` so required variables are documented without exposing private keys.

Sensitive values include:

- database connection strings
- Supabase URL and anon key
- OAuth client IDs/secrets
- AI provider API keys
- billing provider secrets

## Deployment Shape

The web app can be deployed as a React Router server app:

```bash
npm --prefix socialoraa/apps/web run build
npm --prefix socialoraa/apps/web run start
```

Runtime exports, uploads, build output, logs, and local environment files are ignored to keep the repository clean and reviewable.
