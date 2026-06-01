# Socialoraa

Socialoraa is an AI-powered social media automation platform for creators, agencies, and small businesses. It brings content generation, video-to-shorts workflows, scheduling, auto-reply, platform connection management, and analytics into one dashboard.

The product is built as a full-stack React Router application with server-side API routes, Supabase-backed persistence, AI provider integrations, and a modular dashboard architecture.

## Product Snapshot

- Landing page with clear SaaS positioning, feature highlights, pricing, and conversion CTAs.
- Authenticated dashboard for post generation, content writing, script generation, scheduling, video shorts, auto-reply, analytics, and settings.
- Owner-verified platform connections for YouTube, LinkedIn, Instagram, and Facebook-style workflows.
- Analytics views for reach, content activity, channel metrics, and top-performing content.
- Billing-ready structure with Stripe and Razorpay integration points.

## Why It Matters

Social media teams lose time switching between writing tools, scheduling tools, analytics dashboards, and platform-specific publishing flows. Socialoraa centralizes those workflows so a user can move from idea to scheduled content and performance review in one place.

**Impact:**

- Reduces repetitive creator workflows by combining AI generation, scheduling, and analytics.
- Helps creators maintain a consistent brand voice across multiple platforms.
- Gives small teams a single operational dashboard instead of fragmented tools.
- Makes platform ownership explicit through verified OAuth-style connection flows.
- Supports faster content repurposing through video-to-shorts tooling.

## Key Features

| Area | Capability |
| --- | --- |
| AI Content | Generate social posts, long-form captions, content ideas, and scripts. |
| Video Automation | Convert long-form videos into short vertical content with captions and trimming workflows. |
| Scheduling | Plan and queue posts across supported platforms from one dashboard. |
| Auto Reply | Draft or automate engagement replies while preserving brand voice. |
| Analytics | Track generated content, scheduled activity, reach, and top performers. |
| Brand Kit | Store tone, identity, and preferred content style. |
| Platform Connections | Manage owner-verified YouTube, LinkedIn, Instagram, and Facebook connections. |
| Billing | Subscription-ready backend hooks for Stripe and Razorpay. |

## Architecture First

Socialoraa is organized as a monorepo-style workspace:

```text
Socialoraa/
|-- README.md
|-- docs/
|   |-- ARCHITECTURE.md
|   |-- FEATURES.md
|   |-- IMPACT.md
|   `-- SETUP.md
|-- package.json
`-- socialoraa/
    |-- apps/
    |   |-- web/
    |   |   |-- src/
    |   |   |   |-- app/
    |   |   |   |   |-- api/
    |   |   |   |   |-- dashboard/
    |   |   |   |   |-- account/
    |   |   |   |   `-- page.jsx
    |   |   |   |-- utils/
    |   |   |   `-- client-integrations/
    |   |   |-- public/
    |   |   `-- package.json
    |   `-- mobile/
    `-- shared/
```

Read the full architecture breakdown in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tech Stack

- **Frontend:** React 18, React Router 7, Vite, Tailwind CSS, Chakra UI, lucide-react
- **Backend/API:** React Router server routes, Node runtime, Neon-compatible SQL utilities
- **Data/Storage:** Supabase client, local fallback state for selected workflows
- **AI:** OpenRouter integration, script/post/description generation routes, video shorts processing hooks
- **Media:** upload utilities, generated content storage, video short processing modules
- **Charts/UI:** Recharts, TanStack Table, motion
- **Payments:** Stripe and Razorpay integration points
- **Testing/Tooling:** Vitest, TypeScript, React Router typegen

## Core Workflows

1. **Creator enters the dashboard.**
   The dashboard summarizes total posts, videos made, scheduled items, and auto replies.

2. **AI generates content.**
   Post Generator, Content Writer, and Script Generator send structured requests to API routes under `src/app/api/ai`.

3. **Content is stored and managed.**
   Utility modules under `src/utils` handle generated content, scheduled drafts, media, plan usage, and platform state.

4. **Content is scheduled or published.**
   Scheduler and publish routes prepare platform-specific publishing actions.

5. **Platform ownership is verified.**
   Settings and OAuth routes manage connected channels and persist verified platform records.

6. **Analytics closes the loop.**
   Analytics screens surface reach, activity trends, and top-performing content.

## Getting Started

```bash
npm install --prefix socialoraa/apps/web
npm run dev
```

The root `npm run dev` command starts the web application from `socialoraa/apps/web`.

For environment setup, see [docs/SETUP.md](docs/SETUP.md).

## Scripts

```bash
npm run dev
npm run typecheck
npm --prefix socialoraa/apps/web run build
```

## Screens Represented

The current UI includes:

- Marketing landing page with hero, features, pricing, and CTAs.
- Dashboard overview with activity cards and upcoming queue.
- Analytics dashboard with platform metrics and content activity chart.
- Connected Platforms modal for verified social account management.
- Feature modules for AI posts, content writer, scripts, scheduler, video shorts, auto replies, and settings.

## Project Status

This repository is a working product prototype with production-oriented structure. The current focus is polishing the repository presentation, improving architecture clarity, and preparing the project for recruiter review.

## Repository

GitHub: <https://github.com/Jaycodebyte/Socialoraa>
