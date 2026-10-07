import {
  ArrowRight,
  Check,
  LockKeyhole,
  Paperclip,
  ArrowUpRight,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { buttonVariants } from "@mailer/ui/components/button";

export function LandingPage() {
  return (
    <div className="landing-page">
      <a className="skip-link" href="#landing-content">
        Skip to content
      </a>
      <header className="landing-nav">
        <a className="brand" href="/" aria-label="Thread home">
          thread<span className="brand-period">.</span>
        </a>
        <nav aria-label="Main navigation">
          <ThemeToggle />
          <a href="#how-it-works">How it works</a>
          <a className={buttonVariants({ variant: "outline" })} href="/login">
            Sign in
            <ArrowUpRight />
          </a>
        </nav>
      </header>
      <main id="landing-content">
        <section className="landing-hero">
          <div className="landing-copy">
            <h1>Your next chapter starts with a conversation.</h1>
            <p>
              A quiet place to turn referrals and job opportunities into
              thoughtful, personal emails. Keep your story close and your next
              step clear.
            </p>
            <div className="landing-actions">
              <a className={buttonVariants({ size: "lg" })} href="/login">
                Open your workspace
                <ArrowRight />
              </a>
              <a href="/preview">
                Explore the preview
                <ArrowUpRight />
              </a>
            </div>
            <span className="landing-private">
              <LockKeyhole size={14} />
              Your private networking workspace
            </span>
          </div>
          <div
            className="landing-letter"
            aria-label="Illustrative email workflow"
          >
            <div className="letter-toolbar">
              <span>A little context. A personal connection.</span>
              <span>Illustrative draft</span>
            </div>
            <div className="letter-body">
              <div className="letter-meta">
                <span>To</span>
                <strong>Your next connection</strong>
              </div>
              <div className="letter-meta">
                <span>Subject</span>
                <strong>A new opportunity to connect</strong>
              </div>
              <div className="letter-message">
                <p>Hi there,</p>
                <p>
                  I came across the role you shared and would love to learn more
                  about the team.
                </p>
                <p>
                  Here’s a little about my experience, and why this opportunity
                  caught my attention…
                </p>
                <p>
                  Thanks for your time,
                  <br />
                  You
                </p>
              </div>
              <span className="letter-attachment">
                <Paperclip size={14} /> Your resume, attached
              </span>
            </div>
            <div className="letter-footer">
              <span>
                <Check size={15} /> Reviewed by you
              </span>
              <span>
                Ready when you are
                <ArrowRight size={15} />
              </span>
            </div>
          </div>
        </section>
        <section id="how-it-works" className="landing-process">
          <div className="landing-process-intro">
            <h2>
              A clear path from
              <br />
              “maybe” to “hello.”
            </h2>
            <p>
              You bring the opportunity. Thread helps you bring the context and
              find the words.
            </p>
          </div>
          <ol>
            <li>
              <span>1</span>
              <div>
                <h3>Bring your story</h3>
                <p>
                  Add your resume and review your profile. Keep the experience
                  and preferences that matter in editable memory.
                </p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <h3>Save a promising lead</h3>
                <p>
                  Paste a referral or job link, or add a screenshot. Review the
                  details and research the opportunity in one place.
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <h3>Make it personal</h3>
                <p>
                  Refine your draft with the agent, attach your resume, and send
                  through Gmail after your own review.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section className="landing-close">
          <h2>
            One opportunity.
            <br />
            One considered next step.
          </h2>
          <a href="/login" className={buttonVariants({ size: "lg" })}>
            Get started
            <ArrowRight />
          </a>
        </section>
      </main>
      <footer className="landing-footer">
        <a className="brand" href="/">
          thread.
        </a>
        <p>Your story. Your words. Your next chapter.</p>
        <a href="/login">
          Sign in
          <ArrowUpRight size={14} />
        </a>
      </footer>
    </div>
  );
}
