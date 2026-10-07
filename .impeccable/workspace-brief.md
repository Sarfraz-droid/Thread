# Workspace surface

Mode: Operate. User approved dark mockup A on 2026-10-06. Reference: mocks/dark-a.png. User explicitly chose dark and mockup-first.

Contract: A quiet correspondence desk with persistent navigation, a central conversation, and a visible context rail. Sage marks action; warm ivory and Lora establish the main heading. Dark flat surfaces and generous separation support daily use. Forms, research, drafts, and settings inherit the same restrained vocabulary. Desktop preserves three regions; compact screens expose navigation above content and make context editable in Profile & memory. The product starts empty; sample names and messages in the mockup are illustrative and must never become user data.

| Ingredient                                    | Implementation                                 |
| --------------------------------------------- | ---------------------------------------------- |
| Dark ground, sampled #141917                  | CSS semantic background                        |
| Sidebar, sampled #151917                      | Semantic aside/navigation                      |
| Selected navigation, sampled #2e3931          | CSS secondary surface                          |
| Sage action, sampled #a5c19f                  | shadcn buttons, dark foreground                |
| Message surface, sampled #232624              | React message/bubble                           |
| Serif headline, 40–48px desktop               | Self-hosted Lora, responsive CSS               |
| UI labels and body                            | Self-hosted DM Sans, 12–14px                   |
| Rounded 12px controls and panels, 1px borders | shadcn and semantic CSS                        |
| Conversation and composer                     | Semantic chat, accessible streaming text       |
| Right context rail with files/memory/history  | React, private signed download links           |
| Primary send action                           | Semantic button, sage fill, saved version only |
| Icons                                         | Lucide vector icons                            |

No imagery is required for the shipped UI. No mockup text or controls are rasterized. Preview fixtures are explicitly illustrative. Contrast may increase from mock pixels for accessibility.

## Direction contract

**THESIS:** Personal context should stay close to the conversation that builds it, then carry into a reviewed referral email.

**OWN-WORLD:** A dark correspondence desk: charcoal green ground, warm ivory lettering, sage actions, fine seams, quiet file and memory surfaces. Typography supplies expression; controls stay familiar.

**STORY:** Bring a resume, refine the profile, talk about preferences, inspect remembered facts, structure a referral, research evidence, review the email and attachment, and send the saved version.

**FIRST VIEWPORT:** Persistent left navigation, spacious central conversation and bottom composer, right profile/memory/history rail. On mobile navigation moves above content and context remains available through Profile.

**FORM:** Left-sidebar three-region composition explicitly approved by the user as mockup A. This user-pinned choice is the governing authority. A prior concept-seed invocation ran during initial direction work (`--scope direction --mode operate --from e25c7c0b --candidate-count 7`, assigned index 4), but raw output was not persisted; no retrospective seed proof or candidate list is asserted. The user then selected dark, requested mockups, and approved A after seeing three rendered structures. That explicit composition pin overrides the random selection mechanism under the skill's “brief wins” rule.

Reproduction checkpoint: `.impeccable/review/hero-repro.png`, actual approved image dimensions 1505×1045. Captured during finishing to verify implemented composition; it is not represented as a pre-build capture. Honest empty state replaces illustrative personal records.
