# Setup

## Prerequisites

- Node.js 20 or newer
- npm
- Git
- Optional: Supabase project, AI provider key, OAuth app credentials, Stripe/Razorpay keys

## Install

```bash
npm install --prefix socialoraa/apps/web
```

## Environment

Copy the example environment file:

```bash
cp socialoraa/apps/web/.env.example socialoraa/apps/web/.env
```

Then fill only the integrations you want to test.

Important variables:

```text
AUTH_SECRET=
AUTH_URL=
DATABASE_URL=
PUBLIC_APP_URL=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

OPENROUTER_API_KEY=
OPENROUTER_MODEL=
GROQ_API_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_API_KEY=
YOUTUBE_API_KEY=

STRIPE_SECRET_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

## Development

From the repository root:

```bash
npm run dev
```

Or directly from the web app:

```bash
npm --prefix socialoraa/apps/web run dev
```

## Typecheck

```bash
npm run typecheck
```

## Build

```bash
npm --prefix socialoraa/apps/web run build
```

## Start Production Build

```bash
npm --prefix socialoraa/apps/web run start
```

## Repository Hygiene

The repository intentionally ignores:

- `.env` files
- logs
- `node_modules`
- build output
- React Router generated files
- generated video exports
- runtime uploads
