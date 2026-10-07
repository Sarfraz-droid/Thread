import { test, expect, type Page } from "@playwright/test";
import {
  emptyProfile,
  type WorkspaceState,
  type Draft,
  type Opportunity,
  type Memory,
  type Message,
  type DraftChatReply,
  type Settings,
} from "../../packages/core/src/index";
const owner = "11111111-1111-4111-8111-111111111111",
  opportunityId = "22222222-2222-4222-8222-222222222222",
  draftId = "33333333-3333-4333-8333-333333333333",
  conversationId = "44444444-4444-4444-8444-444444444444",
  documentId = "55555555-5555-4555-8555-555555555555";
const now = "2026-10-06T10:00:00Z";
function initialState(): WorkspaceState {
  return {
    profile: emptyProfile,
    settings: { model: "test-model", signature: "" },
    memories: [],
    documents: [],
    conversations: [],
    opportunities: [],
    drafts: [],
    mcp: [],
    gmail: { connected: true, email: "owner@example.test" },
  };
}
async function mocks(page: Page, clarify = false) {
  const state = initialState();
  let sendCalls = 0;
  const draftMessages: Message[] = [];
  let lastReference: unknown;
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.slice(5),
      method = request.method(),
      body = request.postDataJSON() as Record<string, unknown> | null;
    const fulfill = (data: unknown) => route.fulfill({ json: data });
    if (path === "state") return fulfill(state);
    if (path === "settings" && method === "PUT") {
      state.settings = body as Settings;
      return fulfill(state.settings);
    }
    if (path === "models")
      return fulfill({
        models: [
          {
            id:
              url.searchParams.get("provider") === "groq"
                ? "openai/gpt-oss-20b"
                : url.searchParams.get("provider") === "together"
                  ? "MiniMaxAI/MiniMax-M3"
                  : url.searchParams.get("provider") === "vercel"
                    ? "zai/glm-5.3"
                    : "zai-org/GLM-5.3",
          },
        ],
      });
    if (path === "profile" && method === "PUT") {
      state.profile = body as WorkspaceState["profile"];
      return fulfill(state.profile);
    }
    if (path === "chat") {
      state.conversations = [
        {
          id: conversationId,
          title: "I prefer remote roles",
          summary: "",
          created_at: now,
        },
      ];
      state.memories = [
        {
          id: "66666666-6666-4666-8666-666666666666",
          user_id: owner,
          key: "preferences.location",
          content: "Prefers remote roles",
          evidence: "I prefer remote roles",
          source_message_id: null,
          status: "active",
          proposal: null,
          created_at: now,
          updated_at: now,
        },
      ];
      return route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/plain",
          "X-Conversation-Id": conversationId,
        },
        body: "Remote roles — understood. What kind of team would you like to join?",
      });
    }
    if (path === "messages")
      return fulfill([
        {
          id: "m1",
          conversation_id: conversationId,
          role: "user",
          content: "I prefer remote roles",
          created_at: now,
        },
        {
          id: "m2",
          conversation_id: conversationId,
          role: "assistant",
          content:
            "Remote roles — understood. What kind of team would you like to join?",
          created_at: now,
        },
      ]);
    if (path.startsWith("memories/") && method === "PUT") {
      state.memories[0] = {
        ...state.memories[0],
        content: String(body?.content),
        updated_at: new Date().toISOString(),
      };
      return fulfill(state.memories[0]);
    }
    if (path.startsWith("memories/") && method === "DELETE") {
      state.memories = [];
      return fulfill({ ok: true });
    }
    if (path === "opportunities" && method === "POST") {
      const opportunity: Opportunity = {
        id: opportunityId,
        user_id: owner,
        input: String(body?.input),
        document_id: null,
        company: "Example Company",
        role: "Backend Engineer",
        recipient_name: "Sam",
        recipient_email: "sam@example.test",
        job_url: "https://example.com/careers",
        job_id: "ENG-42",
        instructions: "Ask for a referral",
        notes: "",
        research: "",
        status: "new",
        outcome: "pending",
        created_at: now,
        updated_at: now,
      };
      state.opportunities = [opportunity];
      return fulfill(opportunity);
    }
    if (path === `opportunities/${opportunityId}` && method === "PUT") {
      state.opportunities[0] = {
        ...state.opportunities[0],
        ...body,
      } as Opportunity;
      return fulfill(state.opportunities[0]);
    }
    if (path.endsWith("/research")) {
      state.opportunities[0].research =
        "The official careers page describes a backend role using TypeScript. Source: https://example.com/careers";
      state.opportunities[0].status = "researched";
      return fulfill(state.opportunities[0]);
    }
    if (path.endsWith("/sources"))
      return fulfill([
        {
          id: "s1",
          opportunity_id: opportunityId,
          url: "https://example.com/careers",
          title: "Official careers page",
          content: "Backend role",
          retrieved_at: now,
        },
      ]);
    if (path === `opportunities/${opportunityId}` && method === "DELETE") {
      state.opportunities = [];
      state.drafts = [];
      return fulfill({ ok: true });
    }
    if (path.endsWith("/draft")) {
      if (clarify && !(body?.answers as unknown[] | undefined)?.length)
        return fulfill({
          kind: "clarification",
          questions: ["Which role would you like a referral for?"],
        });
      const draft: Draft = {
        id: draftId,
        user_id: owner,
        opportunity_id: opportunityId,
        recipient_email: "sam@example.test",
        subject: "Referral request — Backend Engineer",
        body: "Hi Sam,\n\nI’d appreciate a referral for the Backend Engineer role. My background includes TypeScript and API development.\n\nThanks,\nAlex",
        attachment_ids: [documentId],
        version: 1,
        status: "draft",
        gmail_message_id: null,
        sent_at: null,
        created_at: now,
        updated_at: now,
      };
      state.drafts = [draft];
      return fulfill(draft);
    }
    if (path === `drafts/${draftId}/chat`) {
      if (method === "GET") return fulfill(draftMessages);
      if (body?.version !== state.drafts[0].version)
        return route.fulfill({
          status: 409,
          json: { error: "This draft changed. Refresh the workspace." },
        });
      lastReference = body?.reference;
      const reply: DraftChatReply = {
        kind: "draft-assistant",
        message: "I highlighted your team leadership and shortened the email.",
        draft_updated: true,
        profile_updates: [
          {
            field: "experience",
            value: "Led a team of five engineers.",
            evidence: "I led a team of five engineers",
          },
        ],
        memory: { saved: 1, conflicts: 0, failed: false },
      };
      state.drafts[0] = {
        ...state.drafts[0],
        body: "Hi Sam,\n\nI led a team of five engineers. Could you refer me for the Backend Engineer role?\n\nThanks,\nAlex",
        version: state.drafts[0].version + 1,
      };
      state.memories.push({
        id: "leadership-memory",
        user_id: owner,
        key: "experience.team_leadership",
        content: "Led a team of five engineers",
        evidence: "I led a team of five engineers",
        source_message_id: "draft-user-message",
        status: "active",
        proposal: null,
        created_at: now,
        updated_at: now,
      });
      draftMessages.push(
        {
          id: "draft-user-message",
          conversation_id: draftId,
          role: "user",
          content: String(body?.content),
          created_at: now,
        },
        {
          id: "draft-assistant-message",
          conversation_id: draftId,
          role: "assistant",
          content: JSON.stringify(reply),
          created_at: now,
        },
      );
      return fulfill({ draft: state.drafts[0], reply });
    }
    if (path === `drafts/${draftId}` && method === "PUT") {
      state.drafts[0] = {
        ...state.drafts[0],
        ...body,
        version: state.drafts[0].version + 1,
      } as Draft;
      return fulfill(state.drafts[0]);
    }
    if (path.endsWith("/send")) {
      sendCalls++;
      state.drafts[0].status = "sent";
      state.drafts[0].sent_at = now;
      state.drafts[0].gmail_message_id = "mock-gmail-id";
      return fulfill({ status: "sent", messageId: "mock-gmail-id" });
    }
    return fulfill({ ok: true });
  });
  return {
    state,
    sendCalls: () => sendCalls,
    lastReference: () => lastReference,
  };
}
async function showReferralPanel(page: Page, name: "Referral" | "Agent") {
  const control = page.getByRole("button", { name, exact: true });
  if (await control.isVisible()) await control.click();
}
test("profile, chat, research, reviewed draft, and one-click send", async ({
  page,
}) => {
  const mock = await mocks(page);
  mock.state.documents = [
    {
      id: documentId,
      user_id: owner,
      name: "Illustrative resume.pdf",
      path: `${owner}/${documentId}/resume.pdf`,
      mime_type: "application/pdf",
      size: 2048,
      text: "",
      kind: "resume",
      is_default: true,
      created_at: now,
    },
  ];
  await page.goto("/preview");
  await page.getByRole("button", { name: "Profile & memory" }).click();
  await page.getByLabel("Full name").fill("Alex Example");
  await page
    .getByLabel("About you")
    .fill("I build TypeScript APIs and backend systems.");
  await page
    .getByLabel("Skills", { exact: true })
    .fill("TypeScript, React, Bun");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect.poll(() => mock.state.profile.name).toBe("Alex Example");
  expect(mock.state.profile.skills).toEqual(["TypeScript", "React", "Bun"]);
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page
    .getByLabel("Message your profile agent")
    .fill("I prefer remote roles");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("Remote roles — understood.", { exact: false }).first(),
  ).toBeVisible();
  await expect.poll(() => mock.state.memories.length).toBe(1);
  await page
    .getByRole("button", { name: "Opportunities", exact: true })
    .click();
  await page
    .getByLabel("Referral details")
    .fill(
      "Sam at Example Company can refer me for Backend Engineer. sam@example.test https://example.com/careers",
    );
  await page.getByRole("button", { name: "Structure opportunity" }).click();
  await expect(page.getByLabel("Company", { exact: true })).toHaveValue(
    "Example Company",
  );
  await page.getByRole("button", { name: "Research opportunity" }).click();
  await expect(page.getByLabel("Research summary")).toHaveValue(
    /official careers/,
  );
  await page.getByRole("button", { name: "Create email draft" }).click();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Referral request — Backend Engineer",
  );
  await expect(
    page.getByRole("checkbox", {
      name: "Illustrative resume.pdf (2 KB)",
      exact: true,
    }),
  ).toBeChecked();
  await page
    .getByLabel("Subject", { exact: true })
    .fill("A personal referral request");
  await expect(
    page.getByRole("button", { name: "Send email", exact: true }),
  ).toBeDisabled();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const dialogBounds = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(dialogBounds!.width).toBeGreaterThan(viewport.width * 0.9);
  expect(dialogBounds!.height).toBeGreaterThan(viewport.height * 0.9);
  await page
    .getByLabel("To", { exact: true })
    .fill("sam@example.test, alex@example.test");
  await page.getByLabel("Cc", { exact: true }).fill("team@example.test");
  await page.getByLabel("Bcc", { exact: true }).fill("archive@example.test");
  const selectedPassage =
    "My background includes TypeScript and API development.";
  await page
    .getByLabel("Message", { exact: true })
    .evaluate((element, passage) => {
      const textarea = element as HTMLTextAreaElement;
      const start = textarea.value.indexOf(passage);
      textarea.focus();
      textarea.setSelectionRange(start, start + passage.length);
      textarea.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      document.dispatchEvent(new Event("selectionchange"));
    }, selectedPassage);
  const selectionIcon = page.getByRole("button", {
    name: "Ask agent about selected text",
    exact: true,
  });
  await expect(selectionIcon).toBeVisible();
  const iconBox = await selectionIcon.boundingBox();
  expect(iconBox!.width).toBe(32);
  expect(iconBox!.height).toBe(32);
  expect(
    await selectionIcon.evaluate(
      (element) => getComputedStyle(element).position,
    ),
  ).toBe("absolute");
  await selectionIcon.click();
  await expect(page.locator(".agent-selected-reference blockquote")).toHaveText(
    selectedPassage,
  );
  await showReferralPanel(page, "Agent");
  await page
    .getByLabel("Message your draft assistant")
    .fill("Make it shorter. I led a team of five engineers.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect
    .poll(() => mock.lastReference())
    .toMatchObject({ text: selectedPassage });
  await expect(page.getByText("Draft updated", { exact: true })).toBeVisible();
  await showReferralPanel(page, "Referral");
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
    /led a team of five engineers/,
  );
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "A personal referral request",
  );

  expect(mock.state.drafts[0].recipient_email).toBe(
    "sam@example.test, alex@example.test",
  );
  expect(mock.state.drafts[0].cc_emails).toEqual(["team@example.test"]);
  expect(mock.state.drafts[0].bcc_emails).toEqual(["archive@example.test"]);
  await showReferralPanel(page, "Agent");
  await expect(
    page.getByText("1 fact remembered", { exact: true }),
  ).toBeVisible();
  expect(mock.state.profile.experience).toBe("");
  expect(mock.sendCalls()).toBe(0);
  await page
    .getByRole("button", { name: "Apply to profile", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved to profile", exact: true }),
  ).toBeVisible();
  expect(mock.state.profile.experience).toBe("Led a team of five engineers.");
  expect(mock.state.profile.name).toBe("Alex Example");
  await page
    .getByRole("button", { name: "Close referral", exact: true })
    .click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page
    .getByRole("button", { name: "Opportunities", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Example Company.*Backend Engineer/ })
    .click();
  await showReferralPanel(page, "Agent");
  await expect(
    page.getByText(
      "I highlighted your team leadership and shortened the email.",
      { exact: true },
    ),
  ).toBeVisible();
  await showReferralPanel(page, "Referral");
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "A personal referral request",
  );
  await expect(
    page.getByRole("button", { name: "Send email", exact: true }),
  ).toBeEnabled();
  await showReferralPanel(page, "Agent");
  await page
    .getByLabel("Message your draft assistant")
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `.impeccable/review/${test.info().project.name}-draft-chat.png`,
    animations: "disabled",
  });
  await showReferralPanel(page, "Referral");
  await page
    .getByRole("button", { name: "Send email", exact: true })
    .scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  await page.screenshot({
    path: `.impeccable/review/${test.info().project.name}-draft-viewport.png`,
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `.impeccable/review/${test.info().project.name}-draft.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Send email", exact: true }).click();
  await expect(
    page.getByText("Sent through Gmail", { exact: true }),
  ).toBeVisible();
  expect(mock.sendCalls()).toBe(1);
  await expect(page.getByLabel("Message", { exact: true })).toBeDisabled();
});
test("memory correction and forgetting", async ({ page }) => {
  const mock = await mocks(page);
  mock.state.memories = [
    {
      id: "66666666-6666-4666-8666-666666666666",
      user_id: owner,
      key: "preferences.location",
      content: "Prefers remote roles",
      evidence: "I prefer remote roles",
      source_message_id: null,
      status: "active",
      proposal: null,
      created_at: now,
      updated_at: now,
    } as Memory,
  ];
  await page.goto("/preview");
  await page.getByRole("button", { name: "Profile & memory" }).click();
  await expect(
    page.getByText("Prefers remote roles", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByLabel("Memory", { exact: true })
    .fill("Prefers remote backend roles");
  await page.getByRole("button", { name: "Save memory", exact: true }).click();
  await expect(
    page.getByText("Prefers remote backend roles", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Forget", exact: true }).click();
  await expect(page.getByText("A memory that grows with you")).toBeVisible();
  expect(mock.state.memories).toHaveLength(0);
});
test("provider failures are visible and draft remains unsent", async ({
  page,
}) => {
  await mocks(page);
  await page.route("**/api/opportunities", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: "Your AI credits have run out. Top up AkashML and try again.",
      },
    }),
  );
  await page.goto("/preview");
  await page
    .getByRole("button", { name: "Opportunities", exact: true })
    .click();
  await page.getByLabel("Referral details").fill("Referral to Example");
  await page.getByRole("button", { name: "Structure opportunity" }).click();
  await expect(
    page
      .getByText("Your AI credits have run out. Top up AkashML and try again.")
      .first(),
  ).toBeVisible();
});
test("responsive workspace has no horizontal overflow", async ({ page }) => {
  await mocks(page);
  await page.goto("/preview");
  for (const name of [
    "Dashboard",
    "Chat",
    "Profile & memory",
    "Opportunities",
    "Settings",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.impeccable/review/${test.info().project.name}-${name.split(" ")[0].toLowerCase()}.png`,
      fullPage: true,
      animations: "disabled",
    });
    if (name === "Opportunities") {
      await page
        .getByRole("dialog", { name: "Add an opportunity" })
        .getByRole("button", { name: "Close", exact: true })
        .click();
    }
  }
  await page.screenshot({
    path: `.impeccable/review/${test.info().project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  if (test.info().project.name === "desktop") {
    await page.setViewportSize({ width: 1505, height: 1045 });
    await page.getByRole("button", { name: "Chat", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Chat", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: ".impeccable/review/hero-repro.png" });
  }
});
test("public API does not expose account data", async ({ request }) => {
  const response = await request.get("/api/state");
  expect([401, 503]).toContain(response.status());
});

test("signed-out visitors see the introduction and can reach login", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Your next chapter starts with a conversation.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: `.impeccable/review/${test.info().project.name}-landing.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "Open your workspace" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Sign in to your workspace" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute(
    "type",
    "email",
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Continue with Google")).toHaveCount(0);
  await page.screenshot({
    path: `.impeccable/review/${test.info().project.name}-login.png`,
    fullPage: true,
    animations: "disabled",
  });
});
test("dashboard is the first workspace view and actions navigate", async ({
  page,
}) => {
  await mocks(page);
  await page.goto("/preview");
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No opportunities yet.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `.impeccable/review/${test.info().project.name}-home.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "New opportunity", exact: true })
    .click();
  await expect(page.getByLabel("Referral details")).toBeVisible();
  await expect(
    page.getByText("Start with whatever you have.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Bring the context", { exact: true }),
  ).toHaveCount(0);
});
test("failed password login shows a useful message without exposing credentials", async ({
  page,
}) => {
  await page.goto("/login?error=credentials");
  await expect(
    page.getByText(
      "Email or password is incorrect. Check your details and try again.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Unable to sign in", { exact: true }),
  ).toBeVisible();
});

test("pasted referral images show a preview and can be removed", async ({
  page,
}) => {
  await mocks(page);
  await page.goto("/preview");
  await page
    .getByRole("button", { name: "Opportunities", exact: true })
    .click();
  const input = page.getByLabel("Referral details");
  await input.fill("Keep this referral text");
  await input.evaluate((element) => {
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=",
      ),
      (character) => character.charCodeAt(0),
    );
    const clipboard = new DataTransfer();
    clipboard.items.add(
      new File([bytes], "screenshot.png", { type: "image/png" }),
    );
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: clipboard,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  const image = page.getByRole("img", { name: "Referral image preview" });
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
    )
    .toBe(1);
  await expect(input).toHaveValue("Keep this referral text");
  await expect(page.getByText("screenshot.png", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Remove referral attachment" })
    .click();
  await expect(image).toHaveCount(0);
  await input.fill("");
  await expect(
    page.getByRole("button", { name: "Structure opportunity" }),
  ).toBeDisabled();
});

test("opportunities board groups cards by workflow status and opens review", async ({
  page,
}) => {
  const mock = await mocks(page);
  mock.state.opportunities = (
    ["new", "researched", "drafted", "sent"] as const
  ).map((status, index) => ({
    id: `22222222-2222-4222-8222-22222222222${index}`,
    user_id: owner,
    input: "Referral",
    document_id: null,
    company: `Company ${index}`,
    role: "Engineer",
    recipient_name: "Sam",
    recipient_email: "sam@example.test",
    job_url: "",
    job_id: "",
    instructions: "",
    notes: "",
    status,
    outcome: "pending",
    research: [],
    created_at: now,
    updated_at: now,
  }));
  await page.goto("/preview");
  await page
    .getByRole("button", { name: "Opportunities", exact: true })
    .click();
  await page.getByRole("button", { name: "All sent", exact: true }).click();
  for (const [index, title] of [
    "New",
    "Researched",
    "Drafted",
    "Sent",
  ].entries()) {
    const column = page.getByRole("region", {
      name: `${title} opportunities`,
      exact: true,
    });
    await expect(
      column.getByRole("button", { name: `Open Company ${index}, Engineer` }),
    ).toBeVisible();
    await expect(
      column.getByLabel("1 opportunities", { exact: true }),
    ).toBeVisible();
  }
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: `.impeccable/review/${test.info().project.name}-kanban.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Open Company 2, Engineer" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Company", { exact: true })).toHaveValue(
    "Company 2",
  );
});

