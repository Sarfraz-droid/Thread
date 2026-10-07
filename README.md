# thread. — Networking mailer manager

A private workspace that learns your professional context, researches referral opportunities, and helps you review and send personalized emails with your original resume attached.

Built with Bun, Turborepo, Next.js App Router, React, Tailwind CSS, shadcn/Base UI, Supabase, and the AI SDK. Next.js server routes handle the backend so the application can run on Vercel without a separate server. AkashML supplies the language models; Tavily supplies web research.

## Run locally

Use Bun 1.3.9+ and Node.js 22+.

```sh
bun install --frozen-lockfile
cp apps/web/.env.example apps/web/.env.local
bun run dev
```

Open http://localhost:3000. Signed-out visitors see a public introduction at `/`, with links to sign in at `/login` or explore `/preview`. Sign in with your email and password through Supabase; only the verified `OWNER_EMAIL` account can open the dashboard. `/preview` shows the dashboard without account data; protected APIs still require authentication. Missing credentials appear only on the login setup screen.

## Configure services

Keep credentials in `apps/web/.env.local` locally and in deployment environment variables. Never commit this file. The environment template documents every required variable.

### Supabase

1. Create a Supabase project. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` from its API settings.
2. Link and apply the migration:

   ```sh
   bunx supabase login
   bunx supabase link --project-ref YOUR_PROJECT_REF
   bunx supabase db push
   ```

3. Enable the Email provider in Supabase Authentication. In Authentication → Users, add your owner account with an email and password and confirm the email. This private workspace does not expose public registration.
4. Set Supabase's Site URL and `APP_URL` to your app URL.
5. Set `OWNER_EMAIL` to the confirmed account email. Sign in with that email and password; the server rejects all other accounts.

The migration creates tables, functions, ownership policies, and a private documents bucket. Browser clients can read their own non-secret records; writes pass through authenticated server routes. Integration credentials are inaccessible to browser clients.

For a local database, Docker must be running:

```sh
bun run db:start
bun run db:reset
bun run db:test
```

Use the local Supabase URL and keys reported by `bunx supabase status`; create a confirmed owner user with a password in the local Supabase dashboard.

### AkashML and web research

Set `AI_PROVIDER=vercel`, `AI_GATEWAY_API_KEY`, and `AI_GATEWAY_MODEL=zai/glm-5.3` to use Vercel AI Gateway. The server routes chat, extraction, memory, and drafts through the selected provider; Settings discovers its available models. Keys belong in ignored `apps/web/.env.local` locally and server environment variables on deployment. To use AkashML instead, set `AI_PROVIDER=akash`, `AKASH_API_KEY`, and `AKASH_MODEL`. Set `TAVILY_API_KEY` for web research. GLM-5.3 is the default model, including for accounts still using the original GPT-OSS default. Settings lets you choose another model discovered from AkashML. Research runs when you request it, stores source URLs and retrieval times, and reuses saved research until refreshed. AI and search calls depend on your provider quotas and billing.

### Memory layer (Mem0)

Long-term memory runs on [Mem0](https://github.com/mem0ai/mem0) open source with vectors stored in your own Supabase Postgres (`mem0_memories`, created by the `mem0_memory` migration). Mem0 extracts durable facts from what you type in chat, deduplicates them, and retrieves them semantically for chat and drafts. Facts appear under Profile & memory, where you can edit or forget them.

Set `MEM0_DATABASE_URL` (Supabase connection string) and `MEM0_EMBEDDING_API_KEY`; the `MEM0_EMBEDDING_*` defaults use OpenRouter's `baai/bge-base-en-v1.5` (768 dimensions); put your OpenRouter key in `MEM0_EMBEDDING_API_KEY`. If you choose another embedding model, change `MEM0_EMBEDDING_DIMS` and the `vector(768)` size in the migration before first use. Extraction uses your selected chat provider and model. Without these variables the app keeps using its built-in memory table. Memories created in either store stay visible, editable and forgettable.

### Gmail sending

Create a separate Google OAuth web client for Gmail. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Register these authorized redirect URIs:

- `http://localhost:3000/api/gmail/callback`
- `https://YOUR_DOMAIN/api/gmail/callback`

Enable the Gmail API and configure the OAuth consent screen. If the Google app is in testing, add your Google account as a test user. Google may expire testing-mode authorizations; reconnect Gmail in Settings when needed.

Generate a 32-byte encryption key and set `ENCRYPTION_KEY` to its 64-character hexadecimal encoding:

```sh
openssl rand -hex 32
```

Connect Gmail in Settings after signing in. Authorization requests send-only access plus identity scopes, and stores the refresh token encrypted on the server. Changing the encryption key requires reconnecting integrations.

## Deploy

Import this repository into Vercel. Two root-directory configurations are supported:

- **Repository root (blank or `.`):** the root `vercel.json` explicitly selects `apps/web/package.json` and the Next.js builder. The builder runs `bun run build` inside the app and uses its `.next` output. This explicit build entry uses Vercel's legacy `builds` configuration to support projects already importing the repository root; build/output dashboard overrides are not used for this build entry.
- **App root (`apps/web`, recommended for new projects):** select the Next.js preset and enable including files outside the root. `apps/web/vercel.json` sets `bun run build` and `.next` output.

