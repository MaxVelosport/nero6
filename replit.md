# НейроЗачёт (SolveHub) — Compressed Documentation

## Overview

НейроЗачёт is a Russian-language AI platform designed to help students and postgraduates solve academic problems. It supports five AI providers, offers a personal account, a balance system, and multiple problem-solving modes. The project aims to provide comprehensive analytical tools, including detailed statistics and a robust administration panel for managing users and system configurations.

## User Preferences

- **AI Agent Startup:** When setting up on a new Replit, the agent should first check for required secrets. If any are missing, it must request all absent secrets simultaneously using `requestEnvVar`.
- **Secret Configuration:** The agent should provide clear instructions for obtaining each required secret, including specific URLs or dashboard paths.
- **Workflow Setup:** After secrets are provided, the agent should set up the necessary workflows for the API server and the SolveHub frontend.
- **Dependency Installation:** The agent should ensure all dependencies are installed (`pnpm install`) and necessary permissions are set (`chmod +x` for esbuild).
- **Admin Assignment:** The agent should provide instructions for assigning an administrator role in Supabase.
- **No Direct DB Migrations:** If `SUPABASE_URL` is set, the agent should not attempt to re-run database migrations as tables are assumed to exist. If a new Supabase project is detected, the agent should guide the user to manually execute SQL from `artifacts/api-server/src/lib/migrate.ts`.
- **Error Handling:** The agent should proactively suggest common solutions for frequent problems like API startup failures, port conflicts, and missing API keys.

## System Architecture

**Monorepo Structure:** The project uses a pnpm monorepo with distinct workspaces for the API server, frontend, and shared libraries.

- **API Server (`artifacts/api-server/`):** Built with Express 5 and TypeScript. It acts as the backend, handling authentication, user management, task processing, AI routing, and data persistence.
    - **AI Router:** A multi-model AI router (`ai.ts`) supports various AI providers and models.
    - **Supabase Integration:** Uses the Supabase JS SDK for all database operations. The `getSupabaseAdmin()` function initializes the admin client.
- **Frontend (`artifacts/solvehub/`):** Developed with React, Vite, Tailwind CSS, and shadcn/ui.
    - **Routing:** Uses Wouter for client-side routing.
    - **UI/UX:** Features a responsive design with mobile optimization, including a `MobileBottomNav`, compact dashboards for small screens, and combined export menus in chat sessions. It utilizes `react-katex` for LaTeX rendering.
    - **Authentication:** Manages user authentication via tokens stored in `localStorage`, with a sliding session mechanism to auto-refresh tokens. Includes a `SessionExpiredModal` for graceful handling of expired sessions.
- **Shared Libraries:**
    - `api-spec/`: OpenAPI specification.
    - `api-client-react/`: Generated React Query hooks for API interaction.
    - `api-zod/`: Generated Zod schemas for validation.

**Database Schema (Supabase - PostgreSQL):** All tables are prefixed with `Neyrozachet_`.
- `Neyrozachet_users`: Stores user information (email, password hash, balance, profile details).
- `Neyrozachet_tokens`: Manages authentication tokens.
- `Neyrozachet_tasks`: Stores academic tasks, their status, costs, and AI model used.
- `Neyrozachet_transactions`: Records all balance-related transactions.
- `Neyrozachet_sessions`: Stores chat sessions.
- `Neyrozachet_messages`: Stores messages within chat sessions, including content, model used, and cost.

**Core Features:**
- **AI-Powered Solutions:** Supports multiple AI models (GPT-4o, Claude 3.5 Sonnet, DeepSeek-V3, Grok 3, Gemini 2.0 Flash) for various academic tasks.
- **Balance System:** Users have a balance for transactions, with costs associated with AI usage and task completion.
- **Task Management:** Allows users to create, track, and manage academic tasks.
- **Chat Sessions:** Provides interactive chat sessions with AI models.
- **Anti-Plagiarism & Uniqueness Tool:** Features text analysis, chunking for large texts, and AI-powered rewriting to improve uniqueness. Includes detailed result comparison with word-level diffing.
- **Statistical Dashboard:** Offers comprehensive analytics with KPIs, activity graphs, subject breakdowns, and productivity metrics.
- **Admin Panel:** Provides tools for managing users, adjusting balances, viewing transactions, and monitoring AI usage statistics.
- **Sentry Monitoring:** Integrated for both backend and frontend error tracking.

**Technology Stack:**
- **Monorepo:** pnpm workspaces
- **Node.js:** v24
- **TypeScript:** 5.9
- **Backend:** Express 5
- **Database:** Supabase (PostgreSQL), used via JS SDK
- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui
- **Authentication:** Token-based (crypto/pbkdf2)
- **Object Storage:** Replit GCS bucket for DALL-E images
- **Routing:** Wouter
- **Validation:** Zod v4
- **LaTeX:** react-katex + katex
- **Email:** Resend

## External Dependencies

- **Supabase:** Used for database persistence (PostgreSQL) and authentication. Requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_KEY`.
- **OpenAI:** Provides access to models like GPT-4o. Requires `OPENAI_API_KEY`.
- **Anthropic:** Provides access to models like Claude 3.5 Sonnet. Requires `ANTHROPIC_API_KEY`.
- **DeepSeek:** Provides access to models like DeepSeek-V3. Requires `DEEPSEEK_API_KEY`.
- **OpenRouter:** Serves as a gateway to various models, including Gemini 2.0 Flash. Requires `OPENROUTER_API_KEY`.
- **xAI:** Provides access to models like Grok 3. Requires `XAI_API_KEY`.
- **Resend:** Used for sending email notifications. Requires `RESEND_API_KEY`.
- **Sentry:** For error monitoring and reporting. Requires `SENTRY_DSN` (backend) and `VITE_SENTRY_DSN` (frontend).
## Биллинг — атомарность (April 2026)

Все платные эндпоинты используют единый атомарный путь списания через `lib/billing.ts::chargeAtomic`:
- Supabase-ветка — CAS-loop (`select balance` → `update where balance=cur` → retry до 5).
- Drizzle-ветка — единый conditional UPDATE с `WHERE balance >= cost`.
- `refund()` тоже атомарный CAS-loop.

Применено в: `summaries.ts`, `tasks.ts` (POST /, generate-image, revision), `tickets.ts`. В `coursework.ts` хелперы `deductBalance`/`refundBalance` переписаны на CAS-loop.