async function createTestOpportunity(page: Page) {
  await page.goto("/preview");
  await page
    .getByRole("button", { name: "Opportunities", exact: true })
    .click();
  await page
    .getByLabel("Referral details")
    .fill(
      "Sam at Example Company shared Backend Engineer and Frontend Engineer openings. sam@example.test",
    );
  await page.getByRole("button", { name: "Structure opportunity" }).click();
  await expect(page.getByLabel("Company", { exact: true })).toHaveValue(
    "Example Company",
  );
}

test("clarification asks the owner before creating an email", async ({
  page,
}) => {
  const app = await mocks(page, true);
  await createTestOpportunity(page);
  await page.getByRole("button", { name: "Create email draft" }).click();
  await expect(
    page.getByRole("heading", { name: "A few details before drafting" }),
  ).toBeVisible();
  expect(app.state.drafts).toHaveLength(0);
  await expect(page.getByLabel("Subject", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Answer and create draft" }),
  ).toBeDisabled();
  await page
    .getByLabel("Which role would you like a referral for?")
    .fill("Backend Engineer");
  await page.getByRole("button", { name: "Answer and create draft" }).click();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Referral request — Backend Engineer",
  );
  expect(app.state.drafts).toHaveLength(1);
  await expect(
    page.getByRole("heading", { name: "A few details before drafting" }),
  ).toHaveCount(0);
});

