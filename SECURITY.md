# Security policy

This app holds OAuth refresh tokens, AI provider keys, and personal email content, so please report vulnerabilities privately.

Use GitHub's "Report a vulnerability" button under the repository's Security tab. Do not open a public issue for security problems. Expect an acknowledgement within a few days.

## Deploying safely

- Never commit `.env` files. Only `apps/web/.env.example` (no values) belongs in git.
- `SUPABASE_SECRET_KEY`, `ENCRYPTION_KEY`, `GOOGLE_CLIENT_SECRET`, and AI keys are server-only. Never expose them with a `NEXT_PUBLIC_` prefix.
- Set `OWNER_EMAIL`; the app rejects every other account.
- Keep Supabase email sign-ups disabled so only the owner account you create can sign in.
- Rotate any credential that was ever pasted into a public place.
