"use client";
import { useState, useEffect } from "react";
import {
  MessageSquare,
  UserRound,
  Send,
  Settings,
  LayoutDashboard,
  LogOut,
  LockKeyhole,
  X,
} from "lucide-react";
import { Button } from "@mailer/ui/components/button";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@mailer/ui/components/alert";
import { WorkspaceProvider, useWorkspace, request } from "./workspace-context";
import { DashboardView } from "./dashboard-view";
import { ChatView } from "./chat-view";
import { ProfileView } from "./profile-view";
import { OpportunitiesView } from "./opportunities-view";
import { SettingsView, type ProviderStatus } from "./settings-view";
import { Spinner } from "./common";
import { ThemeToggle } from "./theme-toggle";
const nav = [
  { id: "dashboard", name: "Dashboard", icon: LayoutDashboard },
  { id: "chat", name: "Chat", icon: MessageSquare },
  { id: "profile", name: "Profile & memory", icon: UserRound },
  { id: "opportunities", name: "Opportunities", icon: Send },
  { id: "settings", name: "Settings", icon: Settings },
];
function Shell({
  providers,
  initialView,
}: {
  providers: ProviderStatus;
  initialView: string;
}) {
  const { state, error, setError, busy, run, authenticated, preview } =
    useWorkspace();
  const [view, setView] = useState(
    nav.some((n) => n.id === initialView) ? initialView : "dashboard",
  );
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [opportunityId, setOpportunityId] = useState<string>();
  const [createOpportunity, setCreateOpportunity] = useState(false);
  function navigate(next: string, id?: string) {
    setOpportunityId(id === "new" ? undefined : id);
    setCreateOpportunity(next === "opportunities" && id === "new");
    setView(next);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?view=${next}`,
    );
  }
  return (
    <div className="workspace-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href="/">
          <span>
            thread<span className="brand-period">.</span>
          </span>
        </a>

        <nav aria-label="Workspace navigation">
          {nav.map((item) => (
            <Button
              key={item.id}
              disabled={!ready}
              variant="ghost"
              className="nav-button"
              aria-label={item.name}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon data-icon="inline-start" />
              <span className="desktop-nav-label">{item.name}</span>
              <span className="mobile-nav-label">
                {item.id === "profile" ? "Profile" : item.name}
              </span>
              {item.id === "opportunities" &&
                state.opportunities.length > 0 && (
                  <span className="nav-count">
                    {state.opportunities.length}
                  </span>
                )}
            </Button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="private-note">
            <LockKeyhole className="size-3.5" />
            Your private workspace
          </div>
          <div className="sidebar-user">
            <span className="user-avatar">
              {state.profile.name
                ? state.profile.name
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("")
                : "You"}
            </span>
            <div>
              <strong>{state.profile.name || "Your next chapter"}</strong>
              <small>
                {authenticated ? "Personal account" : "Getting started"}
              </small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{nav.find((n) => n.id === view)?.name}</strong>
          </div>
          <div className="topbar-right">
            <ThemeToggle />
            {busy ? (
              <span className="flex items-center gap-2">
                <Spinner />
                {busy}
              </span>
            ) : (
              <span className="connection-status">
                <span className="status-dot" />
                {authenticated
                  ? "Connected"
                  : preview
                    ? "Preview workspace"
                    : "Ready when you are"}
              </span>
            )}
            {authenticated && (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Sign out"
                onClick={() =>
                  void run("Signing out", async () => {
                    await request("signout", "POST", {});
                    window.location.assign("/login");
                  })
                }
              >
                <LogOut />
              </Button>
            )}
          </div>
        </header>
        <main id="main-content" className="main-content">
          {error && (
            <Alert variant="destructive" className="workspace-alert">
              <AlertTitle>Something needs attention</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X />
              </Button>
            </Alert>
          )}
          {preview && (
            <div className="preview-banner">
              Preview · Sign in to save changes.
            </div>
          )}
          {view === "dashboard" && <DashboardView navigate={navigate} />}
          {view === "chat" && <ChatView navigate={navigate} />}{" "}
          {view === "profile" && <ProfileView />}{" "}
          {view === "opportunities" && (
            <OpportunitiesView
              key={opportunityId ?? (createOpportunity ? "create" : "list")}
              initialSelected={opportunityId}
              initialCreate={createOpportunity}
            />
          )}{" "}
          {view === "settings" && (
            <SettingsView
              key={state.settings.model + state.settings.signature}
              providers={providers}
            />
          )}
        </main>
      </div>
    </div>
  );
}
export function Workspace({
  authenticated,
  preview = false,
  providers,
  initialError = "",
  initialView = "dashboard",
}: {
  authenticated: boolean;
  preview?: boolean;
  providers: ProviderStatus;
  initialError?: string;
  initialView?: string;
}) {
  return (
    <WorkspaceProvider
      authenticated={authenticated}
      preview={preview}
      initialError={initialError}
    >
      <Shell providers={providers} initialView={initialView} />
    </WorkspaceProvider>
  );
}