Use Node.js 22+ and install with Bun. Commit and push the configuration for the selected root before deploying; redeploying an older commit will not pick up new files. Set the environment variables from `.env.example`, with `APP_URL` equal to the final production URL. Configure the Gmail OAuth callback URL before connecting your sender.

Vercel Hobby and Supabase Free can cover a small personal deployment within their plan limits. AkashML model usage and search quotas are separate. No deployment or external credentials are provisioned by this repository.

## Workflow

The dashboard is the first view after login, with actual opportunity/draft/send counts and the next setup action. The interface uses the supplied TweakCN theme (`cmlm03etv000204lh15608kec`) with self-hosted Inter, Playfair Display, and JetBrains Mono.

1. Upload a PDF or DOCX resume, review extracted profile details, and save. Scanned PDFs and screenshots use browser OCR. You can correct extracted document text.
2. Chat about your experience and preferences. Explicit facts become editable memories; conflicting facts request clarification. Forgetting a memory excludes existing conversation text from future AI context and clears conversation summaries.
3. Paste referral details or attach input files. Review the structured company, role, recipient, and instructions. Research the opportunity and inspect its sources.
4. Generate a draft, edit its recipient, subject, body, and attachments, then save. The Send button sends the saved version once through Gmail.
5. Track sent drafts and manually record outcomes. Delivery timeouts remain locked as unknown: check Gmail Sent before taking further action.

Remote MCP connections support HTTPS servers and explicitly selected tools. Tool read-only annotations are advisory; enable only tools you trust to be read-only. No local process servers are launched.

## Checks

```sh
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run db:test
bun run build
bun run test:e2e
```

Unit checks cover validation, memory rules, credential encryption, URL restrictions, and delivery failure behavior. Database checks cover ownership, private storage, credential isolation, and atomic send claims. Browser checks use clearly illustrative fixtures and mocked provider responses; they do not send real mail. Live Google, AkashML, Tavily, and MCP behavior requires your configured credentials.

## Structure

- `apps/web`: interface, authenticated API routes, OAuth, provider integration.
- `packages/core`: validated contracts, memory rules, delivery state machine, generated database types.
- `packages/ui`: shared shadcn components.
- `supabase`: schema migration and database assertions.
- `tests`: unit and desktop/mobile browser checks.

Messages, memories, profiles, opportunity research, and sent snapshots persist in Supabase. Original files are stored privately. Gmail sends use an atomic database claim, an idempotency key, optimistic draft versions, and immutable snapshots. Network ambiguity never triggers an automatic retry.

Referral review opens in a nearly full-screen dialog with the email editor and an adjacent agent conversation. Before writing a new email, the agent checks for material uncertainty and asks the owner questions in the dialog; answers are checked again before generation. Emails introduce the applicant’s supported background and explicitly request a referral. The header includes opportunity deletion with confirmation; deletion removes related research, drafts, draft chats, and local send history while preserving personal memories and uploaded files. Pending or uncertain deliveries block deletion. Chat revisions update the existing draft using its version check and preserve its recipient and attachments. Explicit personal facts are saved with source-message evidence; conflicting facts remain reviewable in Profile & memory. Proposed profile field changes appear in chat and are applied individually by the owner. Chat cannot send email. Each draft uses its UUID as its persistent conversation UUID, so this feature requires no additional database migration.

Drafts support comma-separated To addresses and optional Cc and Bcc lists, up to 50 addresses per field. Addresses are validated and deduplicated across fields before composing the Gmail message. Agent revisions preserve all recipients. Apply `20261006151512_multiple_recipients.sql` to the hosted Supabase database before using this feature (`bunx supabase login`, then `bunx supabase db push --linked`). The migration adds empty Cc/Bcc arrays to existing drafts.

Select AkashML or Vercel AI Gateway in Settings and save your provider and model. The selection is stored with your account and applies to all AI features. Both API keys remain server environment variables. `AI_PROVIDER` sets the default for accounts without a saved selection.

Together AI: set `TOGETHER_API_KEY` and optionally `TOGETHER_MODEL` (default `MiniMaxAI/MiniMax-M3`) in `apps/web/.env.local` or your deployment environment. Select Together AI in Settings, discover a chat model, and save preferences. All AI features use that saved provider; AkashML remains the default. The backend uses Together’s OpenAI-compatible chat endpoint and its model catalog: https://docs.together.ai/docs/inference/openai-compatibility. Live Together requests require your API key and available account credits.

Groq: configure `GROQ_API_KEY` and optionally `GROQ_MODEL` (default `openai/gpt-oss-20b`). Select Groq in Settings and save preferences, or set `AI_PROVIDER=groq` for accounts without a saved provider. Chat, draft editing, extraction, and memory all use the selected provider. API reference: https://console.groq.com/docs/overview.

OpenRouter: set `OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL` (default `openrouter/auto-beta`). Select OpenRouter in Settings and save preferences, or set `AI_PROVIDER=openrouter` for accounts without a saved provider. It uses OpenRouter’s OpenAI-compatible endpoint (`https://openrouter.ai/api/v1`). API reference: https://openrouter.ai/docs.

## License and security

MIT licensed; see [LICENSE](LICENSE). Contributions: [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities privately per [SECURITY.md](SECURITY.md). This is a self-hosted, single-owner app: you bring your own Supabase project, AI provider keys, and Google OAuth client.
