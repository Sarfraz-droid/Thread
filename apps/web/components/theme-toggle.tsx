"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Toaster } from "sonner";
import { Button } from "@mailer/ui/components/button";

const storageKey = "thread-theme";

function subscribe(callback: () => void) {
  function sync(event: StorageEvent) {
    if (event.key !== storageKey && event.key !== null) return;
    document.documentElement.classList.toggle(
      "dark",
      event.newValue === "dark",
    );
    callback();
  }
  window.addEventListener("thread-theme-change", callback);
  window.addEventListener("storage", sync);
  return () => {
    window.removeEventListener("thread-theme-change", callback);
    window.removeEventListener("storage", sync);
  };
}

function useDarkTheme() {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

export function ThemeToggle() {
  const dark = useDarkTheme();
  const label = dark ? "Switch to light theme" : "Switch to dark theme";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => {
        const next = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem(storageKey, next ? "dark" : "light");
        } catch {
          // Theme switching still works when browser storage is unavailable.
        }
        window.dispatchEvent(new Event("thread-theme-change"));
      }}
    >
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  );
}

export function ThemeToaster() {
  const dark = useDarkTheme();
  return <Toaster theme={dark ? "dark" : "light"} position="bottom-right" />;
}
