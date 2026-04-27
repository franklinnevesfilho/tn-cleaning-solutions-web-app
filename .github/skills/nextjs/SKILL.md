---
name: nextjs
description: Next.js version-specific rules and standards. Use when writing, reviewing, or modifying ANY Next.js code, components, routes, middleware, config, or APIs. Triggers: Next.js, App Router, Pages Router, server components, client components, RSC, route handlers, middleware, next.config, layout.tsx, page.tsx, loading.tsx, error.tsx, actions, use client, use server, image optimization, metadata API, generateStaticParams, generateMetadata, next/navigation, next/headers, next/cookies, next/cache.
license: "See repository LICENSE"
user-invocable: false
---

# Next.js — Version-Specific Standards

> **Breaking changes are present in this version.** APIs, conventions, and file structure may differ from your training data. Always read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code. Heed all deprecation notices in those docs.

## Before Writing Any Next.js Code

1. Locate the relevant guide in `node_modules/next/dist/docs/` for the feature you are implementing.
2. Read it. Do not rely on memory or training-data assumptions.
3. Check for deprecation notices in the guide and in any referenced APIs.
4. If a pattern from your training data conflicts with what the docs say, the docs win.

## Key Risk Areas

These areas are most likely to have changed. Treat them as high-risk unless you have just read the current docs:

- **Routing model** — App Router vs Pages Router conventions, nested layouts, parallel routes, intercepting routes
- **Data fetching** — `fetch` caching semantics, `revalidate`, `dynamic`, `cache()`, `unstable_cache`
- **Server vs Client components** — what is allowed in each, how context/state/hooks differ
- **Rendering modes** — `generateStaticParams`, `dynamic = 'force-dynamic'`, PPR (Partial Pre-rendering)
- **Route Handlers** — `Request`/`Response` API, cookies, headers, streaming
- **Metadata API** — `generateMetadata`, `metadata` export, `opengraph-image`
- **Navigation** — `next/navigation` vs `next/router`, `useRouter`, `redirect()`, `notFound()`
- **Middleware** — matcher config, `NextResponse`, edge runtime constraints
- **Image** — `next/image` props, loader config, remote patterns
- **Config** — `next.config.js` / `next.config.ts` shape, experimental flags

## Rules

1. **Read docs first** — always, for every feature touched. No exceptions.
2. **No assumption reuse** — do not copy patterns from training data without verifying against current docs.
3. **Deprecation is a blocker** — if a doc marks something deprecated, do not use it even if it still works.
4. **Prefer server by default** — components are server components unless `"use client"` is explicitly needed.
5. **Colocation follows the docs** — file naming (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts`) must match the current spec exactly.
6. **Config shape** — verify `next.config` keys against the current docs; removed or renamed keys silently no-op and can cause hard-to-debug issues.