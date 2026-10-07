# Networking Mailer Manager

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js App Router, React, TypeScript, Bun, Turborepo, shadcn/ui, Tailwind CSS, Supabase, and AkashML. One Vercel deployment; no separate Elysia server.

## Users

One private owner preparing networking and referral emails during a job search.

## Product Purpose

Learn the owner's background from their resume and chat, retain editable long-term memory, research referral opportunities, and send reviewed personalized emails with original resume attachments.

## Operating Context

Email/password login, a separately connected Gmail sender, resumes, pasted referral messages, job links, PDFs, and screenshots. Tavily provides web research. Remote MCP connections expose explicitly selected read-only tools.

## Capabilities and Constraints

Automatic editable memories; persistent chat; editable profile and research; draft and sent history; manual outcomes. Free hosting/database/search allowances with the owner's paid AkashML credits. No inbox sync, automated follow-ups, bulk sending, or generated resumes in v1.

## Evidence on Hand

An empty repository and an approved implementation plan. No real resume or user credentials have been supplied. Illustrative data must never be presented as the owner's actual history.

## Product Principles

- Preserve factual provenance and ask rather than invent missing details.
- Make saved memories inspectable and forgettable.
- Send only the exact reviewed draft on an explicit user action.
- Make provider failures and configuration gaps actionable.

## Accessibility & Inclusion

Implementation default: keyboard-accessible controls, labeled inputs, visible focus, responsive layouts, and reduced-motion support.
