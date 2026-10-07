"use client";
import {
  ArrowRight,
  Plus,
  FileText,
  Mail,
  MessageSquare,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@mailer/ui/components/button";
import { Badge } from "@mailer/ui/components/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@mailer/ui/components/card";
import { useWorkspace } from "./workspace-context";
export function DashboardView({
  navigate,
}: {
  navigate: (view: string, opportunityId?: string) => void;
}) {
  const { state } = useWorkspace();
  const drafts = state.drafts.filter(
    (d) => d.status === "draft" || d.status === "failed",
  );
  const sent = state.drafts.filter((d) => d.status === "sent");
  const profileReady = Boolean(state.profile.name && state.profile.summary);
  const next = !profileReady
    ? {
        title: "Build your profile",
        description: "Upload a resume and review your details.",
        view: "profile",
        label: "Add your resume",
      }
    : !state.gmail.connected
      ? {
          title: "Connect Gmail",
          description: "Connect your account to send reviewed emails.",
          view: "settings",
          label: "Connect account",
        }
      : {
          title: "Create an opportunity",
          description: "Paste a referral or job link to start a draft.",
          view: "opportunities",
          label: "New opportunity",
        };
  return (
    <div className="page-body dashboard-body">
      <div className="page-heading">
        <div>
          <h1>Dashboard</h1>
          <p>
            {state.profile.name
              ? `Welcome back, ${state.profile.name.split(" ")[0]}.`
              : "Your networking workspace."}
          </p>
        </div>
        <Button onClick={() => navigate("opportunities", "new")}>
          <Plus data-icon="inline-start" />
          New opportunity
        </Button>
      </div>
      <section className="home-focus" aria-labelledby="home-focus-title">
        <div>
          <h2 id="home-focus-title">
            {drafts.length
              ? "A thoughtful email starts with a little attention."
              : "Make room for your next opportunity."}
          </h2>
          <p>
            {drafts.length
              ? `${drafts.length} ${drafts.length === 1 ? "draft is" : "drafts are"} waiting for your review. Refine the message, check the details, and send when it feels right.`
              : "Save a referral, bring in the context, and shape a personal email. One conversation at a time."}
          </p>
          <Button
            onClick={() =>
              drafts.length
                ? navigate("opportunities", drafts[0].opportunity_id)
                : navigate("opportunities", "new")
            }
          >
            {drafts.length
              ? "Review next draft"
              : state.opportunities.length
                ? "Add an opportunity"
                : "Add your first opportunity"}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
        <ol className="home-flow" aria-label="Opportunity workflow">
          <li>
            <span>1</span>
            <div>
              <strong>Capture the opportunity</strong>
              <p>A referral message, job link, or screenshot.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Find the right words</strong>
              <p>Research the role and review your draft.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Reach out with confidence</strong>
              <p>Send the email you have reviewed.</p>
            </div>
          </li>
        </ol>
      </section>
      <div className="dashboard-stats" aria-label="Workspace summary">
        {[
          {
            label: "Opportunities",
            count: state.opportunities.length,
            icon: FileText,
            view: "opportunities",
          },
          {
            label: "Drafts to review",
            count: drafts.length,
            icon: Mail,
            view: "opportunities",
          },
          {
            label: "Emails sent",
            count: sent.length,
            icon: CheckCircle2,
            view: "opportunities",
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader>
              <CardDescription className="flex items-center justify-between">
                {item.label}
                <item.icon aria-hidden="true" className="size-4" />
              </CardDescription>
              <CardTitle className="tabular-nums">{item.count}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="link" onClick={() => navigate(item.view)}>
                View
                <ArrowRight data-icon="inline-end" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="dashboard-grid">
        <Card>
          <CardHeader>
            <CardTitle>Recent opportunities</CardTitle>
            <CardDescription>
              Track your latest referrals and applications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.opportunities.length ? (
              <div className="dashboard-list">
                {state.opportunities.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    className="dashboard-opportunity"
                    onClick={() => navigate("opportunities", item.id)}
                  >
                    <span>
                      <strong>{item.company || "New opportunity"}</strong>
                      <small>{item.role || "Add role details"}</small>
                    </span>
                    <Badge variant="secondary">{item.status}</Badge>
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty">
                <p>No opportunities yet.</p>
                <Button
                  variant="outline"
                  onClick={() => navigate("opportunities", "new")}
                >
                  Add an opportunity
                  <Plus data-icon="inline-end" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{next.title}</CardTitle>
            <CardDescription>{next.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Button
              variant="outline"
              onClick={() =>
                navigate(
                  next.view,
                  next.view === "opportunities" ? "new" : undefined,
                )
              }
            >
              {next.label}
              <ArrowRight data-icon="inline-end" />
            </Button>
            <div className="dashboard-checklist">
              <span>
                <FileText aria-hidden="true" />
                {profileReady ? "Profile ready" : "Profile needs setup"}
              </span>
              <span>
                <Mail aria-hidden="true" />
                {state.gmail.connected
                  ? "Gmail connected"
                  : "Gmail not connected"}
              </span>
            </div>
            <Button variant="ghost" onClick={() => navigate("chat")}>
              <MessageSquare data-icon="inline-start" />
              Open chat
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
