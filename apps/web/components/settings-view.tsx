"use client";
import { useState } from "react";
import {
  Mail,
  Check,
  Plug,
  Plus,
  Trash2,
  Download,
  ArrowUpRight,
  Save,
  RefreshCw,
} from "lucide-react";
import { Button, buttonVariants } from "@mailer/ui/components/button";
import { Badge } from "@mailer/ui/components/badge";
import { FieldGroup, Field, FieldLabel } from "@mailer/ui/components/field";
import { Checkbox } from "@mailer/ui/components/checkbox";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@mailer/ui/components/alert";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@mailer/ui/components/select";
import { type AiProvider, type McpConfig } from "@mailer/core";
import { request, useWorkspace } from "./workspace-context";
import { TextField, Spinner } from "./common";
export type ProviderStatus = {
  supabase: boolean;
  akash: boolean;
  gateway?: boolean;
  together?: boolean;
  groq?: boolean;
  openrouter?: boolean;
  tavily: boolean;
  google: boolean;
  encryption: boolean;
};
function McpRow({ config }: { config: McpConfig }) {
  const { run, reload, busy } = useWorkspace();
  const [tools, setTools] = useState<
      { name: string; description?: string; read_only: boolean }[]
    >([]),
    [selected, setSelected] = useState(config.allowed_tools);
  return (
    <article className="mcp-row">
      <div className="section-heading">
        <div>
          <strong>{config.name}</strong>
          <p className="section-description break-all">{config.url}</p>
        </div>
        <Badge variant="secondary">{config.enabled ? "Enabled" : "Off"}</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={Boolean(busy)}
          onClick={() =>
            void run("Checking MCP connection", async () => {
              const result = await request<{ tools: typeof tools }>(
                `mcp/${config.id}/tools`,
              );
              setTools(result.tools);
            })
          }
        >
          <RefreshCw data-icon="inline-start" />
          Check connection & tools
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={Boolean(busy)}
          onClick={() =>
            void run("Removing MCP connection", async () => {
              await request(`mcp/${config.id}`, "DELETE");
              await reload();
            })
          }
        >
          <Trash2 data-icon="inline-start" />
          Remove
        </Button>
      </div>
      {tools.length > 0 && (
        <div className="mcp-tools">
          <p className="section-description">
            Select only tools you have verified are read-only. A server’s
            read-only label is advisory.
          </p>
          {tools.map((tool) => (
            <Field key={tool.name} orientation="horizontal">
              <Checkbox
                id={`${config.id}-${tool.name}`}
                checked={selected.includes(tool.name)}
                onCheckedChange={(checked) =>
                  setSelected((current) =>
                    checked
                      ? [...current, tool.name]
                      : current.filter((name) => name !== tool.name),
                  )
                }
              />
              <FieldLabel htmlFor={`${config.id}-${tool.name}`}>
                <span>
                  {tool.name}
                  {tool.read_only && " · Declared read-only"}
                  <small className="block text-muted-foreground">
                    {tool.description?.slice(0, 200)}
                  </small>
                </span>
              </FieldLabel>
            </Field>
          ))}
        </div>
      )}
      <div className="flex gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          disabled={!selected.length || Boolean(busy)}
          onClick={() =>
            void run("Saving MCP tools", async () => {
              await request(`mcp/${config.id}`, "PUT", {
                allowed_tools: selected,
                enabled: true,
              });
              await reload();
            })
          }
        >
          Enable selected tools
        </Button>
        {config.enabled && (
          <Button
            variant="ghost"
            size="sm"
            disabled={Boolean(busy)}
            onClick={() =>
              void run("Disabling MCP tools", async () => {
                await request(`mcp/${config.id}`, "PUT", {
                  allowed_tools: selected,
                  enabled: false,
                });
                await reload();
              })
            }
          >
            Disable
          </Button>
        )}
      </div>
    </article>
  );
}
export function SettingsView({ providers }: { providers: ProviderStatus }) {
  const { state, busy, run, reload } = useWorkspace();
  const [provider, setProvider] = useState<AiProvider>(
    state.settings.provider ?? "akash",
  );
  const [model, setModel] = useState(state.settings.model),
    [signature, setSignature] = useState(state.settings.signature),
    [models, setModels] = useState<string[]>([]),
    [name, setName] = useState(""),
    [url, setUrl] = useState(""),
    [token, setToken] = useState("");
  return (
    <div className="page-body settings-body">
      <div className="page-heading">
        <div>
          <h1>Settings</h1>
        </div>
      </div>
      <section className="settings-section">
        <div className="section-heading">
          <div className="flex items-center gap-3">
            <Mail className="size-5" />
            <h2>Gmail</h2>
          </div>
          <Badge variant={state.gmail.connected ? "default" : "secondary"}>
            {state.gmail.connected ? "Connected" : "Not connected"}
          </Badge>
        </div>
        <p className="section-description">
          Send reviewed emails directly from your account. This app asks for
          sending permission, without access to your inbox.
        </p>
        {state.gmail.email && (
          <p className="connected-account">
            <Check className="size-4" />
            {state.gmail.email}
          </p>
        )}
        <Button
          variant="outline"
          disabled={Boolean(busy) || !providers.google}
          onClick={() =>
            void run("Connecting Gmail", async () => {
              const result = await request<{ url: string }>(
                "gmail/connect",
                "POST",
                {},
              );
              window.location.assign(result.url);
            })
          }
        >
          {busy === "Connecting Gmail" ? (
            <Spinner />
          ) : (
            <Mail data-icon="inline-start" />
          )}
          {state.gmail.connected ? "Reconnect Gmail" : "Connect Gmail"}
          <ArrowUpRight data-icon="inline-end" />
        </Button>
        {state.gmail.connected && (
          <Button
            variant="ghost"
            disabled={Boolean(busy)}
            onClick={() =>
              void run("Disconnecting Gmail", async () => {
                await request("gmail", "DELETE");
                await reload();
              })
            }
          >
            Disconnect
          </Button>
        )}
        {!providers.google && (
          <p className="configuration-note">
            Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and ENCRYPTION_KEY to
            enable Gmail.
          </p>
        )}
      </section>
      <section className="settings-section">
        <div className="section-heading">
          <h2>Agent & writing preferences</h2>
          <Badge variant="secondary">
            {state.settings.provider === "vercel"
              ? "Vercel AI Gateway"
              : state.settings.provider === "together"
                ? "Together AI"
                : state.settings.provider === "groq"
                  ? "Groq"
                  : state.settings.provider === "openrouter"
                    ? "OpenRouter"
                    : "AkashML"}
          </Badge>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run("Saving settings", async () => {
              await request("settings", "PUT", { provider, model, signature });
              await reload();
            });
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ai-provider">AI provider</FieldLabel>
              <Select
                value={provider}
                onValueChange={(value) => {
                  if (
                    value !== "akash" &&
                    value !== "vercel" &&
                    value !== "together" &&
                    value !== "groq" &&
                    value !== "openrouter"
                  )
                    return;
                  setProvider(value);
                  setModel(
                    value === state.settings.provider
                      ? state.settings.model
                      : value === "akash"
                        ? "zai-org/GLM-5.3"
                        : value === "together"
                          ? "MiniMaxAI/MiniMax-M3"
                          : value === "groq"
                            ? "openai/gpt-oss-20b"
                            : value === "openrouter"
                              ? "openrouter/auto-beta"
                              : "zai/glm-5.3",
                  );
                  setModels([]);
                }}
              >
                <SelectTrigger id="ai-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="akash">AkashML</SelectItem>
                    <SelectItem value="vercel">Vercel AI Gateway</SelectItem>
                    <SelectItem value="together">Together AI</SelectItem>
                    <SelectItem value="groq">Groq</SelectItem>
                    <SelectItem value="openrouter">OpenRouter</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <TextField
              id="model"
              label="Model ID"
              value={model}
              onChange={setModel}
              hint={
                provider === "vercel"
                  ? "Choose a Vercel AI Gateway model ID. Tool use requires tool-calling support."
                  : provider === "together"
                    ? "Choose a Together AI chat model. Tool use requires function-calling support."
                    : provider === "groq"
                      ? "Choose a Groq chat model supporting tool use."
                      : provider === "openrouter"
                        ? "Choose an OpenRouter model ID. openrouter/auto-beta picks a model automatically; tool use requires tool-calling support."
                        : "Choose an AkashML text model supporting chat. Tool use also requires tool-calling support."
              }
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={
                  Boolean(busy) ||
                  !(provider === "vercel"
                    ? providers.gateway
                    : provider === "together"
                      ? providers.together
                      : provider === "groq"
                        ? providers.groq
                        : provider === "openrouter"
                          ? providers.openrouter
                          : providers.akash)
                }
                onClick={() =>
                  void run("Loading available models", async () => {
                    const result = await request<{ models: { id: string }[] }>(
                      `models?provider=${provider}`,
                    );
                    setModels(result.models.map((m) => m.id));
                  })
                }
              >
                <RefreshCw data-icon="inline-start" />
                Discover available models
              </Button>
              {models.length > 0 && (
                <Select
                  value={model}
                  onValueChange={(value) => {
                    if (value) setModel(value);
                  }}
                >
                  <SelectTrigger aria-label="Available models">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {models.map((id) => (
                        <SelectItem key={id} value={id}>
                          {id}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </div>
            <TextField
              id="signature"
              label="Email signature"
              multiline
              rows={4}
              value={signature}
              onChange={setSignature}
              hint="Used when generating new drafts. It never changes an already reviewed email."
            />
            <Button
              type="submit"
              className="self-start"
              disabled={Boolean(busy)}
            >
              <Save data-icon="inline-start" />
              Save preferences
            </Button>
          </FieldGroup>
        </form>
      </section>
      <section className="settings-section">
        <div className="section-heading">
          <div className="flex items-center gap-3">
            <Plug className="size-5" />
            <h2>External MCP tools</h2>
          </div>
          <Badge variant="secondary">Optional</Badge>
        </div>
        <p className="section-description">
          Connect a trusted remote HTTPS server, inspect its tools, and choose
          what the chat agent may read. Email sending stays in your draft
          editor.
        </p>
        {state.mcp.map((config) => (
          <McpRow
            key={`${config.id}-${config.enabled}-${config.allowed_tools.join()}`}
            config={config}
          />
        ))}
        <details className="profile-details">
          <summary>
            <Plus className="size-4" />
            Add an MCP connection
          </summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("Adding MCP connection", async () => {
                await request("mcp", "POST", {
                  name,
                  url,
                  token,
                  enabled: false,
                  allowed_tools: [],
                });
                setName("");
                setUrl("");
                setToken("");
                await reload();
              });
            }}
          >
            <FieldGroup>
              <TextField
                id="mcp-name"
                label="Connection name"
                value={name}
                onChange={setName}
                required
              />
              <TextField
                id="mcp-url"
                label="HTTPS endpoint"
                value={url}
                onChange={setUrl}
                required
              />
              <TextField
                id="mcp-token"
                label="Bearer token (optional)"
                type="password"
                value={token}
                onChange={setToken}
                hint="Encrypted on the server; never returned to the browser."
              />
              <Button
                type="submit"
                disabled={Boolean(busy) || !providers.encryption}
              >
                Add connection
              </Button>
            </FieldGroup>
          </form>
        </details>
      </section>
      <section className="settings-section">
        <h2>Provider setup</h2>
        <p className="section-description">
          Keys are configured in your deployment environment, not stored in the
          browser.
        </p>
        <div className="provider-status">
          {[
            {
              name: "Supabase",
              ready: providers.supabase,
              key: "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, OWNER_EMAIL",
            },
            {
              name: "Vercel AI Gateway",
              ready: Boolean(providers.gateway),
              key: "AI_GATEWAY_API_KEY",
            },
            { name: "AkashML", ready: providers.akash, key: "AKASH_API_KEY" },
            {
              name: "Groq",
              ready: Boolean(providers.groq),
              key: "GROQ_API_KEY",
            },
            {
              name: "OpenRouter",
              ready: Boolean(providers.openrouter),
              key: "OPENROUTER_API_KEY",
            },
            {
              name: "Together AI",
              ready: Boolean(providers.together),
              key: "TOGETHER_API_KEY",
            },
            { name: "Tavily", ready: providers.tavily, key: "TAVILY_API_KEY" },
            {
              name: "Encryption",
              ready: providers.encryption,
              key: "ENCRYPTION_KEY",
            },
          ].map((provider) => (
            <div key={provider.name}>
              <strong>{provider.name}</strong>
              <Badge variant={provider.ready ? "secondary" : "outline"}>
                {provider.ready ? "Configured" : "Needs setup"}
              </Badge>
              <small>{provider.key}</small>
            </div>
          ))}
        </div>
        <Alert>
          <AlertTitle>Free infrastructure, your AI credits</AlertTitle>
          <AlertDescription>
            Use Vercel Hobby, Supabase Free, and Tavily’s free allowance for
            personal use. AkashML inference uses your balance. Quota failures
            pause the affected action; the app does not upgrade plans.
          </AlertDescription>
        </Alert>
      </section>
      <section className="settings-section">
        <h2>Your data belongs to you.</h2>
        <p className="section-description">
          Export your profile, memories, conversations, documents metadata,
          opportunities, and sent history. Credentials are excluded; download
          original files from Profile & Memory.
        </p>
        <a
          className={buttonVariants({ variant: "outline" })}
          href="/api/export"
          download="networking-workspace.json"
        >
          <Download data-icon="inline-start" />
          Export workspace
        </a>
      </section>
    </div>
  );
}
