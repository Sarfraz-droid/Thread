import { z } from "zod";

// Google Forms publishes each form's structure in FB_PUBLIC_LOAD_DATA_.
// Positions below follow that undocumented array; parsing is defensive so an
// unexpected shape yields fewer questions rather than a crash.
export const formQuestionKinds = [
  "short",
  "paragraph",
  "choice",
  "dropdown",
  "checkboxes",
  "scale",
  "date",
  "time",
] as const;
export type FormQuestionKind = (typeof formQuestionKinds)[number];
export type FormQuestion = {
  // Numeric entry id, or "emailAddress" for the built-in email field.
  entryId: string;
  title: string;
  description: string;
  kind: FormQuestionKind;
  required: boolean;
  options: string[];
  page: number;
};
export type ParsedForm = {
  formId: string;
  title: string;
  description: string;
  questions: FormQuestion[];
  pageCount: number;
  fbzx: string;
  hasFileUpload: boolean;
  requiresSignIn: boolean;
  // Questions the filler cannot represent (grids with "other", uploads, …).
  skipped: string[];
};
export type FormAnswerValue = string | string[];
export type FormAnswers = Record<string, FormAnswerValue>;
export const formAnswerValueSchema = z.union([
  z.string().max(5000),
  z.array(z.string().max(500)).max(50),
]);
export const formAnswersSchema = z.record(
  z.string().regex(/^(\d{1,20}|emailAddress)$/),
  formAnswerValueSchema,
);
export type FormAnswerSource = "memory" | "suggested" | "needs_you";
export type SuggestedFormAnswer = {
  value: FormAnswerValue | null;
  source: FormAnswerSource;
  note?: string;
};
export type FormReadResult = {
  url: string;
  form: ParsedForm;
  answers: Record<string, SuggestedFormAnswer>;
};
export type SavedFormAnswer = {
  id: string;
  question_key: string;
  question: string;
  answer: FormAnswerValue;
  times_used: number;
  updated_at: string;
};
export type FormFill = {
  id: string;
  form_id: string;
  form_url: string;
  title: string;
  mode: "prefill" | "submit";
  status: "prepared" | "submitted" | "failed";
  created_at: string;
};

const FORM_HOSTS = new Set(["docs.google.com", "forms.gle"]);
// Accepts viewform, short, and prefilled links; edit links cannot be answered.
export function googleFormUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Paste a Google Forms link.");
  }
  if (url.protocol !== "https:" || !FORM_HOSTS.has(url.hostname))
    throw new Error(
      "Paste a docs.google.com/forms or forms.gle link to a Google Form.",
    );
  if (url.hostname === "docs.google.com" && !url.pathname.startsWith("/forms/"))
    throw new Error("This Google link is not a form.");
  if (/\/edit\/?$/.test(url.pathname))
    throw new Error(
      "This is the form editor link. Use the form’s Send or share link instead.",
    );
  url.hash = "";
  return url;
}
export function publishedFormId(url: URL) {
  return url.pathname.match(/^\/forms\/(?:u\/\d+\/)?d\/e\/([\w-]{10,})/)?.[1];
}

type Raw = unknown;
const at = (value: Raw, ...path: number[]): Raw =>
  path.reduce<Raw>(
    (node, index) => (Array.isArray(node) ? node[index] : undefined),
    value,
  );
const text = (value: Raw) => (typeof value === "string" ? value.trim() : "");
function readLoadData(html: string): Raw {
  const marker = html.indexOf("FB_PUBLIC_LOAD_DATA_");
  if (marker < 0) return undefined;
  const start = html.indexOf("[", marker);
  const end = html.indexOf(";</script>", start);
  if (start < 0 || end < 0) return undefined;
  try {
    return JSON.parse(html.slice(start, end));
  } catch {
    return undefined;
  }
}
function optionValues(raw: Raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((option) => text(at(option, 0)))
    .filter(Boolean);
}