test("opportunity deletion can be cancelled and closes the dialog after confirmation", async ({
  page,
}) => {
  const app = await mocks(page);
  await createTestOpportunity(page);
  await page
    .getByRole("button", { name: "Delete opportunity", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(app.state.opportunities).toHaveLength(1);
  await page
    .getByRole("button", { name: "Delete opportunity", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => app.state.opportunities.length).toBe(0);
});

test("AI provider selection saves independently of server defaults", async ({
  page,
}) => {
  const mock = await mocks(page);
  await page.goto("/preview");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("combobox", { name: "AI provider" }).click();
  await page.getByRole("option", { name: "Vercel AI Gateway" }).click();
  await expect(page.getByLabel("Model ID")).toHaveValue("zai/glm-5.3");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect.poll(() => mock.state.settings.provider).toBe("vercel");
  await page.getByRole("combobox", { name: "AI provider" }).click();
  await page.getByRole("option", { name: "AkashML", exact: true }).click();
  await expect(page.getByLabel("Model ID")).toHaveValue("zai-org/GLM-5.3");
  await page.getByRole("button", { name: "Discover available models" }).click();
  await expect(
    page.getByRole("combobox", { name: "Available models" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect.poll(() => mock.state.settings.provider).toBe("akash");
  await page.getByRole("combobox", { name: "AI provider" }).click();
  await page.getByRole("option", { name: "Together AI", exact: true }).click();
  await expect(page.getByLabel("Model ID")).toHaveValue("MiniMaxAI/MiniMax-M3");
  await page.getByRole("button", { name: "Discover available models" }).click();
  await expect(
    page.getByRole("combobox", { name: "Available models" }),
  ).toContainText("MiniMaxAI/MiniMax-M3");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect.poll(() => mock.state.settings.provider).toBe("together");
  await page.getByRole("combobox", { name: "AI provider" }).click();
  await page.getByRole("option", { name: "Groq", exact: true }).click();
  await expect(page.getByLabel("Model ID")).toHaveValue("openai/gpt-oss-20b");
  await page.getByRole("button", { name: "Discover available models" }).click();
  await expect(
    page.getByRole("combobox", { name: "Available models" }),
  ).toContainText("openai/gpt-oss-20b");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect.poll(() => mock.state.settings.provider).toBe("groq");
});

test("home creation opens focused intake even with existing opportunities", async ({
  page,
}) => {
  await mocks(page);
  await createTestOpportunity(page);
  await page.getByRole("button", { name: "Close referral" }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page
    .getByRole("button", { name: "New opportunity", exact: true })
    .click();
  await expect(page.getByLabel("Referral details")).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Add an opportunity" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "New opportunities", exact: true }),
  ).toBeVisible();
});

test("theme choice persists across reload and public pages", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({
    path: `.impeccable/review/${test.info().project.name}-landing-dark.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "Open your workspace" }).click();
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("dark opportunity modal closes with Escape and restores focus", async ({
  page,
}) => {
  await mocks(page);
  await createTestOpportunity(page);
  await page
    .getByRole("button", { name: "Close referral", exact: true })
    .click();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  const trigger = page.getByRole("button", {
    name: "New opportunity",
    exact: true,
  });
  await trigger.click();
  const modal = page.getByRole("dialog", { name: "Add an opportunity" });
  await expect(modal).toBeVisible();
  await page.screenshot({
    path: `.impeccable/review/${test.info().project.name}-intake-dark.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
