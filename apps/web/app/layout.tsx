import type { Metadata } from "next";
import { ThemeToaster } from "@/components/theme-toggle";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/geist-mono/400.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "Thread — Networking workspace",
  description:
    "Your story, remembered. Personal referral emails, researched and reviewed.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try { document.documentElement.classList.toggle('dark', localStorage.getItem('thread-theme') === 'dark'); } catch {}`,
          }}
        />
      </head>
      <body>
        {children}
        <ThemeToaster />
      </body>
    </html>
  );
}
