# Socialoraa

AI-powered social media workspace for generating posts, scripts, video shorts, scheduling content, managing comments, and reviewing analytics.

## Tech Stack

- React 18
- React Router 7
- Vite
- Tailwind CSS
- Supabase / Neon-compatible database support
- OpenRouter and related AI integrations
- Stripe / Razorpay billing hooks

## Getting Started

```bash
npm install --prefix socialoraa/apps/web
npm run dev
```

The root `npm run dev` command starts the web app from `socialoraa/apps/web`.

## Environment

Copy `socialoraa/apps/web/.env.example` to `socialoraa/apps/web/.env` and fill in the required keys for the integrations you want to test.

```bash
cp socialoraa/apps/web/.env.example socialoraa/apps/web/.env
```
