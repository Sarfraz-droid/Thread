"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { emptyProfile, type WorkspaceState } from "@mailer/core";
import { toast } from "sonner";
export const emptyState: WorkspaceState = {
  profile: emptyProfile,
  settings: { model: "zai-org/GLM-5.3", signature: "" },
  isOwner: false,
  memories: [],
  documents: [],
  conversations: [],
  opportunities: [],
  drafts: [],
  mcp: [],
  gmail: { connected: false, email: null },
};
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers:
      body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "This request did not finish.");
  return result as T;
}
type Context = {
  state: WorkspaceState;
  busy: string;
  error: string;
  setError: (message: string) => void;
  reload: () => Promise<void>;
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T | undefined>;
  authenticated: boolean;
  preview: boolean;
};
const WorkspaceContext = createContext<Context | null>(null);
export function WorkspaceProvider({
  children,
  authenticated,
  preview = false,
  initialError = "",
}: {
  children: ReactNode;
  authenticated: boolean;
  preview?: boolean;
  initialError?: string;
}) {
  const [state, setState] = useState(emptyState),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(initialError);
  const reload = useCallback(async () => {
    try {
      setState(await request<WorkspaceState>("state"));
    } catch (error) {
      if (!preview) throw error;
    }
  }, [preview]);
  const run = useCallback(async <T,>(name: string, fn: () => Promise<T>) => {
    setBusy(name);
    setError("");
    try {
      return await fn();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "This request failed.";
      setError(message);
      toast.error(message);
      return undefined;
    } finally {
      setBusy("");
    }
  }, []);
  useEffect(() => {
    if (authenticated || preview) {
      void run("Loading workspace", reload);
    }
  }, [authenticated, preview, reload, run]);
  return (
    <WorkspaceContext.Provider
      value={{
        state,
        busy,
        error,
        setError,
        reload,
        run,
        authenticated,
        preview,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("Workspace provider is missing.");
  return context;
}
