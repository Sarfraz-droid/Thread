"use client";
import { useState, useEffect } from "react";
import { Brain, Check, Plus, Trash2, Save, FileText } from "lucide-react";
import { Button } from "@mailer/ui/components/button";
import { FieldGroup } from "@mailer/ui/components/field";
import { Badge } from "@mailer/ui/components/badge";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@mailer/ui/components/alert";
import { type Profile, type Memory, type Document } from "@mailer/core";
import { request, useWorkspace } from "./workspace-context";
import {
  TextField,
  UploadButton,
  DocumentAttachment,
  Spinner,
  Blank,
} from "./common";
function MemoryRow({ memory }: { memory: Memory }) {
  const { run, reload, busy } = useWorkspace();
  const [editing, setEditing] = useState(false),
    [value, setValue] = useState(memory.content);
  async function save(content: string) {
    await run("Saving memory", async () => {
      await request(`memories/${memory.id}`, "PUT", { content });
      await reload();
      setEditing(false);
    });
  }
  return (
    <article className="memory-row">
      <div className="memory-key">
        <Brain className="size-4" />
        <span>{memory.key.replace(/[_.]/g, " ")}</span>
        {memory.status === "conflict" && (
          <Badge variant="outline">Needs clarification</Badge>
        )}
      </div>
      {editing ? (
        <TextField
          id={`memory-${memory.id}`}
          label="Memory"
          multiline
          value={value}
          onChange={setValue}
        />
      ) : (
        <p>{memory.content}</p>
      )}
      {memory.proposal && (
        <div className="conflict-note">
          <p>You also said: {memory.proposal}</p>
          <Button
            variant="outline"
            size="sm"
            disabled={Boolean(busy)}
            onClick={() => void save(memory.proposal!)}
          >
            Use this instead
          </Button>
        </div>
      )}
      <p className="evidence">
        {memory.evidence
          ? `Source: “${memory.evidence}”`
          : "Saved from your conversation"}
      </p>
      <div className="flex gap-2">
        {editing ? (
          <>
            <Button
              size="sm"
              disabled={Boolean(busy) || !value.trim()}
              onClick={() => void save(value)}
            >
              Save memory
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={Boolean(busy)}
          onClick={() =>
            void run("Forgetting memory", async () => {
              await request(`memories/${memory.id}`, "DELETE");
              await reload();
            })
          }
        >
          <Trash2 data-icon="inline-start" />
          Forget
        </Button>
      </div>
    </article>
  );
}
function DocumentTextEditor({ document }: { document: Document }) {
  const { run, reload, busy } = useWorkspace();
  const [text, setText] = useState<string | null>(null);
  return (
    <div>
      <Button
        variant="link"
        size="sm"
        onClick={() =>
          void run("Reading extracted text", async () =>
            setText(
              (
                await request<{ document: Document }>(
                  `documents/${document.id}`,
                )
              ).document.text,
            ),
          )
        }
      >
        Review extracted text
      </Button>
      {text !== null && (
        <div className="flex flex-col gap-3">
          <TextField
            id={`text-${document.id}`}
            label="Extracted text"
            multiline
            rows={8}
            value={text}
            onChange={setText}
            hint="Correct extraction errors here. The original attachment stays the same."
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={Boolean(busy)}
              onClick={() =>
                void run("Saving document text", async () => {
                  await request(`documents/${document.id}`, "PUT", { text });
                  await reload();
                  setText(null);
                })
              }
            >
              Save text
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setText(null)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
export function ProfileView() {
  const { state, busy, run, reload } = useWorkspace();
  const [draft, setDraft] = useState<Profile>(state.profile),
    [review, setReview] = useState(false),
    [skills, setSkills] = useState(state.profile.skills.join(", ")),
    [links, setLinks] = useState(state.profile.links.join("\n")),
    [newKey, setNewKey] = useState(""),
    [newContent, setNewContent] = useState("");
  useEffect(() => {
    setDraft(state.profile);
    setSkills(state.profile.skills.join(", "));
    setLinks(state.profile.links.join("\n"));
  }, [state.profile]);
  function set(field: keyof Profile, value: string) {
    setDraft((d) => ({
      ...d,
      [field]:
        field === "skills"
          ? value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : field === "links"
            ? value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
            : value,
    }));
  }
  async function extract(document: Document) {
    const profile = await request<Profile>(
      `documents/${document.id}/profile`,
      "POST",
    );
    setDraft(profile);
    setSkills(profile.skills.join(", "));
    setLinks(profile.links.join("\n"));
    setReview(true);
  }
  return (
    <div className="page-body">
      <div className="page-heading">
        <div>
          <h1>Profile &amp; memory</h1>
        </div>
        <UploadButton onUploaded={extract} />
      </div>
      <div className="profile-layout">
        <section>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("Saving profile", async () => {
                await request("profile", "PUT", {
                  ...draft,
                  skills: skills
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                  links: links
                    .split("\n")
                    .map((v) => v.trim())
                    .filter(Boolean),
                });
                await reload();
                setReview(false);
              });
            }}
          >
            {review && (
              <Alert className="mb-6">
                <Check />
                <AlertTitle>Your resume is ready to review</AlertTitle>
                <AlertDescription>
                  Check the extracted details below, then save your profile.
                  Nothing is confirmed until you save.
                </AlertDescription>
              </Alert>
            )}
            <FieldGroup>
              <div className="form-two">
                <TextField
                  id="profile-name"
                  label="Full name"
                  value={draft.name}
                  onChange={(v) => set("name", v)}
                  required
                />
                <TextField
                  id="profile-headline"
                  label="Professional headline"
                  value={draft.headline}
                  onChange={(v) => set("headline", v)}
                />
                <TextField
                  id="profile-email"
                  label="Contact email"
                  type="email"
                  value={draft.email}
                  onChange={(v) => set("email", v)}
                />
                <TextField
                  id="profile-location"
                  label="Location"
                  value={draft.location}
                  onChange={(v) => set("location", v)}
                />
              </div>
              <TextField
                id="profile-summary"
                label="About you"
                multiline
                rows={5}
                value={draft.summary}
                onChange={(v) => set("summary", v)}
                hint="A clear summary of your experience, strengths, and what you bring to a team."
              />
              <TextField
                id="profile-skills"
                label="Skills"
                value={skills}
                onChange={setSkills}
                hint="Separate skills with commas."
              />
              <TextField
                id="profile-target"
                label="What you’re looking for"
                multiline
                rows={2}
                value={draft.target_roles}
                onChange={(v) => set("target_roles", v)}
              />
              <details className="profile-details">
                <summary>Experience, education, and supporting details</summary>
                <FieldGroup>
                  <TextField
                    id="profile-experience"
                    label="Experience"
                    multiline
                    rows={7}
                    value={draft.experience}
                    onChange={(v) => set("experience", v)}
                  />
                  <TextField
                    id="profile-education"
                    label="Education"
                    multiline
                    value={draft.education}
                    onChange={(v) => set("education", v)}
                  />
                  <TextField
                    id="profile-projects"
                    label="Projects"
                    multiline
                    value={draft.projects}
                    onChange={(v) => set("projects", v)}
                  />
                  <TextField
                    id="profile-achievements"
                    label="Achievements"
                    multiline
                    value={draft.achievements}
                    onChange={(v) => set("achievements", v)}
                  />
                  <TextField
                    id="profile-links"
                    label="Portfolio and professional links"
                    multiline
                    value={links}
                    onChange={setLinks}
                    hint="One full URL per line."
                  />
                  <TextField
                    id="profile-preferences"
                    label="Communication preferences"
                    multiline
                    value={draft.preferences}
                    onChange={(v) => set("preferences", v)}
                  />
                </FieldGroup>
              </details>
              <Button
                type="submit"
                className="self-start"
                disabled={Boolean(busy)}
              >
                {busy === "Saving profile" ? (
                  <Spinner />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                Save profile
              </Button>
            </FieldGroup>
          </form>
          <section className="documents-section">
            <div className="section-heading">
              <h2>Your documents</h2>
              <FileText className="size-4" />
            </div>
            <p className="section-description">
              Your original files, ready to attach. PDF, DOCX, images, or text;
              up to 10 MB each.
            </p>
            {state.documents.length ? (
              state.documents.map((document) => (
                <div key={document.id} className="document-row">
                  <DocumentAttachment document={document} />
                  <div className="flex flex-wrap gap-2">
                    {document.kind === "resume" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            void run("Extracting profile", () =>
                              extract(document),
                            )
                          }
                        >
                          Build profile
                        </Button>
                        {!document.is_default && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={Boolean(busy)}
                            onClick={() =>
                              void run("Choosing default resume", async () => {
                                await request(
                                  `documents/${document.id}/default`,
                                  "POST",
                                  {},
                                );
                                await reload();
                              })
                            }
                          >
                            Use as default
                          </Button>
                        )}
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete document ${document.name}`}
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void run("Deleting document", async () => {
                          await request(`documents/${document.id}`, "DELETE");
                          await reload();
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <DocumentTextEditor document={document} />
                </div>
              ))
            ) : (
              <Blank
                title="Start with your resume"
                description="Upload your resume to build your profile and keep an original copy for referral emails."
              />
            )}
            <UploadButton kind="attachment" label="Add another attachment" />
          </section>
        </section>
        <aside className="memory-panel">
          <div className="section-heading">
            <h2>Long-term memory</h2>
            <Badge variant="secondary">{state.memories.length} saved</Badge>
          </div>
          <p className="section-description">
            What you’ve told your agent, beyond the resume. You can change or
            forget any fact.
          </p>
          {state.memories.length ? (
            state.memories.map((memory) => (
              <MemoryRow
                key={`${memory.id}-${memory.updated_at}`}
                memory={memory}
              />
            ))
          ) : (
            <Blank
              title="A memory that grows with you"
              description="Talk about your goals, preferences, and experience in chat. Explicit facts are saved here."
            />
          )}
          <details className="profile-details">
            <summary>
              <Plus className="size-4" />
              Add a memory yourself
            </summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run("Adding memory", async () => {
                  await request("memories", "POST", {
                    key: newKey,
                    content: newContent,
                  });
                  setNewKey("");
                  setNewContent("");
                  await reload();
                });
              }}
            >
              <FieldGroup>
                <TextField
                  id="memory-key"
                  label="Topic key"
                  value={newKey}
                  onChange={setNewKey}
                  hint="For example: preferences.location"
                  required
                />
                <TextField
                  id="memory-content"
                  label="What should be remembered?"
                  multiline
                  value={newContent}
                  onChange={setNewContent}
                  required
                />
                <Button type="submit" disabled={Boolean(busy)}>
                  Add memory
                </Button>
              </FieldGroup>
            </form>
          </details>
          <p className="memory-footnote">
            Forgetting also excludes existing chat history from future agent
            context, so old messages cannot restore the fact. History stays
            readable.
          </p>
        </aside>
      </div>
    </div>
  );
}