export function parseGoogleForm(html: string, formId: string): ParsedForm {
  const data = readLoadData(html);
  const items = at(data, 1, 1);
  if (!Array.isArray(items))
    throw new Error(
      "This form’s questions could not be read. It may be closed or require sign-in.",
    );
  const questions: FormQuestion[] = [];
  const skipped: string[] = [];
  let page = 0;
  let hasFileUpload = false;
  for (const item of items) {
    const type = at(item, 3);
    const title = text(at(item, 1));
    const description = text(at(item, 2));
    const answerData = at(item, 4);
    if (type === 8) {
      page++;
      continue;
    }
    if (type === 13) {
      hasFileUpload = true;
      skipped.push(title || "File upload");
      continue;
    }
    if (!Array.isArray(answerData) || !answerData.length) continue;
    const entry = (row: Raw) => {
      const id = at(row, 0);
      return typeof id === "number" || typeof id === "string" ? String(id) : "";
    };
    const required = (row: Raw) => at(row, 2) === 1 || at(row, 2) === true;
    if (type === 7) {
      // Grids answer one entry per row; flatten them into separate questions.
      for (const row of answerData) {
        const id = entry(row);
        if (!id) continue;
        questions.push({
          entryId: id,
          title: `${title} — ${text(at(row, 3, 0))}`,
          description,
          kind: at(row, 11, 0) === 1 ? "checkboxes" : "choice",
          required: required(row),
          options: optionValues(at(row, 1)),
          page,
        });
      }
      continue;
    }
    const kind: FormQuestionKind | undefined = (
      {
        0: "short",
        1: "paragraph",
        2: "choice",
        3: "dropdown",
        4: "checkboxes",
        5: "scale",
        9: "date",
        10: "time",
      } as Record<number, FormQuestionKind>
    )[Number(type)];
    const id = entry(answerData[0]);
    if (!kind || !id) {
      if (title) skipped.push(title);
      continue;
    }
    // Including the year or time in a date changes how it must be submitted.
    if (kind === "date" && at(answerData[0], 7, 0) === 1) {
      skipped.push(title);
      continue;
    }
    questions.push({
      entryId: id,
      title: title || "Untitled question",
      description,
      kind,
      required: required(answerData[0]),
      options: optionValues(at(answerData[0], 1)),
      page,
    });
  }
  // Settings: 1 = no email, 2 = verified (sign-in), 3 = responder input.
  const emailSetting = at(data, 1, 10, 6);
  if (emailSetting === 3)
    questions.unshift({
      entryId: "emailAddress",
      title: "Email",
      description: "",
      kind: "short",
      required: true,
      options: [],
      page: 0,
    });
  return {
    formId,
    title: text(at(data, 1, 8)) || text(at(data, 3)) || "Google Form",
    description: text(at(data, 1, 0)),
    questions,
    pageCount: page + 1,
    fbzx: html.match(/name="fbzx" value="(-?\d+)"/)?.[1] ?? "",
    hasFileUpload,
    requiresSignIn:
      emailSetting === 2 || at(data, 1, 10, 1) === 1 || hasFileUpload,
    skipped,
  };
}

// The same question worded identically across forms shares one memory.
export function normalizeQuestion(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 300);
}

// Returns a value the form will accept for this question, or undefined.
export function cleanFormAnswer(
  question: FormQuestion,
  value: unknown,
): FormAnswerValue | undefined {
  const pick = (candidate: unknown) =>
    typeof candidate === "string"
      ? question.options.find(
          (option) => option.toLowerCase() === candidate.trim().toLowerCase(),
        )
      : undefined;
  if (question.kind === "checkboxes") {
    const values = (Array.isArray(value) ? value : [value])
      .map(pick)
      .filter((option): option is string => Boolean(option));
    return values.length ? [...new Set(values)] : undefined;
  }
  const single = Array.isArray(value) ? value[0] : value;
  if (typeof single !== "string" || !single.trim()) return undefined;
  if (["choice", "dropdown", "scale"].includes(question.kind))
    return pick(single);
  if (question.kind === "date")
    return /^\d{4}-\d{2}-\d{2}$/.test(single.trim())
      ? single.trim()
      : undefined;
  if (question.kind === "time")
    return /^\d{2}:\d{2}$/.test(single.trim()) ? single.trim() : undefined;
  return question.kind === "short"
    ? single
        .trim()
        .replace(/\s*\n\s*/g, " ")
        .slice(0, 1000)
    : single.trim().slice(0, 5000);
}
export function cleanFormAnswers(form: ParsedForm, answers: FormAnswers) {
  const cleaned: FormAnswers = {};
  for (const question of form.questions) {
    const value = cleanFormAnswer(question, answers[question.entryId]);
    if (value !== undefined) cleaned[question.entryId] = value;
  }
  return cleaned;
}
export function missingRequired(form: ParsedForm, answers: FormAnswers) {
  return form.questions.filter(
    (question) => question.required && !(question.entryId in answers),
  );
}
function fieldName(entryId: string) {
  return entryId === "emailAddress" ? entryId : `entry.${entryId}`;
}

// Opens in the owner's own browser and Google account for a final check.
export function prefilledFormUrl(form: ParsedForm, answers: FormAnswers) {
  const url = new URL(
    `https://docs.google.com/forms/d/e/${form.formId}/viewform`,
  );
  url.searchParams.set("usp", "pp_url");
  for (const question of form.questions) {
    const value = answers[question.entryId];
    for (const item of Array.isArray(value) ? value : value ? [value] : [])
      url.searchParams.append(fieldName(question.entryId), item);
  }
  return url.href;
}
export function formResponseBody(form: ParsedForm, answers: FormAnswers) {
  const body = new URLSearchParams();
  for (const question of form.questions) {
    const value = answers[question.entryId];
    if (value === undefined) continue;
    const name = fieldName(question.entryId);
    if (question.kind === "date" && typeof value === "string") {
      const [year, month, day] = value.split("-");
      body.append(`${name}_year`, year);
      body.append(`${name}_month`, month);
      body.append(`${name}_day`, day);
    } else if (question.kind === "time" && typeof value === "string") {
      const [hour, minute] = value.split(":");
      body.append(`${name}_hour`, hour);
      body.append(`${name}_minute`, minute);
    } else
      for (const item of Array.isArray(value) ? value : [value])
        body.append(name, item);
  }
  body.set("fvv", "1");
  body.set(
    "pageHistory",
    Array.from({ length: form.pageCount }, (_, page) => page).join(","),
  );
  if (form.fbzx) body.set("fbzx", form.fbzx);
  return body;
}
