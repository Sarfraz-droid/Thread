# Contributing

Thanks for helping. This is a single-owner app, so keep changes focused and small.

## Setup

Requires Bun 1.3.9+ and Node.js 22+.

```sh
bun install --frozen-lockfile
cp apps/web/.env.example apps/web/.env.local   # fill in your own credentials
bun run dev
```

See the README for Supabase, AI provider, and Gmail setup.

## Before opening a pull request

```sh
bun run format
bun run lint
bun run typecheck
bun run test
bun run build
```

Database changes need a new migration in `supabase/migrations` and an assertion in `supabase/tests`; run `bun run db:test` (needs Docker). Never include real credentials, resumes, or personal email content in commits, tests, or fixtures.

By contributing you agree your work is licensed under the MIT License.
