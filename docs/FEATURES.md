# Features

This document maps Socialoraa's product features to the implemented areas in the codebase.

## 1. AI Post Generator

Creates multi-platform post ideas from a topic or prompt. The workflow is designed for creators who need quick variations across LinkedIn, Instagram, YouTube, Facebook, and other channels.

**Code areas:**

- `socialoraa/apps/web/src/app/dashboard/post-generator`
- `socialoraa/apps/web/src/app/api/ai/generate-post/route.js`

## 2. Content Writer

Supports longer social copy, campaign captions, hashtags, and reusable brand-focused messaging.

**Code areas:**

- `socialoraa/apps/web/src/app/dashboard/content-writer`
- `socialoraa/apps/web/src/app/api/ai/generate-description/route.js`

## 3. Script Generator

Generates script-style content for short-form videos and social campaigns.

**Code areas:**

- `socialoraa/apps/web/src/app/dashboard/script-generator`
- `socialoraa/apps/web/src/app/api/ai/generate-script/route.js`

## 4. Video to Shorts

Provides the product surface for turning longer videos into short-form clips, with supporting routes for video processing and face tracking.

**Code areas:**

- `socialoraa/apps/web/src/app/dashboard/video-shorts`
- `socialoraa/apps/web/src/app/api/video/shorts/route.js`
- `socialoraa/apps/web/src/app/api/video/shorts/faceTracker.js`

## 5. Post Scheduler

Centralizes upcoming content and queue management so posts can be planned from one dashboard.

**Code areas:**

- `socialoraa/apps/web/src/app/dashboard/scheduler`
- `socialoraa/apps/web/src/utils/schedulerDraft.js`

## 6. Auto Reply AI

Supports engagement workflows for comments and replies across connected social platforms.

**Code areas:**

- `socialoraa/apps/web/src/app/dashboard/auto-reply`
- `socialoraa/apps/web/src/app/api/comments`

## 7. Analytics

Displays platform metrics, content activity, reach, and top-performing content, with export support.

**Code areas:**

- `socialoraa/apps/web/src/app/dashboard/analytics`
- `socialoraa/apps/web/src/app/dashboard/analytics/page.jsx`

## 8. Brand Kit and Settings

Maintains account, brand identity, tone, and platform connection management from a single settings area.

**Code areas:**

- `socialoraa/apps/web/src/app/dashboard/settings`
- `socialoraa/apps/web/src/utils/platformConnections.js`

## 9. Connected Platforms

Uses owner-verified platform connection flows instead of accepting public channel links. This supports safer, more realistic publishing and engagement workflows.

**Code areas:**

- `socialoraa/apps/web/src/app/api/auth`
- `socialoraa/apps/web/src/utils/platformConnections.js`

## 10. Billing Hooks

Includes checkout and verification routes for subscription-ready pricing flows.

**Code areas:**

- `socialoraa/apps/web/src/app/billing`
- `socialoraa/apps/web/src/app/api/billing`
