---
name: Thread
description: A calm private networking workspace.
colors:
  background: "oklch(0.985 0.0041 91.4457)"
  foreground: "oklch(0.145 0.0067 270.4697)"
  card: "oklch(0.9723 0.004 106.473)"
  primary: "oklch(0.3605 0.0904 259.9258)"
  primary-foreground: "oklch(0.985 0.0041 91.4457)"
  secondary: "oklch(0.9397 0.0058 264.5316)"
  secondary-foreground: "oklch(0.1803 0.0121 254.1391)"
  muted: "oklch(0.9453 0.004 106.4756)"
  muted-foreground: "oklch(0.4592 0.0159 262.3235)"
  accent: "oklch(0.9307 0.0121 247.957)"
  accent-foreground: "oklch(0.1801 0.0191 255.7673)"
  destructive: "oklch(0.5505 0.18 25.0223)"
  border: "oklch(0.8808 0.0053 247.884)"
  input: "oklch(0.9094 0.0058 264.5308)"
  ring: "oklch(0.3605 0.0904 259.9258)"
  sidebar: "oklch(0.9723 0.004 106.473)"
typography:
  display:
    fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
    fontSize: "clamp(42px, 4.7vw, 68px)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Outfit, sans-serif"
    fontSize: "26px"
    fontWeight: 600
  body:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontWeight: 400
rounded:
  control: "8px"
  surface: "14px"
spacing:
  unit: "4px"
  intake: "28px"
  priority: "36px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 12px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 12px"
  priority-panel:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.surface}"
    padding: "36px"
---

# Design System: Thread

## Overview

Thread uses the user-supplied TweakCN theme (`https://tweakcn.com/r/themes/cmowxedip000004kzeb7y6a9k`) in its light presentation: warm ivory, restrained blue, generous space, and readable operational controls. This supersedes the earlier sage correspondence mockups, which remain historical references. Light is the default; a sun/moon switch in the landing navigation, login header, and workspace top bar selects light or dark. The choice persists in browser storage, applies before first paint, and also controls toast styling.

Serif branding and selected display headings add the character of personal correspondence. Outfit keeps navigation, forms, and workspace titles clear. Public introduction and authenticated operation share the same visual vocabulary with different density and hierarchy.

**Key Characteristics:**
- Warm, quiet surfaces with a restrained blue action accent.
- Serif display moments paired with practical sans-serif controls.
- Clear next actions and explicit workflow states.

## Colors

The semantic variables in `apps/web/app/globals.css` are authoritative; frontmatter records the active light palette.

### Primary
- **Restrained blue:** primary actions, focus rings, and selected workflow steps.

### Secondary
- **Soft cool neutral:** secondary controls and status badges.
- **Pale blue accent:** the home priority panel and selected navigation.
- **Destructive red:** errors and destructive actions.

### Neutral
- **Warm ivory:** page background.
- **Quiet paper:** card and sidebar surfaces.
- **Deep ink:** readable foreground.
- **Muted slate:** descriptions and supporting text.
- **Soft gray borders:** field outlines, separators, and surface edges.

## Typography

**Display Font:** system serif (Georgia and Cambria fallbacks).
**Body Font:** Outfit; self-hosted weights 400, 500, and 600.
**Mono Font:** Geist Mono; self-hosted weight 400 for configuration and code.

Public hero display type scales from 42px to 68px with tight tracking and balanced wrapping. The home priority heading uses serif type at 34px with a 1.2 line height. Workspace page titles use a 26px sans-serif hierarchy; the intake heading is 23px. Supporting text remains muted and comfortably spaced. The public hero description is 17px with a 1.8 line height and a 44ch maximum width.

## Layout

Desktop workspace uses a 224px sidebar and compact top bar. Dashboard combines a priority panel, three real summary cards, recent opportunities, and a setup action. Its two-column content becomes one column at 950px. At 640px navigation becomes five compact controls above content and forms stack. Chat context sits alongside the conversation on wide screens and remains in Profile on compact screens.

The public page uses a centered 1440px maximum container with 7% side padding, a two-column hero, a process explanation, and a closing action. The hero stacks at 640px; compact screens reduce spacing and display type. These public page compositions belong to the landing brief rather than every workspace view.

Referral review uses a nearly full-screen dialog with independently scrolling email and agent panes. On compact screens, Referral and Agent controls switch between full-width panes; the agent composer remains pinned.

## Elevation & Depth

Depth comes primarily from tonal surfaces and thin borders. Theme shadows remain available for shared controls and overlays; avoid adding strong decorative shadows to ordinary content. The pinned chat composer uses a background-colored shadow to separate scrolling content. Focus indication remains visible, including the global 2px ring with 3px offset.

## Shapes

New priority, illustrative letter, and intake surfaces use gently curved 14px corners. Shared default buttons cap their corners at 8px. Numbered workflow markers are circular. Preserve the theme radius variables for shared shadcn/Base UI components.

## Components

### Buttons

Primary controls use blue with ivory text, a 36px default height, and restrained 150ms state transitions. Outline buttons use the page surface and a soft border; ghost buttons use a muted hover surface; links use the primary color. Preserve focus-visible, disabled, invalid, and loading states. Lucide icons support concise labels.

### Cards / Containers

Use semantic card backgrounds and borders for data and forms. The home priority panel uses the pale blue accent with 36px padding and one leading action: review the next unsent draft, or open opportunity intake. Summary counts and recent opportunities come from real workspace data.

### Inputs / Fields

Keep semantic input borders, readable labels, visible focus, and distinct validation. Referral intake uses one focused shadcn/Base UI modal with referral input, optional attachment, and Structure opportunity. New opportunity actions open intake even when records exist; the board stays behind the modal; focus is trapped during intake and Close or Escape returns to the workspace. Context, Review, and Draft labels orient the workflow without changing creation, research, review, or send behavior.

### Navigation

Separate Dashboard, Chat, Profile & memory, Opportunities, and Settings. Sign out remains available in the top bar on desktop and mobile. Signed-out `/` shows the public introduction; `/login` provides Supabase email/password authentication. Authenticated `/` opens the workspace, defaulting to Dashboard. Setup instructions appear when authentication configuration is missing.

### Opportunity board and review

The board uses New, Researched, Drafted, and Sent columns with actual counts; compact screens stack columns. Cards open the review dialog. Saved workflow status determines columns; sent indicates delivery. Research, draft editing, attachment selection, and sending retain their functional validation.

The email editor leads the review dialog, with opportunity details, research, and original input available in disclosures. The persistent agent conversation occupies the other pane. Keep working, saved-draft, remembered-fact, conflict, and profile-suggestion states explicit. Personal facts save with source evidence; profile replacements require the owner to apply a visible suggestion. The agent cannot send email.

## Do's and Don'ts

### Do:
- **Do** use semantic theme tokens and the light default presentation.
- **Do** distinguish loading, disabled, empty, and error states.
- **Do** use real account data for workspace metrics and activity.
- **Do** label public illustrative content explicitly and keep preview content free of account data.
- **Do** keep credentials server-side and email sending under owner review.

### Don't:
- **Don't** replace the incumbent palette with the historical sage palette.
- **Don't** make promotional page compositions mandatory across operational screens.
- **Don't** display invented account activity or metrics.
